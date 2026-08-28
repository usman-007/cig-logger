"use client";

import Link from "next/link";
import { ArrowRight, PiggyBank, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "./stat-tile";
import { formatMoney, formatUnitCost } from "@/lib/format";
import type { UnitCosts } from "@/lib/cost";
import type { MoneyStats } from "@/lib/stats";
import type { Settings } from "@/lib/types";

export function MoneyCard({
  money,
  costs,
  settings,
}: {
  money: MoneyStats;
  costs: UnitCosts;
  settings: Settings;
}) {
  const currency = settings.currency;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Money
          </p>
          <Link
            href="/purchases"
            className="flex items-center gap-1 text-[13px] text-primary hover:underline"
          >
            Purchases
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[3rem] font-semibold leading-none tabular">
              {formatMoney(money.spentToday, currency)}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">spent today</p>
          </div>
          <div className="pb-1 text-right">
            <p className="text-lg font-semibold tabular text-primary">
              {formatMoney(money.savedToday, currency)}
            </p>
            <p className="text-[11px] uppercase tracking-wider text-subtle-foreground">
              under target
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <StatTile
            icon={<Wallet className="size-3" />}
            label="This week"
            value={formatMoney(money.spentWeek, currency)}
            hint={`${formatMoney(money.spentMonth, currency)} in 30 days`}
          />
          <StatTile
            icon={<PiggyBank className="size-3" />}
            label="Saved so far"
            value={formatMoney(money.savedTotal, currency)}
            tone="primary"
            hint="value of days under target"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-white/[0.02] px-3.5 py-2.5 text-[12px] text-subtle-foreground">
          <span>
            Factory{" "}
            <strong className="font-semibold text-muted-foreground tabular">
              {formatUnitCost(costs.perFactory, currency)}
            </strong>{" "}
            each
          </span>
          <span>
            Roll-up{" "}
            <strong className="font-semibold text-muted-foreground tabular">
              {formatUnitCost(costs.perRolled, currency)}
            </strong>{" "}
            each
          </span>
          {!costs.sources.factory ? (
            <span className="text-[11px]">estimated from settings</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
