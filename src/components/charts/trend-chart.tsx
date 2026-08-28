"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART } from "@/lib/chart-theme";
import { formatDate, formatDayLabel } from "@/lib/date";
import { ChartTooltip } from "./chart-tooltip";

export interface TrendDatum {
  key: string;
  date: Date;
  count: number;
  cost: number;
}

/**
 * Daily count over time with the target as a labelled reference line — the
 * limit is chrome, not a second series, so there is only ever one y-scale.
 */
export function TrendChart({
  data,
  limit,
  currency,
  height = 200,
}: {
  data: TrendDatum[];
  limit: number;
  currency: string;
  height?: number;
}) {
  // At most six date labels, whatever the range — more than that collides on a
  // phone-width axis.
  const step = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 54, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.cig} stopOpacity={0.34} />
              <stop offset="100%" stopColor={CHART.cig} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="key"
            tickFormatter={(key: string, index: number) =>
              index % step === 0 && index <= data.length - step
                ? formatDate(data[index].date)
                : ""
            }
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
            allowDecimals={false}
            width={28}
          />
          <ReferenceLine
            y={limit}
            stroke={CHART.limit}
            strokeDasharray="4 4"
            strokeOpacity={0.75}
            label={{
              value: `Target ${limit}`,
              // in the right margin, outside the plot: a label that overlaps
              // the series is worse than no direct label at all
              position: "right",
              fill: CHART.axis,
              fontSize: 11,
            }}
          />
          <Tooltip
            cursor={{ stroke: CHART.axis, strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const datum = payload[0].payload as TrendDatum;
              return (
                <ChartTooltip
                  title={formatDayLabel(datum.date)}
                  rows={[
                    { label: "Cigarettes", value: `${datum.count}`, color: CHART.cig },
                    { label: "Spent", value: `${currency}${datum.cost.toFixed(2)}` },
                  ]}
                  note={
                    datum.count > limit
                      ? `${datum.count - limit} over target`
                      : `${limit - datum.count} under target`
                  }
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={CHART.cig}
            strokeWidth={2}
            fill="url(#trendFill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
