"use client";

import * as React from "react";
import { Cigarette, SlidersHorizontal } from "lucide-react";
import { useLogController } from "./log-controller";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { clamp } from "@/lib/utils";

/**
 * The one control that has to work everywhere: tap to log now, press-and-hold
 * (or use the small satellite) for the detailed sheet. The ring around it fills
 * as the pacing interval elapses, so the pacing state is readable at a glance.
 */
export function LogFab() {
  const { quickLog, openCustom } = useLogController();
  const { settings, msSinceLast, msUntilPaced } = useStore();
  const holdTimer = React.useRef<number | null>(null);
  const held = React.useRef(false);
  const [pressed, setPressed] = React.useState(false);

  const pacingMs = Math.max(1, settings.pacingMinutes * 60_000);
  const progress =
    msSinceLast === null ? 1 : clamp(msSinceLast / pacingMs, 0, 1);
  const paced = msUntilPaced === 0;
  const ringColor = paced ? "var(--primary)" : "var(--accent-amber)";

  const startHold = () => {
    held.current = false;
    setPressed(true);
    holdTimer.current = window.setTimeout(() => {
      held.current = true;
      if (navigator.vibrate) navigator.vibrate(18);
      openCustom();
    }, 550);
  };

  const endHold = () => {
    setPressed(false);
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  React.useEffect(() => () => endHold(), []);

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-40 flex flex-col items-end gap-2.5 p-4 pb-[calc(env(safe-area-inset-bottom)+5.25rem)] md:pb-8 md:pr-8">
      <button
        type="button"
        onClick={() => openCustom()}
        aria-label="Log with details"
        className="pointer-events-auto flex size-11 items-center justify-center rounded-full border border-border bg-popover/95 text-muted-foreground shadow-[0_10px_30px_-12px_rgba(0,0,0,0.95)] backdrop-blur transition-all hover:text-foreground active:scale-95"
      >
        <SlidersHorizontal className="size-4.5" />
      </button>

      <div className="pointer-events-auto relative">
        <div
          aria-hidden
          className="absolute -inset-1 rounded-full transition-[background] duration-500"
          style={{
            background: `conic-gradient(${ringColor} ${progress * 360}deg, rgba(255,255,255,0.07) 0deg)`,
            mask: "radial-gradient(closest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
            WebkitMask:
              "radial-gradient(closest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (held.current) return;
            quickLog();
          }}
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Log a cigarette now. Press and hold for details."
          className={cn(
            "relative flex size-16 select-none flex-col items-center justify-center gap-0.5 rounded-full bg-primary font-semibold text-primary-foreground",
            "shadow-[0_16px_40px_-12px_rgba(16,185,129,0.9)] transition-transform duration-150",
            pressed ? "scale-[0.94]" : "hover:scale-[1.03]",
            paced && "animate-pulse-ring",
          )}
        >
          <Cigarette className="size-6" />
          <span className="text-[10px] font-bold uppercase tracking-wide">Log</span>
        </button>
      </div>
    </div>
  );
}
