"use client";

import * as React from "react";
import { PageHeader } from "@/components/app/page-header";
import { InsightGrid } from "@/components/analytics/insight-grid";
import { TriggerBreakdown } from "@/components/analytics/trigger-breakdown";
import { HourlyChart } from "@/components/charts/hourly-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { WeekdayChart } from "@/components/charts/weekday-chart";
import { Card, CardContent } from "@/components/ui/card";
import { Segmented } from "@/components/ui/misc";
import { addDays, dayKey, startOfDay } from "@/lib/date";
import { formatCount } from "@/lib/format";
import {
  dailyBuckets,
  hourlyHistogram,
  weekdayHistogram,
} from "@/lib/stats";
import { useStore } from "@/lib/store";
import { round } from "@/lib/utils";

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

export default function AnalyticsPage() {
  const { logs, settings, unitCosts, todayStart } = useStore();
  const [range, setRange] = React.useState<(typeof RANGES)[number]["value"]>("30");
  const days = Number(range);

  const cutoff = React.useMemo(
    () => startOfDay(addDays(todayStart, -(days - 1))).getTime(),
    [days, todayStart],
  );
  const scoped = React.useMemo(
    () => logs.filter((l) => l.ts >= cutoff),
    [logs, cutoff],
  );

  const trend = React.useMemo(
    () => dailyBuckets(logs, Math.min(days, 30), unitCosts, todayStart),
    [logs, days, unitCosts, todayStart],
  );

  const hourly = React.useMemo(() => {
    const hist = hourlyHistogram(scoped);
    return hist.map((h) => ({ ...h, count: round(h.count / days, 2) }));
  }, [scoped, days]);

  // Average per weekday, normalised by how many of each weekday the range holds.
  const weekday = React.useMemo(() => {
    const occurrences = new Array(7).fill(0);
    for (let i = 0; i < days; i += 1) {
      const date = addDays(todayStart, -i);
      if (dayKey(date) >= dayKey(cutoff)) occurrences[date.getDay()] += 1;
    }
    return weekdayHistogram(scoped).map((d) => ({
      ...d,
      count: round(d.count / Math.max(1, occurrences[d.day]), 2),
    }));
  }, [scoped, days, cutoff, todayStart]);

  const perDay = scoped.length / days;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Patterns"
        description="Where the cigarettes actually come from — the hour, the day, the reason."
      />

      <Segmented
        size="sm"
        className="w-full sm:w-72"
        value={range}
        onChange={setRange}
        options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
      />

      <InsightGrid logs={scoped} days={days} />

      <TriggerBreakdown logs={scoped} />

      <Card>
        <CardContent className="p-5">
          <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Daily count over time
          </p>
          <p className="mt-1 text-sm text-subtle-foreground">
            Averaging {formatCount(perDay)} a day across this range.
          </p>
          <div className="mt-4">
            <TrendChart
              data={trend}
              limit={settings.dailyLimit}
              currency={settings.currency}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Average day by hour
            </p>
            <p className="mt-1 text-sm text-subtle-foreground">
              Cigarettes per hour, averaged over {days} days.
            </p>
            <div className="mt-4">
              <HourlyChart data={hourly} averaged />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              By day of week
            </p>
            <p className="mt-1 text-sm text-subtle-foreground">
              Average for each weekday in this range.
            </p>
            <div className="mt-4">
              <WeekdayChart data={weekday} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
