"use client";

import { Cigarette, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { useLogController } from "@/components/app/log-controller";
import { triggerColor } from "@/lib/chart-theme";
import { TRIGGER_MAP } from "@/lib/constants";
import { formatDuration, formatTime } from "@/lib/date";
import type { CigaretteLog } from "@/lib/types";

export function RecentList({
  logs,
  limit = 6,
}: {
  logs: CigaretteLog[];
  limit?: number;
}) {
  const { openEdit, openCustom } = useLogController();
  const items = logs.slice(0, limit);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Today&apos;s entries
          </p>
          <Button variant="ghost" size="sm" onClick={() => openCustom()}>
            Add earlier one
          </Button>
        </div>

        {items.length === 0 ? (
          <EmptyState
            className="mt-4 border-0 bg-white/[0.02] py-8"
            icon={<Cigarette className="size-5" />}
            title="Nothing logged today"
            description="Whatever happens today, tracking it is the useful part."
          />
        ) : (
          <ul className="mt-3 divide-y divide-border/70">
            {items.map((log, index) => {
              const next = items[index + 1];
              const gap = next ? log.ts - next.ts : null;
              return (
                <li key={log.id}>
                  <button
                    type="button"
                    onClick={() => openEdit(log)}
                    className="group flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-white/[0.02]"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        background: log.trigger ? triggerColor(log.trigger) : "#4a5867",
                      }}
                    />
                    <span className="w-16 shrink-0 text-sm font-medium tabular">
                      {formatTime(log.ts)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {log.trigger ? TRIGGER_MAP[log.trigger].label : "Untagged"}
                      <span className="text-subtle-foreground">
                        {" · "}
                        {log.type === "rolled" ? "Roll-up" : "Factory"}
                      </span>
                      {log.note ? (
                        <span className="text-subtle-foreground"> · {log.note}</span>
                      ) : null}
                    </span>
                    {gap ? (
                      <span className="shrink-0 text-[12px] text-subtle-foreground tabular">
                        +{formatDuration(gap)}
                      </span>
                    ) : null}
                    <Pencil className="size-3.5 shrink-0 text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
