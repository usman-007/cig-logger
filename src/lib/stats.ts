import { addDays, dayKey, DAY, lastNDays, startOfDay } from "./date";
import { blendedUnitCost, unitCostFor, type UnitCosts } from "./cost";
import type { CigaretteLog, Settings, TriggerId } from "./types";
import { round } from "./utils";

export interface DayBucket {
  key: string;
  date: Date;
  count: number;
  factory: number;
  rolled: number;
  cost: number;
}

export function logsOnDay(logs: CigaretteLog[], day: number | Date) {
  const key = dayKey(day);
  return logs.filter((l) => dayKey(l.ts) === key);
}

export function costOfLogs(logs: CigaretteLog[], costs: UnitCosts) {
  return logs.reduce((acc, l) => acc + unitCostFor(l.type, costs), 0);
}

/** One bucket per local day, oldest first. Empty days are included as zeros. */
export function dailyBuckets(
  logs: CigaretteLog[],
  days: number,
  costs: UnitCosts,
  from: number | Date = Date.now(),
): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  for (const date of lastNDays(days, from)) {
    buckets.set(dayKey(date), {
      key: dayKey(date),
      date,
      count: 0,
      factory: 0,
      rolled: 0,
      cost: 0,
    });
  }
  for (const log of logs) {
    const bucket = buckets.get(dayKey(log.ts));
    if (!bucket) continue;
    bucket.count += 1;
    if (log.type === "rolled") bucket.rolled += 1;
    else bucket.factory += 1;
    bucket.cost += unitCostFor(log.type, costs);
  }
  return [...buckets.values()];
}

/** 24 slots, index = local hour. */
export function hourlyHistogram(logs: CigaretteLog[]) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const log of logs) hours[new Date(log.ts).getHours()].count += 1;
  return hours;
}

/** Average per hour across a window of days (so a 7-day view isn't a sum). */
export function hourlyAverage(logs: CigaretteLog[], days: number, now: number) {
  const cutoff = startOfDay(addDays(now, -(days - 1))).getTime();
  const within = logs.filter((l) => l.ts >= cutoff);
  const hist = hourlyHistogram(within);
  return hist.map((h) => ({ ...h, count: round(h.count / days, 2) }));
}

/** Index 0 = Sunday, matching Date#getDay. */
export function weekdayHistogram(logs: CigaretteLog[]) {
  const days = Array.from({ length: 7 }, (_, day) => ({ day, count: 0 }));
  for (const log of logs) days[new Date(log.ts).getDay()].count += 1;
  return days;
}

export interface TriggerSlice {
  trigger: TriggerId | "untagged";
  count: number;
  share: number;
}

export function triggerBreakdown(logs: CigaretteLog[]): TriggerSlice[] {
  const counts = new Map<TriggerId | "untagged", number>();
  for (const log of logs) {
    const key = log.trigger ?? "untagged";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = logs.length || 1;
  return [...counts.entries()]
    .map(([trigger, count]) => ({
      trigger,
      count,
      share: count / total,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Trigger counts split by hour-of-day band — powers the "when does X hit" copy. */
export function peakHourFor(logs: CigaretteLog[], trigger: TriggerId) {
  const hist = hourlyHistogram(logs.filter((l) => l.trigger === trigger));
  const peak = hist.reduce((best, h) => (h.count > best.count ? h : best), hist[0]);
  return peak.count > 0 ? peak.hour : null;
}

export function timeSinceLast(logs: CigaretteLog[], now: number) {
  const last = latestLog(logs);
  if (!last) return null;
  return Math.max(0, now - last.ts);
}

export function latestLog(logs: CigaretteLog[]) {
  let latest: CigaretteLog | null = null;
  for (const log of logs) if (!latest || log.ts > latest.ts) latest = log;
  return latest;
}

/** Longest / current run of days that finished at or under the daily limit. */
export function limitStreak(
  logs: CigaretteLog[],
  settings: Settings,
  startedAt: number,
  now: number,
) {
  const spanDays = Math.max(
    1,
    Math.ceil((now - startOfDay(startedAt).getTime()) / DAY) + 1,
  );
  const counts = new Map<string, number>();
  for (const log of logs) {
    const key = dayKey(log.ts);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let longest = 0;
  let run = 0;
  for (const date of lastNDays(Math.min(spanDays, 400), now)) {
    const count = counts.get(dayKey(date)) ?? 0;
    if (count <= settings.dailyLimit) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  // The window ends on today, so the open run *is* the current streak. Today
  // can only extend it — it cannot break it until it goes over the limit.
  return { current: run, longest };
}

export interface MoneyStats {
  spentToday: number;
  spentWeek: number;
  spentMonth: number;
  spentTotal: number;
  /** value of the gap between the daily limit and what was actually smoked */
  savedToday: number;
  savedWeek: number;
  savedTotal: number;
  projectedYear: number;
  perDayAverage: number;
}

export function moneyStats(
  logs: CigaretteLog[],
  settings: Settings,
  costs: UnitCosts,
  startedAt: number,
  now: number,
): MoneyStats {
  const trackedDays = Math.max(
    1,
    Math.round((startOfDay(now).getTime() - startOfDay(startedAt).getTime()) / DAY) + 1,
  );

  const totals = { factory: 0, rolled: 0 };
  for (const log of logs) {
    if (log.type === "rolled") totals.rolled += 1;
    else totals.factory += 1;
  }
  const blended = blendedUnitCost(costs, totals);

  const today = dailyBuckets(logs, 1, costs, now)[0];
  const week = dailyBuckets(logs, 7, costs, now);
  const month = dailyBuckets(logs, 30, costs, now);
  const spentTotal = costOfLogs(logs, costs);

  const savedOn = (bucket: { count: number }) =>
    Math.max(0, settings.dailyLimit - bucket.count) * blended;

  const allDays = dailyBuckets(logs, Math.min(trackedDays, 400), costs, now);
  const savedTotal = allDays
    .filter((d) => dayKey(d.date) !== dayKey(now))
    .reduce((acc, d) => acc + savedOn(d), 0);

  const perDayAverage = spentTotal / trackedDays;

  return {
    spentToday: today.cost,
    spentWeek: week.reduce((a, d) => a + d.cost, 0),
    spentMonth: month.reduce((a, d) => a + d.cost, 0),
    spentTotal,
    savedToday: savedOn(today),
    savedWeek: week.reduce((a, d) => a + savedOn(d), 0),
    savedTotal,
    projectedYear: perDayAverage * 365,
    perDayAverage,
  };
}

export interface DashboardStats {
  today: DayBucket;
  yesterday: DayBucket;
  week: DayBucket[];
  weekAverage: number;
  weekTotal: number;
  previousWeekAverage: number;
  trendPct: number | null;
  sinceLastMs: number | null;
  lastLog: CigaretteLog | null;
  longestGapToday: number | null;
  money: MoneyStats;
  streak: { current: number; longest: number };
  trackedDays: number;
}

export function dashboardStats(
  logs: CigaretteLog[],
  settings: Settings,
  costs: UnitCosts,
  startedAt: number,
  now: number,
): DashboardStats {
  const twoWeeks = dailyBuckets(logs, 14, costs, now);
  const week = twoWeeks.slice(7);
  const prevWeek = twoWeeks.slice(0, 7);
  const weekTotal = week.reduce((a, d) => a + d.count, 0);
  const weekAverage = weekTotal / 7;
  const prevTotal = prevWeek.reduce((a, d) => a + d.count, 0);
  const previousWeekAverage = prevTotal / 7;
  const trendPct =
    prevTotal === 0 ? null : ((weekTotal - prevTotal) / prevTotal) * 100;

  const todayLogs = logsOnDay(logs, now).sort((a, b) => a.ts - b.ts);
  let longestGapToday: number | null = null;
  for (let i = 1; i < todayLogs.length; i += 1) {
    const gap = todayLogs[i].ts - todayLogs[i - 1].ts;
    if (longestGapToday === null || gap > longestGapToday) longestGapToday = gap;
  }

  const trackedDays = Math.max(
    1,
    Math.round((startOfDay(now).getTime() - startOfDay(startedAt).getTime()) / DAY) + 1,
  );

  return {
    today: week[6],
    yesterday: week[5],
    week,
    weekAverage,
    weekTotal,
    previousWeekAverage,
    trendPct,
    sinceLastMs: timeSinceLast(logs, now),
    lastLog: latestLog(logs),
    longestGapToday,
    money: moneyStats(logs, settings, costs, startedAt, now),
    streak: limitStreak(logs, settings, startedAt, now),
    trackedDays,
  };
}
