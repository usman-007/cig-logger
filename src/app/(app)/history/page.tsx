"use client";

import * as React from "react";
import { Cigarette, Filter, ListFilter, Receipt, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { useLogController } from "@/components/app/log-controller";
import { PurchaseModal } from "@/components/purchases/purchase-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, EmptyState, Segmented } from "@/components/ui/misc";
import { triggerColor } from "@/lib/chart-theme";
import { PURCHASE_CATEGORY_MAP, TRIGGERS, TRIGGER_MAP } from "@/lib/constants";
import { unitCostFor } from "@/lib/cost";
import {
  addDays,
  dayKey,
  endOfDay,
  formatDayLabel,
  formatTime,
  fromDayKey,
  startOfDay,
  toDateInput,
} from "@/lib/date";
import { formatMoney, formatUnitCost, pluralize } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { CigaretteLog, Purchase, TriggerId } from "@/lib/types";
import { cn } from "@/lib/utils";

type RangeKey = "today" | "7" | "30" | "custom";
type TypeFilter = "all" | "cigarettes" | "supplies";

type Row =
  | { kind: "log"; ts: number; log: CigaretteLog }
  | { kind: "purchase"; ts: number; purchase: Purchase };

export default function HistoryPage() {
  const { logs, purchases, settings, unitCosts, todayStart } = useStore();
  const { openEdit } = useLogController();

  const [range, setRange] = React.useState<RangeKey>("7");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [triggerFilters, setTriggerFilters] = React.useState<TriggerId[]>([]);
  const [customFrom, setCustomFrom] = React.useState(() =>
    toDateInput(addDays(Date.now(), -14).getTime()),
  );
  const [customTo, setCustomTo] = React.useState(() => toDateInput(Date.now()));
  const todayInput = React.useMemo(() => toDateInput(todayStart), [todayStart]);
  const [purchaseModal, setPurchaseModal] = React.useState<{
    key: number;
    purchase: Purchase;
  } | null>(null);

  const bounds = React.useMemo(() => {
    if (range === "custom") {
      return {
        from: startOfDay(fromDayKey(customFrom)).getTime(),
        to: endOfDay(fromDayKey(customTo)).getTime(),
      };
    }
    const days = range === "today" ? 1 : Number(range);
    return {
      from: startOfDay(addDays(todayStart, -(days - 1))).getTime(),
      to: endOfDay(todayStart).getTime(),
    };
  }, [range, customFrom, customTo, todayStart]);

  const scopedLogs = React.useMemo(
    () =>
      logs.filter(
        (l) =>
          l.ts >= bounds.from &&
          l.ts <= bounds.to &&
          (triggerFilters.length === 0 ||
            (l.trigger !== null && triggerFilters.includes(l.trigger))),
      ),
    [logs, bounds, triggerFilters],
  );

  const scopedPurchases = React.useMemo(
    () => purchases.filter((p) => p.ts >= bounds.from && p.ts <= bounds.to),
    [purchases, bounds],
  );

  const rows = React.useMemo(() => {
    const items: Row[] = [];
    if (typeFilter !== "supplies") {
      items.push(...scopedLogs.map((log) => ({ kind: "log" as const, ts: log.ts, log })));
    }
    if (typeFilter !== "cigarettes" && triggerFilters.length === 0) {
      items.push(
        ...scopedPurchases.map((purchase) => ({
          kind: "purchase" as const,
          ts: purchase.ts,
          purchase,
        })),
      );
    }
    return items.sort((a, b) => b.ts - a.ts);
  }, [scopedLogs, scopedPurchases, typeFilter, triggerFilters.length]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const key = dayKey(row.ts);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()];
  }, [rows]);

  const spend = scopedLogs.reduce((a, l) => a + unitCostFor(l.type, unitCosts), 0);
  const filtersActive =
    range !== "7" || typeFilter !== "all" || triggerFilters.length > 0;

  const toggleTrigger = (id: TriggerId) =>
    setTriggerFilters((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );

  return (
    <div className="space-y-4">
      <PageHeader
        title="History"
        description="Every entry, filterable and editable."
        action={
          filtersActive ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 shrink-0"
              onClick={() => {
                setRange("7");
                setTypeFilter("all");
                setTriggerFilters([]);
              }}
            >
              <X />
              Clear
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
            <Filter className="size-3.5" />
            Filters
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date range">
              <Select
                value={range}
                onChange={(e) => setRange(e.target.value as RangeKey)}
              >
                <option value="today">Today</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="custom">Custom range</option>
              </Select>
            </Field>
            <Field label="Type">
              <Segmented
                size="sm"
                className="h-12"
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "cigarettes", label: "Cigarettes" },
                  { value: "supplies", label: "Supplies" },
                ]}
              />
            </Field>
          </div>

          {range === "custom" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <Input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </Field>
              <Field label="To">
                <Input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={todayInput}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {typeFilter !== "supplies" ? (
            <div className="space-y-2">
              <p className="text-[13px] font-medium text-muted-foreground">Triggers</p>
              <div className="flex flex-wrap gap-1.5">
                {TRIGGERS.map((trigger) => {
                  const active = triggerFilters.includes(trigger.id);
                  return (
                    <button
                      key={trigger.id}
                      type="button"
                      onClick={() => toggleTrigger(trigger.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-all active:scale-[0.97]",
                        active
                          ? "border-transparent text-foreground"
                          : "border-border bg-white/[0.03] text-muted-foreground hover:text-foreground",
                      )}
                      style={
                        active
                          ? {
                              backgroundColor: `${triggerColor(trigger.id)}26`,
                              boxShadow: `inset 0 0 0 1px ${triggerColor(trigger.id)}`,
                            }
                          : undefined
                      }
                    >
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ background: triggerColor(trigger.id) }}
                      />
                      {trigger.short}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">
          <Cigarette className="size-3.5" />
          {pluralize(scopedLogs.length, "cigarette")}
        </Badge>
        <Badge tone="neutral">{formatMoney(spend, settings.currency)} smoked</Badge>
        {typeFilter !== "cigarettes" ? (
          <Badge tone="neutral">
            <Receipt className="size-3.5" />
            {pluralize(scopedPurchases.length, "purchase")}
          </Badge>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ListFilter className="size-5" />}
          title="Nothing in this range"
          description="Try a wider date range or clear the trigger filters."
        />
      ) : (
        grouped.map(([key, items]) => {
          const dayLogs = items.filter((r) => r.kind === "log");
          return (
            <Card key={key}>
              <CardContent className="p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {formatDayLabel(fromDayKey(key))}
                  </p>
                  <p className="text-[12px] text-subtle-foreground">
                    {dayLogs.length > 0
                      ? `${dayLogs.length} smoked${
                          dayLogs.length > settings.dailyLimit
                            ? ` · ${dayLogs.length - settings.dailyLimit} over target`
                            : ""
                        }`
                      : "no cigarettes"}
                  </p>
                </div>

                <ul className="mt-2 divide-y divide-border/70">
                  {items.map((row) =>
                    row.kind === "log" ? (
                      <li key={row.log.id}>
                        <button
                          type="button"
                          onClick={() => openEdit(row.log)}
                          className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-white/[0.02]"
                        >
                          <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-full"
                            style={{
                              background: row.log.trigger
                                ? triggerColor(row.log.trigger)
                                : "#4a5867",
                            }}
                          />
                          <span className="w-16 shrink-0 text-sm font-medium tabular">
                            {formatTime(row.log.ts)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                            {row.log.trigger
                              ? TRIGGER_MAP[row.log.trigger].label
                              : "Untagged"}
                            <span className="text-subtle-foreground">
                              {" · "}
                              {row.log.type === "rolled" ? "Roll-up" : "Factory"}
                            </span>
                            {row.log.note ? (
                              <span className="text-subtle-foreground">
                                {" · "}
                                {row.log.note}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-[12px] text-subtle-foreground tabular">
                            {formatUnitCost(
                              unitCostFor(row.log.type, unitCosts),
                              settings.currency,
                            )}
                          </span>
                        </button>
                      </li>
                    ) : (
                      <li key={row.purchase.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setPurchaseModal({
                              key: Date.now(),
                              purchase: row.purchase,
                            })
                          }
                          className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-white/[0.02]"
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center text-sm">
                            {PURCHASE_CATEGORY_MAP[row.purchase.category].emoji}
                          </span>
                          <span className="w-16 shrink-0 text-sm font-medium text-primary">
                            Bought
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                            {row.purchase.name}
                            <span className="text-subtle-foreground">
                              {" · "}
                              {row.purchase.quantity}{" "}
                              {PURCHASE_CATEGORY_MAP[row.purchase.category].unitPlural}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular">
                            {formatMoney(row.purchase.cost, settings.currency)}
                          </span>
                        </button>
                      </li>
                    ),
                  )}
                </ul>
              </CardContent>
            </Card>
          );
        })
      )}

      {purchaseModal ? (
        <PurchaseModal
          key={purchaseModal.key}
          purchase={purchaseModal.purchase}
          onClose={() => setPurchaseModal(null)}
        />
      ) : null}
    </div>
  );
}
