import { PURCHASE_CATEGORIES, SMOKE_TYPES, TRIGGERS } from "@/lib/constants";
import type {
  CigaretteLog,
  Purchase,
  PurchaseCategory,
  Settings,
  SmokeType,
  TriggerId,
} from "@/lib/types";
import {
  boolean,
  epochMs,
  literal,
  number,
  optionalText,
  record,
  text,
  uuid,
} from "./validate";

// Derived from the same constants the UI renders, so a new trigger or purchase
// category can never be accepted by the UI and rejected by the API.
const SMOKE_TYPE_IDS = SMOKE_TYPES.map((t) => t.id) as SmokeType[];
const TRIGGER_IDS = TRIGGERS.map((t) => t.id) as TriggerId[];
const CATEGORY_IDS = PURCHASE_CATEGORIES.map((c) => c.id) as PurchaseCategory[];

const CURRENCY_MAX = 4;
const NAME_MAX = 120;
const NOTE_MAX = 500;

export interface LogInput {
  id: string;
  ts: number;
  type: SmokeType;
  trigger: TriggerId | null;
  note: string | null;
}

export function parseLogCreate(body: unknown): LogInput {
  const b = record(body);
  return {
    id: uuid(b.id, "id"),
    ts: epochMs(b.ts, "ts"),
    type: literal(b.type, SMOKE_TYPE_IDS, "type"),
    trigger:
      b.trigger === null || b.trigger === undefined
        ? null
        : literal(b.trigger, TRIGGER_IDS, "trigger"),
    note: optionalText(b.note, "note", NOTE_MAX),
  };
}

/** Only the keys actually present are returned, so PATCH stays partial. */
export function parseLogPatch(body: unknown) {
  const b = record(body);
  const patch: Partial<Omit<LogInput, "id">> = {};
  if (b.ts !== undefined) patch.ts = epochMs(b.ts, "ts");
  if (b.type !== undefined) patch.type = literal(b.type, SMOKE_TYPE_IDS, "type");
  if (b.trigger !== undefined)
    patch.trigger =
      b.trigger === null ? null : literal(b.trigger, TRIGGER_IDS, "trigger");
  if (b.note !== undefined) patch.note = optionalText(b.note, "note", NOTE_MAX);
  return patch;
}

export interface PurchaseInput {
  id: string;
  ts: number;
  category: PurchaseCategory;
  name: string;
  cost: number;
  quantity: number;
  unitsPerItem: number | null;
  note: string | null;
}

export function parsePurchaseCreate(body: unknown): PurchaseInput {
  const b = record(body);
  return {
    id: uuid(b.id, "id"),
    ts: epochMs(b.ts, "ts"),
    category: literal(b.category, CATEGORY_IDS, "category"),
    name: text(b.name ?? "", "name", { max: NAME_MAX }),
    cost: number(b.cost, "cost", { min: 0, max: 1_000_000 }),
    quantity: number(b.quantity, "quantity", { min: 0.001, max: 1_000_000 }),
    unitsPerItem:
      b.unitsPerItem === null || b.unitsPerItem === undefined
        ? null
        : number(b.unitsPerItem, "unitsPerItem", {
            min: 1,
            max: 10_000,
            integer: true,
          }),
    note: optionalText(b.note, "note", NOTE_MAX),
  };
}

export function parsePurchasePatch(body: unknown) {
  const b = record(body);
  const patch: Partial<Omit<PurchaseInput, "id">> = {};
  if (b.ts !== undefined) patch.ts = epochMs(b.ts, "ts");
  if (b.category !== undefined)
    patch.category = literal(b.category, CATEGORY_IDS, "category");
  if (b.name !== undefined) patch.name = text(b.name, "name", { max: NAME_MAX });
  if (b.cost !== undefined)
    patch.cost = number(b.cost, "cost", { min: 0, max: 1_000_000 });
  if (b.quantity !== undefined)
    patch.quantity = number(b.quantity, "quantity", {
      min: 0.001,
      max: 1_000_000,
    });
  if (b.unitsPerItem !== undefined)
    patch.unitsPerItem =
      b.unitsPerItem === null
        ? null
        : number(b.unitsPerItem, "unitsPerItem", {
            min: 1,
            max: 10_000,
            integer: true,
          });
  if (b.note !== undefined) patch.note = optionalText(b.note, "note", NOTE_MAX);
  return patch;
}

/** Bounds mirror the CHECK constraints in the init migration. */
export function parseSettingsPatch(body: unknown): Partial<Settings> {
  const b = record(body);
  const patch: Partial<Settings> = {};
  if (b.dailyLimit !== undefined)
    patch.dailyLimit = number(b.dailyLimit, "dailyLimit", {
      min: 1,
      max: 200,
      integer: true,
    });
  if (b.pacingMinutes !== undefined)
    patch.pacingMinutes = number(b.pacingMinutes, "pacingMinutes", {
      min: 1,
      max: 1440,
      integer: true,
    });
  if (b.currency !== undefined)
    patch.currency = text(b.currency, "currency", {
      max: CURRENCY_MAX,
      allowEmpty: false,
    });
  if (b.cigarettesPerPack !== undefined)
    patch.cigarettesPerPack = number(b.cigarettesPerPack, "cigarettesPerPack", {
      min: 1,
      max: 100,
      integer: true,
    });
  if (b.packsPerCarton !== undefined)
    patch.packsPerCarton = number(b.packsPerCarton, "packsPerCarton", {
      min: 1,
      max: 100,
      integer: true,
    });
  if (b.gramsPerRoll !== undefined)
    patch.gramsPerRoll = number(b.gramsPerRoll, "gramsPerRoll", {
      min: 0.01,
      max: 100,
    });
  if (b.defaultType !== undefined)
    patch.defaultType = literal(b.defaultType, SMOKE_TYPE_IDS, "defaultType");
  if (b.fallbackPackPrice !== undefined)
    patch.fallbackPackPrice = number(b.fallbackPackPrice, "fallbackPackPrice", {
      min: 0,
      max: 100_000,
    });
  if (b.askTriggerAfterQuickLog !== undefined)
    patch.askTriggerAfterQuickLog = boolean(
      b.askTriggerAfterQuickLog,
      "askTriggerAfterQuickLog",
    );
  if (b.pacingWarnings !== undefined)
    patch.pacingWarnings = boolean(b.pacingWarnings, "pacingWarnings");
  return patch;
}

export interface ImportInput {
  logs: CigaretteLog[];
  purchases: Purchase[];
  settings: Partial<Settings>;
  startedAt: number | null;
}

const IMPORT_MAX_ROWS = 50_000;

/**
 * Used by both the Settings import button and the guest → account handover.
 * Entries without a UUID id (anything exported by the old localStorage build,
 * which used `cig_...` ids) get a fresh one rather than being rejected.
 */
export function parseImport(body: unknown): ImportInput {
  const b = record(body);
  const rawLogs = Array.isArray(b.logs) ? b.logs : [];
  const rawPurchases = Array.isArray(b.purchases) ? b.purchases : [];

  if (rawLogs.length + rawPurchases.length > IMPORT_MAX_ROWS)
    throw new Error(`Import is limited to ${IMPORT_MAX_ROWS} entries.`);

  const logs = rawLogs.map((entry) => {
    const e = record(entry, "Each log");
    const parsed = parseLogCreate({ ...e, id: coerceId(e.id) });
    return {
      id: parsed.id,
      ts: parsed.ts,
      type: parsed.type,
      trigger: parsed.trigger,
      note: parsed.note ?? undefined,
      createdAt:
        e.createdAt === undefined ? parsed.ts : epochMs(e.createdAt, "createdAt"),
    } satisfies CigaretteLog;
  });

  const purchases = rawPurchases.map((entry) => {
    const e = record(entry, "Each purchase");
    const parsed = parsePurchaseCreate({ ...e, id: coerceId(e.id) });
    return {
      id: parsed.id,
      ts: parsed.ts,
      category: parsed.category,
      name: parsed.name,
      cost: parsed.cost,
      quantity: parsed.quantity,
      unitsPerItem: parsed.unitsPerItem ?? undefined,
      note: parsed.note ?? undefined,
      createdAt:
        e.createdAt === undefined ? parsed.ts : epochMs(e.createdAt, "createdAt"),
    } satisfies Purchase;
  });

  return {
    logs,
    purchases,
    settings: b.settings === undefined ? {} : parseSettingsPatch(b.settings),
    startedAt:
      b.startedAt === undefined || b.startedAt === null
        ? null
        : epochMs(b.startedAt, "startedAt"),
  };
}

function coerceId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)
    ? value
    : crypto.randomUUID();
}
