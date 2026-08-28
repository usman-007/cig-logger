"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Award, Flame } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { useLogController } from "@/components/app/log-controller";
import { MoneyCard } from "@/components/dashboard/money-card";
import { RecentList } from "@/components/dashboard/recent-list";
import { SinceLastCard } from "@/components/dashboard/since-last-card";
import { TimelineCard } from "@/components/dashboard/timeline-card";
import { TodayCard } from "@/components/dashboard/today-card";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Badge } from "@/components/ui/misc";
import { dashboardStats, logsOnDay } from "@/lib/stats";
import { useStore } from "@/lib/store";
import { pluralize } from "@/lib/format";

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const { logs, settings, unitCosts, data, session, todayStart, now } = useStore();

  // Keyed on local midnight rather than the live clock: the day's figures only
  // change when a log changes or the day rolls over.
  const stats = React.useMemo(
    () => dashboardStats(logs, settings, unitCosts, data.startedAt, todayStart),
    [logs, settings, unitCosts, data.startedAt, todayStart],
  );

  const todayLogs = React.useMemo(
    () => logsOnDay(logs, todayStart),
    [logs, todayStart],
  );

  return (
    <div className="space-y-4">
      <ShortcutHandler />

      <PageHeader
        title={greeting(session?.name, now)}
        description="Here's where today stands. No judgement — just the numbers."
        action={
          stats.streak.current > 1 ? (
            <Badge tone="primary" className="mt-1 shrink-0">
              <Flame className="size-3.5" />
              {pluralize(stats.streak.current, "day")} at target
            </Badge>
          ) : stats.streak.longest > 1 ? (
            <Badge className="mt-1 shrink-0">
              <Award className="size-3.5" />
              Best: {pluralize(stats.streak.longest, "day")}
            </Badge>
          ) : null
        }
      />

      <TodayCard stats={stats} settings={settings} />

      <div className="grid gap-4 md:grid-cols-2">
        <SinceLastCard stats={stats} />
        <MoneyCard money={stats.money} costs={unitCosts} settings={settings} />
      </div>

      <TimelineCard logs={logs} />

      <RecentList logs={todayLogs} />

      <InstallPrompt className="md:hidden" />
    </div>
  );
}

/** Supports the manifest shortcut: /dashboard?action=log opens a one-tap log. */
function ShortcutHandler() {
  const params = useSearchParams();
  const router = useRouter();
  const { quickLog } = useLogController();
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (fired.current || params.get("action") !== "log") return;
    fired.current = true;
    quickLog();
    router.replace("/dashboard");
  }, [params, quickLog, router]);

  return null;
}

function greeting(name?: string, now = 0) {
  const hour = new Date(now || Date.now()).getHours();
  const part = hour < 5 ? "Late night" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const first = name?.split(" ")[0];
  return first && first !== "Guest" ? `${part}, ${first}` : part;
}
