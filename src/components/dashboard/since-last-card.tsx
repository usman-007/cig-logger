"use client";

import { Clock, Hourglass, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";
import { formatDuration, formatTime, splitDuration } from "@/lib/date";
import { TRIGGER_MAP } from "@/lib/constants";
import { useStore } from "@/lib/store";
import type { DashboardStats } from "@/lib/stats";
import { cn } from "@/lib/utils";

/**
 * The live gap since the last cigarette, plus how it sits against the pacing
 * target. Ticks every second off the store's shared clock.
 */
export function SinceLastCard({ stats }: { stats: DashboardStats }) {
  const { settings, msSinceLast, msUntilPaced, lastLog } = useStore();
  const paced = msUntilPaced === 0;
  const parts = splitDuration(msSinceLast ?? 0);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Since last
          </p>
          {msSinceLast === null ? null : paced ? (
            <Badge tone="good">
              <Timer className="size-3.5" />
              Past your gap
            </Badge>
          ) : (
            <Badge tone="warning">
              <Hourglass className="size-3.5" />
              {formatDuration(msUntilPaced)} to go
            </Badge>
          )}
        </div>

        {msSinceLast === null ? (
          <div className="mt-4 space-y-1">
            <p className="text-2xl font-semibold">Nothing logged yet</p>
            <p className="text-sm text-subtle-foreground">
              Tap the button to start the clock.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-baseline gap-1 tabular">
              <TimePart value={parts.hours} unit="h" />
              <span className="pb-1 text-2xl text-subtle-foreground">:</span>
              <TimePart value={parts.minutes} unit="m" pad />
              <span className="pb-1 text-2xl text-subtle-foreground">:</span>
              <TimePart value={parts.seconds} unit="s" pad muted />
            </div>

            <div className="mt-4 space-y-2 border-t border-border/70 pt-3.5 text-[13px]">
              <Row
                icon={<Clock className="size-3.5" />}
                label="Last one"
                value={
                  <span className="flex items-center gap-1.5">
                    {formatTime(lastLog!.ts)}
                    {lastLog?.trigger ? (
                      <span className="text-subtle-foreground">
                        · {TRIGGER_MAP[lastLog.trigger].label}
                      </span>
                    ) : null}
                  </span>
                }
              />
              <Row
                icon={<Timer className="size-3.5" />}
                label="Pacing target"
                value={`${settings.pacingMinutes} min between`}
              />
              {stats.longestGapToday ? (
                <Row
                  icon={<Hourglass className="size-3.5" />}
                  label="Longest gap today"
                  value={formatDuration(stats.longestGapToday)}
                />
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TimePart({
  value,
  unit,
  pad,
  muted,
}: {
  value: number;
  unit: string;
  pad?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex items-baseline gap-0.5 text-4xl font-semibold",
        muted && "text-muted-foreground",
      )}
    >
      {pad ? `${value}`.padStart(2, "0") : value}
      <span className="text-sm font-medium text-subtle-foreground">{unit}</span>
    </span>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-subtle-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular">{value}</span>
    </div>
  );
}
