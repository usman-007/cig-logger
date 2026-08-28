"use client";

import { tooltipSurface } from "@/lib/chart-theme";

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export function ChartTooltip({
  title,
  rows,
  note,
}: {
  title: string;
  rows: TooltipRow[];
  note?: string;
}) {
  return (
    <div style={tooltipSurface}>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">
        {title}
      </p>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2 tabular">
          {row.color ? (
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: row.color }}
            />
          ) : null}
          <span className="text-muted-foreground">{row.label}</span>
          <span className="ml-auto font-medium text-foreground">{row.value}</span>
        </div>
      ))}
      {note ? (
        <p className="mt-1 text-[11px] text-subtle-foreground">{note}</p>
      ) : null}
    </div>
  );
}
