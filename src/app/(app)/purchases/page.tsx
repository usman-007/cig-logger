"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, Plus, Receipt } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PurchaseModal } from "@/components/purchases/purchase-modal";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PURCHASE_CATEGORY_MAP } from "@/lib/constants";
import { formatDate } from "@/lib/date";
import { formatMoney, formatUnitCost, pluralize } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Purchase } from "@/lib/types";

export default function PurchasesPage() {
  return (
    <Suspense fallback={null}>
      <Purchases />
    </Suspense>
  );
}

function Purchases() {
  const { purchases, logs, settings, unitCosts } = useStore();
  const params = useSearchParams();
  const router = useRouter();

  const [modal, setModal] = React.useState<{
    key: number;
    purchase: Purchase | null;
  } | null>(null);

  // Manifest shortcut: /purchases?action=new
  const fired = React.useRef(false);
  React.useEffect(() => {
    if (fired.current || params.get("action") !== "new") return;
    fired.current = true;
    setModal({ key: Date.now(), purchase: null });
    router.replace("/purchases");
  }, [params, router]);

  const currency = settings.currency;

  // Rough stock left: what was bought minus what has been logged since.
  const stock = React.useMemo(() => {
    const factorySmoked = logs.filter((l) => l.type === "factory").length;
    const rolled = logs.filter((l) => l.type === "rolled").length;
    return {
      cigarettes: unitCosts.totals.cigarettesBought - factorySmoked,
      tobacco: unitCosts.totals.tobaccoGrams - rolled * settings.gramsPerRoll,
      papers: unitCosts.totals.papers - rolled,
      filters: unitCosts.totals.filters - rolled,
    };
  }, [logs, unitCosts.totals, settings.gramsPerRoll]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Purchase[]>();
    for (const purchase of purchases) {
      const key = new Date(purchase.ts).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
      map.set(key, [...(map.get(key) ?? []), purchase]);
    }
    return [...map.entries()];
  }, [purchases]);

  const openNew = () => setModal({ key: Date.now(), purchase: null });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Spend"
        description="Log what you buy — Ash turns it into a real cost per cigarette."
        action={
          <Button size="sm" onClick={openNew} className="mt-1 shrink-0">
            <Plus />
            Add
          </Button>
        }
      />

      <Card>
        <CardContent className="p-5">
          <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Unit economics
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Per factory cig"
              value={formatUnitCost(unitCosts.perFactory, currency)}
              hint={
                unitCosts.sources.factory
                  ? `${unitCosts.totals.cigarettesBought} bought all-time`
                  : "estimated from settings"
              }
            />
            <StatTile
              label="Per roll-up"
              value={formatUnitCost(unitCosts.perRolled, currency)}
              hint={
                unitCosts.sources.tobacco
                  ? `${settings.gramsPerRoll}g + paper + filter`
                  : "add tobacco to refine"
              }
              tone="amber"
            />
            <StatTile
              label="Total spend"
              value={formatMoney(unitCosts.totals.spend, currency)}
              hint={pluralize(purchases.length, "purchase")}
            />
            <StatTile
              label="Per gram"
              value={
                unitCosts.perGramTobacco > 0
                  ? formatUnitCost(unitCosts.perGramTobacco, currency)
                  : "—"
              }
              hint={
                unitCosts.totals.tobaccoGrams > 0
                  ? `${unitCosts.totals.tobaccoGrams}g bought`
                  : "no tobacco logged"
              }
            />
          </div>

          {unitCosts.sources.tobacco ? (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-border bg-white/[0.02] px-3.5 py-2.5 text-[12px] text-subtle-foreground">
              <span>
                Tobacco{" "}
                <strong className="text-muted-foreground tabular">
                  {formatUnitCost(unitCosts.perGramTobacco * settings.gramsPerRoll, currency)}
                </strong>
              </span>
              <span>
                Paper{" "}
                <strong className="text-muted-foreground tabular">
                  {formatUnitCost(unitCosts.perPaper, currency)}
                </strong>
              </span>
              <span>
                Filter{" "}
                <strong className="text-muted-foreground tabular">
                  {formatUnitCost(unitCosts.perFilter, currency)}
                </strong>
              </span>
              <span className="text-subtle-foreground">= one roll-up</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {purchases.length > 0 ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Stock estimate
            </p>
            <p className="mt-1 text-sm text-subtle-foreground">
              Bought minus logged. Rough, but enough to see a resupply coming.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="Cigarettes"
                value={Math.max(0, Math.round(stock.cigarettes))}
                unit="left"
                tone={stock.cigarettes < 5 ? "rose" : "default"}
              />
              <StatTile
                label="Tobacco"
                value={Math.max(0, Math.round(stock.tobacco * 10) / 10)}
                unit="g"
                tone={stock.tobacco < 3 ? "rose" : "default"}
              />
              <StatTile
                label="Papers"
                value={Math.max(0, Math.round(stock.papers))}
                unit="sheets"
              />
              <StatTile
                label="Filters"
                value={Math.max(0, Math.round(stock.filters))}
                unit="tips"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {purchases.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-5" />}
          title="No purchases yet"
          description="Add a pack, a pouch of tobacco, papers or filters and every cost figure in the app sharpens up."
          action={
            <Button onClick={openNew}>
              <Plus />
              Log your first purchase
            </Button>
          }
        />
      ) : (
        grouped.map(([month, items]) => (
          <Card key={month}>
            <CardContent className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {month}
                </p>
                <p className="text-sm font-medium tabular">
                  {formatMoney(
                    items.reduce((a, p) => a + p.cost, 0),
                    currency,
                  )}
                </p>
              </div>
              <ul className="mt-2 divide-y divide-border/70">
                {items.map((purchase) => {
                  const meta = PURCHASE_CATEGORY_MAP[purchase.category];
                  return (
                    <li key={purchase.id}>
                      <button
                        type="button"
                        onClick={() => setModal({ key: Date.now(), purchase })}
                        className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-white/[0.02]"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-base">
                          {meta.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {purchase.name}
                          </span>
                          <span className="block truncate text-[12px] text-subtle-foreground">
                            {purchase.quantity} {meta.unitPlural}
                            {purchase.unitsPerItem
                              ? ` × ${purchase.unitsPerItem}`
                              : ""}{" "}
                            · {formatDate(purchase.ts)}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular">
                          {formatMoney(purchase.cost, currency)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))
      )}

      {purchases.length > 0 ? (
        <p className="flex items-center justify-center gap-2 pb-2 text-center text-[12px] text-subtle-foreground">
          <Package className="size-3.5" />
          Costs use lifetime averages, so prices update themselves as you buy.
        </p>
      ) : null}

      {modal ? (
        <PurchaseModal
          key={modal.key}
          purchase={modal.purchase}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  );
}
