"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "default" | "good" | "warning" | "critical";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
  actions: { label: string; onClick: () => void }[];
  duration: number;
}

interface ToastInput {
  title: string;
  description?: string;
  tone?: Tone;
  /** up to two inline actions, e.g. Undo + Add tag */
  actions?: { label: string; onClick: () => void }[];
  duration?: number;
}

const ToastContext = React.createContext<{
  toast: (input: ToastInput) => void;
} | null>(null);

const toneStyles: Record<Tone, string> = {
  default: "border-border bg-popover",
  good: "border-primary/35 bg-[#0f1f1a]",
  warning: "border-warning/35 bg-[#211b0d]",
  critical: "border-critical/35 bg-[#201214]",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (input: ToastInput) => {
      idRef.current += 1;
      const item: ToastItem = {
        id: idRef.current,
        title: input.title,
        description: input.description,
        tone: input.tone ?? "default",
        actions: (input.actions ?? []).slice(0, 2),
        duration: input.duration ?? 4200,
      };
      setItems((prev) => [...prev.slice(-2), item]);
      window.setTimeout(() => dismiss(item.id), item.duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-3 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:pb-6 md:items-end md:pr-6">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-3.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.95)] animate-slide-up",
              toneStyles[item.tone],
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
            </div>
            {item.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  action.onClick();
                  dismiss(item.id);
                }}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                {action.label}
              </button>
            ))}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(item.id)}
              className="shrink-0 rounded-lg p-1 text-subtle-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
