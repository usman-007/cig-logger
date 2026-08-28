"use client";

import { CircleCheck, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, Progress } from "@/components/ui/misc";
import { CHART } from "@/lib/chart-theme";
import { formatDate } from "@/lib/date";
import { formatCount } from "@/lib/format";
import type { DashboardStats } from "@/lib/stats";
import type { Settings } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The headline number is the chart. The week strip underneath gives it
 * context without turning today into a one-bar bar chart.
 */
export function TodayCard({
  stats,
  settings,
}: {
  stats: DashboardStats;
  settings: Settings;
}) {
  const count = stats.today.count;
  const limit = settings.dailyLimit;
  const remaining = limit - count;
  const over = remaining < 0;
  const atLimit = remaining === 0;

  const trend = stats.trendPct;
  const TrendIcon =
    trend === null || Math.abs(trend) < 1 ? Minus : trend < 0 ? TrendingDown : TrendingUp;
  const trendTone =
    trend === null || Math.abs(trend) < 1 ? "neutral" : trend < 0 ? "good" : "serious";

  const peak = Math.max(limit, ...stats.week.map((d) => d.count), 1);

  return (
    <Card className="overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-70"
        style={{
          background: over
            ? "radial-gradient(28rem 8rem at 20% 0%, rgba(208,59,59,0.18), transparent 70%)"
            : "radial-gradient(28rem 8rem at 20% 0%, rgba(16,185,129,0.16), transparent 70%)",
        }}
      />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Today
            </p>
            <p className="mt-0.5 text-xs text-subtle-foreground">
              {formatDate(stats.today.date, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
          {over ? (
            <Badge tone="critical">
              <TrendingUp className="size-3.5" />
              {Math.abs(remaining)} over target
            </Badge>
          ) : atLimit ? (
            <Badge tone="warning">
              <Minus className="size-3.5" />
              At your target
            </Badge>
          ) : (
            <Badge tone="good">
              <CircleCheck className="size-3.5" />
              {remaining} left today
            </Badge>
          )}
        </div>

        <div className="mt-4 flex items-end gap-3">
          <span
            className={cn(
              "text-[3.5rem] font-semibold leading-none tabular",
              over ? "text-[#e86a6a]" : "text-foreground",
            )}
          >
            {count}
          </span>
          <span className="pb-1.5 text-sm text-muted-foreground">
            of {limit} target
          </span>
        </div>

        <Progress
          value={Math.min(count, limit)}
          max={limit}
          className="mt-4 h-2.5"
          indicatorClassName={over ? "bg-[#d03b3b]" : atLimit ? "bg-warning" : "bg-primary"}
        />

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border/70 pt-4 sm:grid-cols-3">
          <Metric
            label="7-day average"
            value={formatCount(stats.weekAverage)}
            hint="per day"
          />
          <Metric label="This week" value={`${stats.weekTotal}`} hint="cigarettes" />
          <Metric
            className="col-span-2 sm:col-span-1"
            label="vs last week"
            value={
              trend === null ? (
                "—"
              ) : (
                <span className="flex items-center gap-1">
                  <TrendIcon
                    className={cn(
                      "size-4",
                      trendTone === "good"
                        ? "text-[#3cc93c]"
                        : trendTone === "serious"
                          ? "text-serious"
                          : "text-subtle-foreground",
                    )}
                  />
                  {Math.abs(trend).toFixed(0)}%
                </span>
              )
            }
            hint={
              trend === null
                ? "not enough history"
                : trend < 0
                  ? "fewer than last week"
                  : "more than last week"
            }
          />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.07em] text-subtle-foreground">
            <span>Last 7 days</span>
            <span>Target {limit}/day</span>
          </div>
          <div className="flex h-16 items-stretch gap-1.5">
            {stats.week.map((day, index) => {
              const isToday = index === stats.week.length - 1;
              const height = Math.max(3, (day.count / peak) * 100);
              const dayOver = day.count > limit;
              return (
                <div key={day.key} className="flex flex-1 flex-col items-center gap-1.5">
                  {/* the track owns the height so the bar's percentage resolves */}
                  <div className="relative w-full flex-1">
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-[4px] transition-all"
                      style={{
                        height: `${height}%`,
                        background: dayOver ? "#d03b3b" : CHART.cig,
                        opacity: isToday ? 1 : 0.55,
                      }}
                      title={`${day.count} on ${formatDate(day.date)}`}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] tabular",
                      isToday ? "font-semibold text-foreground" : "text-subtle-foreground",
                    )}
                  >
                    {day.date.toLocaleDateString(undefined, { weekday: "narrow" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] uppercase tracking-[0.07em] text-subtle-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular">{value}</p>
      {hint ? <p className="text-[11px] text-subtle-foreground">{hint}</p> : null}
    </div>
  );
}
