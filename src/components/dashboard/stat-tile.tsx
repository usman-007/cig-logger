import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "primary" | "amber" | "rose";
  className?: string;
}) {
  const valueTone = {
    default: "text-foreground",
    primary: "text-primary",
    amber: "text-amber",
    rose: "text-rose",
  }[tone];

  return (
    <div className={cn("rounded-xl border border-border bg-white/[0.02] p-3.5", className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.07em] text-subtle-foreground">
        {icon}
        {label}
      </div>
      <p className={cn("mt-1.5 flex items-baseline gap-1 text-xl font-semibold tabular", valueTone)}>
        {value}
        {unit ? (
          <span className="text-xs font-medium text-subtle-foreground">{unit}</span>
        ) : null}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[12px] leading-snug text-subtle-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
