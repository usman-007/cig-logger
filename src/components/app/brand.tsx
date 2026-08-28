import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0f2b22] to-[#0a1a15] ring-1 ring-primary/25",
        className,
      )}
      aria-hidden
    >
      <span className="absolute size-2 rounded-full bg-primary shadow-[0_0_12px_2px_rgba(16,185,129,0.7)]" />
      <span className="absolute h-4 w-px translate-y-2 rounded-full bg-gradient-to-b from-primary/50 to-transparent" />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight">Ash</span>
        <span className="text-[10px] uppercase tracking-[0.16em] text-subtle-foreground">
          Habit tracker
        </span>
      </span>
    </span>
  );
}
