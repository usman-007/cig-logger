"use client";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { TriggerDonut, toDonutSlices } from "@/components/charts/trigger-donut";
import { triggerColor } from "@/lib/chart-theme";
import { TRIGGER_MAP } from "@/lib/constants";
import { formatHourLabel } from "@/lib/date";
import { formatPercent } from "@/lib/format";
import { peakHourFor, triggerBreakdown } from "@/lib/stats";
import type { CigaretteLog, TriggerId } from "@/lib/types";
import { Tags } from "lucide-react";

/**
 * Donut for the share at a glance (six segments max), ranked list for the
 * precise comparison. Every row is named and labelled, so colour is never the
 * only thing carrying identity.
 */
export function TriggerBreakdown({ logs }: { logs: CigaretteLog[] }) {
  const breakdown = triggerBreakdown(logs);
  const slices = toDonutSlices(breakdown);
  const tagged = logs.filter((l) => l.trigger).length;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              What sets it off
            </p>
            <p className="mt-1 text-sm text-subtle-foreground">
              {tagged === 0
                ? "Tag a few entries to see the pattern."
                : `${tagged} of ${logs.length} entries tagged.`}
            </p>
          </div>
        </div>

        {logs.length === 0 ? (
          <EmptyState
            className="mt-4 border-0 bg-white/[0.02]"
            icon={<Tags className="size-5" />}
            title="No entries in this range"
            description="Log a few cigarettes and the breakdown appears here."
          />
        ) : (
          <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <TriggerDonut slices={slices} total={logs.length} />

            <ul className="w-full flex-1 space-y-2.5">
              {breakdown.map((slice) => {
                const label =
                  slice.trigger === "untagged"
                    ? "Untagged"
                    : TRIGGER_MAP[slice.trigger as TriggerId].label;
                const color = triggerColor(slice.trigger);
                const peak =
                  slice.trigger === "untagged"
                    ? null
                    : peakHourFor(logs, slice.trigger as TriggerId);
                return (
                  <li key={slice.trigger}>
                    <div className="flex items-baseline gap-2 text-sm">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 translate-y-[1px] rounded-full"
                        style={{ background: color }}
                      />
                      <span className="truncate font-medium">{label}</span>
                      {peak !== null ? (
                        <span className="hidden shrink-0 text-[11px] text-subtle-foreground sm:inline">
                          peaks {formatHourLabel(peak)}
                        </span>
                      ) : null}
                      <span className="ml-auto shrink-0 tabular text-muted-foreground">
                        {slice.count}
                      </span>
                      <span className="w-11 shrink-0 text-right font-semibold tabular">
                        {formatPercent(slice.share)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(2, slice.share * 100)}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
