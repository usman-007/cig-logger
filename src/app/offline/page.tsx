import { CloudOff } from "lucide-react";

export const metadata = { title: "Offline · Ash" };

export default function OfflinePage() {
  return (
    <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
        <CloudOff className="size-6" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">You&apos;re offline</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ash keeps your data on this device, so anything you already opened still
          works. Reconnect to load pages you haven&apos;t visited yet.
        </p>
      </div>
    </main>
  );
}
