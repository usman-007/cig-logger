export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function startOfDay(input: number | Date): Date {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(input: number | Date): Date {
  const d = new Date(input);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(input: number | Date, days: number): Date {
  const d = new Date(input);
  d.setDate(d.getDate() + days);
  return d;
}

/** Local-time YYYY-MM-DD key — never UTC, days must line up with the user's day. */
export function dayKey(input: number | Date): string {
  const d = new Date(input);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isSameDay(a: number | Date, b: number | Date) {
  return dayKey(a) === dayKey(b);
}

/** Days back from today, inclusive: rangeDays(7) -> the last 7 local days. */
export function lastNDays(n: number, from: number | Date = Date.now()): Date[] {
  const base = startOfDay(from);
  return Array.from({ length: n }, (_, i) => addDays(base, i - (n - 1)));
}

export function formatTime(input: number | Date) {
  return new Date(input).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(input: number | Date, opts?: Intl.DateTimeFormatOptions) {
  return new Date(input).toLocaleDateString(
    undefined,
    opts ?? { month: "short", day: "numeric" },
  );
}

export function formatDayLabel(input: number | Date) {
  const d = new Date(input);
  if (isSameDay(d, Date.now())) return "Today";
  if (isSameDay(d, addDays(Date.now(), -1))) return "Yesterday";
  const withinWeek = Date.now() - d.getTime() < 6 * DAY;
  return withinWeek
    ? d.toLocaleDateString(undefined, { weekday: "long" })
    : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatHourLabel(hour: number) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" }).replace(/\s/g, "");
}

/** "2h 14m" — compact, tabular-friendly. */
export function formatDuration(ms: number, opts: { seconds?: boolean } = {}) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return opts.seconds ? `${h}h ${m}m ${s}s` : `${h}h ${m}m`;
  if (m > 0) return opts.seconds ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

/** Split for a big live counter: 03 : 42 : 07 */
export function splitDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** Value for <input type="datetime-local"> in local time. */
export function toDatetimeLocal(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value: string) {
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? Date.now() : ts;
}

/** Value for <input type="date"> in local time. */
export function toDateInput(ts: number) {
  return dayKey(ts);
}
