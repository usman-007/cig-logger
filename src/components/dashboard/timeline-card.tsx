"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Segmented } from "@/components/ui/misc";
import { HourlyChart } from "@/components/charts/hourly-chart";
import { formatHourLabel } from "@/lib/date";
import { hourlyAverage, hourlyHistogram, logsOnDay } from "@/lib/stats";
import { useStore } from "@/lib/store";
import type { CigaretteLog } from "@/lib/types";

type Range = "today" | "week";

/** Peak smoking hours — today's raw count, or a per-day average over 7 days. */
export function TimelineCard({ logs }: { logs: CigaretteLog[] }) {
  const [range, setRange] = React.useState<Range>("today");
  const { todayStart } = useStore();

  const data = React.useMemo(
    () =>
      range === "today"
        ? hourlyHistogram(logsOnDay(logs, todayStart))
        : hourlyAverage(logs, 7, todayStart),
    [logs, range, todayStart],
  );

  const peak = data.reduce((best, d) => (d.count > best.count ? d : best), data[0]);
  const total = data.reduce((a, d) => a + d.count, 0);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Consumption timeline
            </p>
            <p className="mt-1 text-sm text-subtle-foreground">
              {total === 0
                ? "Nothing logged in this window yet."
                : `Busiest around ${formatHourLabel(peak.hour)}${
                    range === "week" ? " on an average day" : ""
                  }.`}
            </p>
          </div>
          <Segmented
            size="sm"
            className="w-44"
            value={range}
            onChange={setRange}
            options={[
              { value: "today", label: "Today" },
              { value: "week", label: "7-day avg" },
            ]}
          />
        </div>

        <div className="mt-4">
          <HourlyChart data={data} averaged={range === "week"} />
        </div>
      </CardContent>
    </Card>
  );
}
