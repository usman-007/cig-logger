"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, ShieldCheck, UserPlus } from "lucide-react";
import { BottomNav, SideNav } from "./nav";
import { LogController } from "./log-controller";
import { LogFab } from "./log-fab";
import { Wordmark } from "./brand";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useStore } from "@/lib/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { hydrated, session, signOut } = useStore();
  const router = useRouter();

  React.useEffect(() => {
    if (hydrated && !session) router.replace("/login");
  }, [hydrated, session, router]);

  if (!hydrated) return <BootSkeleton />;
  if (!session) return null;

  return (
    <LogController>
      <div className="relative z-10 flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between border-r border-border bg-background-elevated/60 p-4 md:flex">
          <div className="space-y-6">
            <Link href="/dashboard" className="block px-2 py-1.5">
              <Wordmark />
            </Link>
            <SideNav />
          </div>
          <div className="space-y-3">
            <InstallPrompt variant="sidebar" />
            <div className="rounded-2xl border border-border bg-card p-3">
              <p className="truncate text-sm font-medium">{session.name}</p>
              <p className="truncate text-xs text-subtle-foreground">
                {session.guest ? "Preview mode · local only" : session.email}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-start px-2"
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
              >
                <LogOut />
                {session.guest ? "Exit preview" : "Sign out"}
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur-xl safe-top md:hidden">
            <Link href="/dashboard">
              <Wordmark />
            </Link>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" asChild>
                <Link href="/settings" aria-label="Settings">
                  <Settings />
                </Link>
              </Button>
            </div>
          </header>

          {session.guest ? <GuestBanner /> : null}

          <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-36 pt-4 md:px-8 md:pb-16 md:pt-8">
            {children}
          </main>
        </div>

        <BottomNav />
        <LogFab />
      </div>
    </LogController>
  );
}

function GuestBanner() {
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.07] px-3.5 py-2.5 md:mx-8 md:mt-6">
      <ShieldCheck className="size-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground">
        Preview mode — everything stays on this device.
      </p>
      <Button variant="ghost" size="sm" asChild className="shrink-0 text-primary">
        <Link href="/login?mode=signup">
          <UserPlus />
          Keep it
        </Link>
      </Button>
    </div>
  );
}

function BootSkeleton() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-3xl space-y-4 px-4 pt-16">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    </div>
  );
}
