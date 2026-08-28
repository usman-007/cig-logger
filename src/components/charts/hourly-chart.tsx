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
import { formatHourLabel } from "@/lib/date";
import { formatCount } from "@/lib/format";
import { ChartTooltip } from "./chart-tooltip";

export interface HourDatum {
  hour: number;
  count: number;
}

/**
 * Cigarettes by hour of day. One measure, one hue — the peak reads by height,
 * and the busiest hour is direct-labelled instead of labelling every bar.
 */
export function HourlyChart({
  data,
  averaged = false,
  height = 176,
}: {
  data: HourDatum[];
  /** true when values are a per-day average rather than a raw count */
  averaged?: boolean;
  height?: number;
}) {
  const peak = data.reduce((best, d) => (d.count > best.count ? d : best), data[0]);
  const hasData = data.some((d) => d.count > 0);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 14, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={(hour: number) => (hour % 6 === 0 ? formatHourLabel(hour) : "")}
            tick={{ fill: CHART.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
            interval={0}
            minTickGap={0}
          />
          <YAxis
            tick={{ fill: CHART.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={averaged}
            width={averaged ? 34 : 26}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const datum = payload[0].payload as HourDatum;
              return (
                <ChartTooltip
                  title={`${formatHourLabel(datum.hour)} – ${formatHourLabel((datum.hour + 1) % 24)}`}
                  rows={[
                    {
                      label: averaged ? "Avg per day" : "Cigarettes",
                      value: formatCount(datum.count),
                      color: CHART.cig,
                    },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.hour}
                fill={CHART.cig}
                fillOpacity={hasData && d.hour === peak.hour ? 1 : 0.62}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
