"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { PURCHASE_CATEGORIES, PURCHASE_CATEGORY_MAP } from "@/lib/constants";
import { fromDayKey, toDateInput } from "@/lib/date";
import { formatUnitCost } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Purchase, PurchaseCategory } from "@/lib/types";

/** Mounted only while open (and keyed by entry), so the form starts correct. */
export function PurchaseModal({
  purchase,
  onClose,
}: {
  purchase: Purchase | null;
  onClose: () => void;
}) {
  const { settings, addPurchase, updatePurchase, deletePurchase, todayStart } =
    useStore();
  const { toast } = useToast();

  const [category, setCategory] = React.useState<PurchaseCategory>(
    () => purchase?.category ?? "pack",
  );
  const [name, setName] = React.useState(() => purchase?.name ?? "");
  const [cost, setCost] = React.useState(() => (purchase ? `${purchase.cost}` : ""));
  const [quantity, setQuantity] = React.useState(() =>
    purchase ? `${purchase.quantity}` : "1",
  );
  const [unitsPerItem, setUnitsPerItem] = React.useState(
    () =>
      `${
        purchase?.unitsPerItem ??
        (purchase?.category === "carton"
          ? settings.packsPerCarton
          : settings.cigarettesPerPack)
      }`,
  );
  const [date, setDate] = React.useState(() =>
    toDateInput(purchase?.ts ?? todayStart),
  );

  const meta = PURCHASE_CATEGORY_MAP[category];
  const costNum = Number(cost) || 0;
  const qtyNum = Number(quantity) || 0;
  const unitsNum = Number(unitsPerItem) || 0;

  const perUnit = React.useMemo(() => {
    if (costNum <= 0 || qtyNum <= 0) return null;
    switch (category) {
      case "pack":
        return {
          label: "per cigarette",
          value: costNum / (qtyNum * Math.max(1, unitsNum)),
        };
      case "carton":
        return {
          label: "per cigarette",
          value:
            costNum / (qtyNum * Math.max(1, unitsNum) * settings.cigarettesPerPack),
        };
      case "tobacco":
        return {
          label: `per roll (${settings.gramsPerRoll}g)`,
          value: (costNum / qtyNum) * settings.gramsPerRoll,
        };
      case "papers":
        return { label: "per sheet", value: costNum / qtyNum };
      case "filters":
        return { label: "per filter", value: costNum / qtyNum };
      default:
        return { label: `per ${meta.unit}`, value: costNum / qtyNum };
    }
  }, [category, costNum, qtyNum, unitsNum, meta.unit, settings.cigarettesPerPack, settings.gramsPerRoll]);

  const valid = costNum > 0 && qtyNum > 0;

  const submit = () => {
    const payload = {
      ts: fromDayKey(date).getTime(),
      category,
      name: name.trim() || meta.label,
      cost: costNum,
      quantity: qtyNum,
      unitsPerItem:
        category === "pack" || category === "carton" ? unitsNum : undefined,
    };
    if (purchase) {
      updatePurchase(purchase.id, payload);
      toast({ title: "Purchase updated", tone: "good" });
    } else {
      addPurchase(payload);
      toast({ title: "Purchase logged", tone: "good" });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{purchase ? "Edit purchase" : "Log a purchase"}</DialogTitle>
          <DialogDescription>
            Packs and supplies feed the cost-per-cigarette maths.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 pb-3">
          <Field label="What did you buy?">
            <Select
              value={category}
              onChange={(e) => {
                const next = e.target.value as PurchaseCategory;
                setCategory(next);
                setUnitsPerItem(
                  `${next === "carton" ? settings.packsPerCarton : settings.cigarettesPerPack}`,
                );
              }}
            >
              {PURCHASE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji}  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Brand or name" hint="optional">
            <Input
              value={name}
              placeholder={
                category === "tobacco" ? "e.g. Pueblo Blue" : "e.g. Marlboro Gold"
              }
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Total cost (${settings.currency})`}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={cost}
                placeholder="0.00"
                onChange={(e) => setCost(e.target.value)}
              />
            </Field>
            <Field label={meta.quantityLabel}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={category === "tobacco" ? "0.1" : "1"}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
          </div>

          {category === "pack" || category === "carton" ? (
            <Field
              label={category === "pack" ? "Cigarettes per pack" : "Packs per carton"}
            >
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={unitsPerItem}
                onChange={(e) => setUnitsPerItem(e.target.value)}
              />
            </Field>
          ) : null}

          <Field label="Purchase date">
            <Input
              type="date"
              value={date}
              max={toDateInput(todayStart)}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          {perUnit ? (
            <p className="rounded-xl border border-primary/25 bg-primary/[0.06] px-3.5 py-2.5 text-[13px] text-muted-foreground">
              Works out to{" "}
              <strong className="font-semibold text-primary tabular">
                {formatUnitCost(perUnit.value, settings.currency)}
              </strong>{" "}
              {perUnit.label}.
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter className="sm:justify-between">
          {purchase ? (
            <Button
              variant="danger"
              className="sm:mr-auto"
              onClick={() => {
                deletePurchase(purchase.id);
                toast({ title: "Purchase deleted" });
                onClose();
              }}
            >
              <Trash2 />
              Delete
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 sm:flex-none"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button className="flex-1 sm:flex-none" disabled={!valid} onClick={submit}>
              {purchase ? "Save changes" : "Add purchase"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
