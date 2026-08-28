"use client";

import * as React from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "ash:install-dismissed";

/** Nothing to subscribe to — this is a one-shot read of the environment. */
const noopSubscribe = () => () => {};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari reports installed apps here instead
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Chromium fires beforeinstallprompt, which we defer and re-fire on tap.
 * iOS has no such event, so it gets the Share-sheet instructions instead.
 */
export function InstallPrompt({
  variant = "card",
  className,
}: {
  variant?: "card" | "sidebar";
  className?: string;
}) {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const [iosHint, setIosHint] = React.useState(false);

  // iOS never fires beforeinstallprompt, so eligibility there is a plain
  // environment read taken at render time rather than an event subscription.
  const eligible = React.useSyncExternalStore(
    noopSubscribe,
    () =>
      !isStandalone() &&
      window.localStorage.getItem(DISMISS_KEY) !== "1" &&
      isIos(),
    () => false,
  );

  React.useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDismissed(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (dismissed || (!deferred && !eligible)) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setDismissed(true);
      setDeferred(null);
      return;
    }
    setIosHint((v) => !v);
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-primary/25 bg-primary/[0.06] p-3.5",
        variant === "sidebar" ? "text-[13px]" : "text-sm",
        className,
      )}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="absolute right-2 top-2 rounded-md p-1 text-subtle-foreground hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
      <p className="pr-5 font-medium">Add Ash to your home screen</p>
      <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
        One tap to log, works offline.
      </p>
      {iosHint ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-black/25 p-2 text-[12px] leading-snug text-muted-foreground">
          <Share className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Tap <strong className="text-foreground">Share</strong>, then{" "}
            <strong className="text-foreground">Add to Home Screen</strong>.
          </span>
        </p>
      ) : null}
      <Button size="sm" className="mt-3 w-full" onClick={install}>
        <Download />
        {deferred ? "Install app" : "How to install"}
      </Button>
    </div>
  );
}
