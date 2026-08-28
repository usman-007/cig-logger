"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART } from "@/lib/chart-theme";
import { formatCount } from "@/lib/format";
import { ChartTooltip } from "./chart-tooltip";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekdayChart({
  data,
  height = 170,
}: {
  data: { day: number; count: number }[];
  height?: number;
}) {
  const peak = data.reduce((best, d) => (d.count > best.count ? d : best), data[0]);
  const hasData = data.some((d) => d.count > 0);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 14, right: 4, bottom: 0, left: 0 }} barCategoryGap={8}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(day: number) => DAY_LABELS[day]}
            tick={{ fill: CHART.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
          />
          <YAxis
            tick={{ fill: CHART.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={34}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const datum = payload[0].payload as { day: number; count: number };
              return (
                <ChartTooltip
                  title={DAY_LABELS[datum.day]}
                  rows={[
                    {
                      label: "Avg per day",
                      value: formatCount(datum.count),
                      color: CHART.cig,
                    },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.day}
                fill={CHART.cig}
                fillOpacity={hasData && d.day === peak.day ? 1 : 0.62}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
