import type { PurchaseCategory, SmokeType, Settings, TriggerId } from "./types";

/**
 * Trigger slot order is load-bearing: the colours in globals.css
 * (--trigger-1 … --trigger-8) were validated as an ordered categorical
 * palette against the #141b23 chart surface. Colour follows the trigger,
 * never its rank — reorder this list only by re-running the validator.
 */
export const TRIGGERS: {
  id: TriggerId;
  label: string;
  short: string;
  emoji: string;
  slot: number;
}[] = [
  { id: "stress", label: "Stress", short: "Stress", emoji: "😤", slot: 1 },
  { id: "boredom", label: "Boredom", short: "Bored", emoji: "🥱", slot: 2 },
  { id: "social", label: "Social", short: "Social", emoji: "👥", slot: 3 },
  { id: "coffee", label: "Coffee", short: "Coffee", emoji: "☕", slot: 4 },
  { id: "alcohol", label: "Alcohol", short: "Drinks", emoji: "🍺", slot: 5 },
  { id: "after_meal", label: "After a meal", short: "Post-meal", emoji: "🍽️", slot: 6 },
  { id: "work_break", label: "Work break", short: "Break", emoji: "💻", slot: 7 },
  { id: "other", label: "Other", short: "Other", emoji: "•", slot: 8 },
];

export const TRIGGER_MAP = Object.fromEntries(
  TRIGGERS.map((t) => [t.id, t]),
) as Record<TriggerId, (typeof TRIGGERS)[number]>;

export const SMOKE_TYPES: { id: SmokeType; label: string; hint: string }[] = [
  { id: "factory", label: "Factory", hint: "Pre-made cigarette" },
  { id: "rolled", label: "Hand-rolled", hint: "Loose tobacco" },
];

export const PURCHASE_CATEGORIES: {
  id: PurchaseCategory;
  label: string;
  unit: string;
  unitPlural: string;
  /** what the "quantity" field means for this category */
  quantityLabel: string;
  emoji: string;
}[] = [
  { id: "pack", label: "Cigarette pack", unit: "pack", unitPlural: "packs", quantityLabel: "Packs bought", emoji: "🚬" },
  { id: "carton", label: "Carton", unit: "carton", unitPlural: "cartons", quantityLabel: "Cartons bought", emoji: "📦" },
  { id: "tobacco", label: "Loose tobacco", unit: "g", unitPlural: "g", quantityLabel: "Grams", emoji: "🌿" },
  { id: "papers", label: "Rolling papers", unit: "sheet", unitPlural: "sheets", quantityLabel: "Sheets", emoji: "📄" },
  { id: "filters", label: "Filters / tips", unit: "filter", unitPlural: "filters", quantityLabel: "Filters", emoji: "⚪" },
  { id: "other", label: "Other supply", unit: "item", unitPlural: "items", quantityLabel: "Items", emoji: "🧰" },
];

export const PURCHASE_CATEGORY_MAP = Object.fromEntries(
  PURCHASE_CATEGORIES.map((c) => [c.id, c]),
) as Record<PurchaseCategory, (typeof PURCHASE_CATEGORIES)[number]>;

export const CURRENCIES = ["$", "€", "£", "₹", "R", "kr", "zł", "¥", "A$", "C$"];

export const DEFAULT_SETTINGS: Settings = {
  dailyLimit: 10,
  pacingMinutes: 60,
  currency: "$",
  cigarettesPerPack: 20,
  packsPerCarton: 10,
  gramsPerRoll: 0.7,
  defaultType: "factory",
  fallbackPackPrice: 9,
  askTriggerAfterQuickLog: true,
  pacingWarnings: true,
};

export const STORAGE_KEYS = {
  accounts: "ash:accounts",
  session: "ash:session",
  data: (userId: string) => `ash:data:${userId}`,
} as const;

export const GUEST_USER_ID = "guest";
