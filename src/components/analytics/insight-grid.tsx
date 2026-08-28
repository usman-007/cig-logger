"use client";

import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/dashboard/stat-tile";
import { TRIGGER_MAP } from "@/lib/constants";
import { formatHourLabel } from "@/lib/date";
import { formatCount, formatPercent } from "@/lib/format";
import {
  hourlyHistogram,
  triggerBreakdown,
  weekdayHistogram,
} from "@/lib/stats";
import type { CigaretteLog } from "@/lib/types";
import type { TriggerId } from "@/lib/types";
import { Clock, Cigarette, CalendarDays, Tag } from "lucide-react";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Four stat tiles — headline numbers, not charts, because each one is a
 * single value with no shape worth plotting.
 */
export function InsightGrid({
  logs,
  days,
}: {
  logs: CigaretteLog[];
  days: number;
}) {
  const breakdown = triggerBreakdown(logs.filter((l) => l.trigger));
  const top = breakdown[0];
  const hours = hourlyHistogram(logs);
  const peakHour = hours.reduce((best, h) => (h.count > best.count ? h : best), hours[0]);
  const weekdays = weekdayHistogram(logs);
  const peakDay = weekdays.reduce((best, d) => (d.count > best.count ? d : best), weekdays[0]);
  const rolled = logs.filter((l) => l.type === "rolled").length;
  const rolledShare = logs.length === 0 ? 0 : rolled / logs.length;

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
        <StatTile
          icon={<Tag className="size-3" />}
          label="Top trigger"
          value={top ? TRIGGER_MAP[top.trigger as TriggerId].label : "—"}
          hint={top ? `${formatPercent(top.share)} of tagged entries` : "nothing tagged yet"}
        />
        <StatTile
          icon={<Clock className="size-3" />}
          label="Peak hour"
          value={peakHour.count > 0 ? formatHourLabel(peakHour.hour) : "—"}
          hint={peakHour.count > 0 ? `${peakHour.count} logged in that hour` : "no data"}
        />
        <StatTile
          icon={<CalendarDays className="size-3" />}
          label="Heaviest day"
          value={peakDay.count > 0 ? DAY_LABELS[peakDay.day].slice(0, 3) : "—"}
          hint={peakDay.count > 0 ? `${peakDay.count} over ${days} days` : "no data"}
        />
        <StatTile
          icon={<Cigarette className="size-3" />}
          label="Roll-ups"
          value={formatPercent(rolledShare)}
          hint={`${rolled} of ${formatCount(logs.length, 0)} entries`}
        />
      </CardContent>
    </Card>
  );
}
