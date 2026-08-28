import { DEFAULT_SETTINGS } from "@/lib/constants";
import type {
  CigaretteLog,
  Purchase,
  PurchaseCategory,
  Settings,
  SmokeType,
  TriggerId,
} from "@/lib/types";

/**
 * The only place epoch-ms ⇄ ISO and camelCase ⇄ snake_case conversion happens.
 *
 * src/lib/types.ts stays on epoch milliseconds because stats.ts, cost.ts,
 * date.ts and every chart are built on it. Postgres stores timestamptz. This
 * module is the seam, and nothing past it knows the database exists.
 */

export interface LogRow {
  id: string;
  user_id: string;
  smoked_at: string;
  type: SmokeType;
  trigger: TriggerId | null;
  note: string | null;
  created_at: string;
}

export interface PurchaseRow {
  id: string;
  user_id: string;
  purchased_at: string;
  category: PurchaseCategory;
  name: string;
  cost: number;
  quantity: number;
  units_per_item: number | null;
  note: string | null;
  created_at: string;
}

export interface SettingsRow {
  user_id: string;
  daily_limit: number;
  pacing_minutes: number;
  currency: string;
  cigarettes_per_pack: number;
  packs_per_carton: number;
  grams_per_roll: number;
  default_type: SmokeType;
  fallback_pack_price: number;
  ask_trigger_after_quick_log: boolean;
  pacing_warnings: boolean;
}

export interface ProfileRow {
  id: string;
  email: string;
  name: string;
  started_at: string;
}

const ms = (iso: string) => new Date(iso).getTime();
const iso = (epoch: number) => new Date(epoch).toISOString();

export function rowToLog(row: LogRow): CigaretteLog {
  return {
    id: row.id,
    ts: ms(row.smoked_at),
    type: row.type,
    trigger: row.trigger,
    // The client type uses `note?: string`, so null becomes undefined.
    note: row.note ?? undefined,
    createdAt: ms(row.created_at),
  };
}

export function logToRow(log: CigaretteLog, userId: string): LogRow {
  return {
    id: log.id,
    user_id: userId,
    smoked_at: iso(log.ts),
    type: log.type,
    trigger: log.trigger,
    note: log.note?.trim() || null,
    created_at: iso(log.createdAt),
  };
}

export function rowToPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    ts: ms(row.purchased_at),
    category: row.category,
    name: row.name,
    // numeric arrives as a JSON number, but coerce defensively — a driver that
    // hands back a string would otherwise poison every total in cost.ts.
    cost: Number(row.cost),
    quantity: Number(row.quantity),
    unitsPerItem: row.units_per_item ?? undefined,
    note: row.note ?? undefined,
    createdAt: ms(row.created_at),
  };
}

export function purchaseToRow(purchase: Purchase, userId: string): PurchaseRow {
  return {
    id: purchase.id,
    user_id: userId,
    purchased_at: iso(purchase.ts),
    category: purchase.category,
    name: purchase.name.trim(),
    cost: purchase.cost,
    quantity: purchase.quantity,
    units_per_item: purchase.unitsPerItem ?? null,
    note: purchase.note?.trim() || null,
    created_at: iso(purchase.createdAt),
  };
}

export function rowToSettings(row: SettingsRow | null): Settings {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    dailyLimit: row.daily_limit,
    pacingMinutes: row.pacing_minutes,
    currency: row.currency,
    cigarettesPerPack: row.cigarettes_per_pack,
    packsPerCarton: row.packs_per_carton,
    gramsPerRoll: Number(row.grams_per_roll),
    defaultType: row.default_type,
    fallbackPackPrice: Number(row.fallback_pack_price),
    askTriggerAfterQuickLog: row.ask_trigger_after_quick_log,
    pacingWarnings: row.pacing_warnings,
  };
}

const SETTINGS_COLUMNS: Record<keyof Settings, string> = {
  dailyLimit: "daily_limit",
  pacingMinutes: "pacing_minutes",
  currency: "currency",
  cigarettesPerPack: "cigarettes_per_pack",
  packsPerCarton: "packs_per_carton",
  gramsPerRoll: "grams_per_roll",
  defaultType: "default_type",
  fallbackPackPrice: "fallback_pack_price",
  askTriggerAfterQuickLog: "ask_trigger_after_quick_log",
  pacingWarnings: "pacing_warnings",
};

/** Partial<Settings> → the snake_case column patch, dropping absent keys. */
export function settingsToRow(patch: Partial<Settings>) {
  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(SETTINGS_COLUMNS)) {
    const value = patch[key as keyof Settings];
    if (value !== undefined) row[column] = value;
  }
  return row;
}
