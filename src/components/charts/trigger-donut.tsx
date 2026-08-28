"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART, triggerColor } from "@/lib/chart-theme";
import { TRIGGER_MAP } from "@/lib/constants";
import { formatPercent } from "@/lib/format";
import type { TriggerSlice } from "@/lib/stats";
import type { TriggerId } from "@/lib/types";
import { ChartTooltip } from "./chart-tooltip";

export interface DonutSlice {
  id: TriggerId | "untagged" | "other_bucket";
  label: string;
  count: number;
  share: number;
  color: string;
}

export function labelFor(trigger: TriggerId | "untagged") {
  return trigger === "untagged" ? "Untagged" : TRIGGER_MAP[trigger].label;
}

/**
 * Part-to-whole at a glance only: six segments max (top five + a merged
 * "Other"), each named and percentage-labelled in the legend beside it.
 */
export function toDonutSlices(breakdown: TriggerSlice[], max = 5): DonutSlice[] {
  const head = breakdown.slice(0, max).map((slice) => ({
    id: slice.trigger,
    label: labelFor(slice.trigger),
    count: slice.count,
    share: slice.share,
    color: triggerColor(slice.trigger),
  }));
  const tail = breakdown.slice(max);
  if (tail.length === 0) return head;
  return [
    ...head,
    {
      id: "other_bucket" as const,
      label: `${tail.length} more`,
      count: tail.reduce((a, s) => a + s.count, 0),
      share: tail.reduce((a, s) => a + s.share, 0),
      color: "#4a5867",
    },
  ];
}

export function TriggerDonut({
  slices,
  total,
  size = 190,
}: {
  slices: DonutSlice[];
  total: number;
  size?: number;
}) {
  const top = slices[0];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="count"
            nameKey="label"
            innerRadius="63%"
            outerRadius="100%"
            paddingAngle={2}
            stroke={CHART.surface}
            strokeWidth={2}
            startAngle={90}
            endAngle={-270}
            isAnimationActive={false}
          >
            {slices.map((slice) => (
              <Cell key={slice.id} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const slice = payload[0].payload as DonutSlice;
              return (
                <ChartTooltip
                  title={slice.label}
                  rows={[
                    {
                      label: "Cigarettes",
                      value: `${slice.count}`,
                      color: slice.color,
                    },
                    { label: "Share", value: formatPercent(slice.share) },
                  ]}
                />
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-semibold tabular">
          {top ? formatPercent(top.share) : "—"}
        </span>
        <span className="max-w-[70%] text-[11px] leading-tight text-subtle-foreground">
          {top ? top.label : "No data"}
        </span>
        <span className="mt-0.5 text-[10px] uppercase tracking-wider text-subtle-foreground">
          {total} logged
        </span>
      </div>
    </div>
  );
}
