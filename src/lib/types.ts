export type SmokeType = "factory" | "rolled";

export type TriggerId =
  | "stress"
  | "boredom"
  | "social"
  | "coffee"
  | "alcohol"
  | "after_meal"
  | "work_break"
  | "other";

export interface CigaretteLog {
  id: string;
  /** epoch ms of when the cigarette was smoked (editable) */
  ts: number;
  type: SmokeType;
  trigger: TriggerId | null;
  note?: string;
  /** epoch ms of when the row was created (never edited) */
  createdAt: number;
}

export type PurchaseCategory =
  | "pack"
  | "carton"
  | "tobacco"
  | "papers"
  | "filters"
  | "other";

export interface Purchase {
  id: string;
  /** epoch ms of the purchase date */
  ts: number;
  category: PurchaseCategory;
  /** free-text label, e.g. "Marlboro Gold" or "Pueblo 30g" */
  name: string;
  /** total amount paid, in the active currency */
  cost: number;
  /**
   * How many units were bought. The unit depends on the category:
   *  pack     -> packs
   *  carton   -> cartons
   *  tobacco  -> grams
   *  papers   -> sheets
   *  filters  -> filters
   *  other    -> items
   */
  quantity: number;
  /** cigarettes per pack (pack) or packs per carton (carton) */
  unitsPerItem?: number;
  note?: string;
  createdAt: number;
}

export interface Settings {
  /** target number of cigarettes per day */
  dailyLimit: number;
  /** minimum minutes the pacing timer wants between cigarettes */
  pacingMinutes: number;
  currency: string;
  cigarettesPerPack: number;
  packsPerCarton: number;
  /** grams of loose tobacco used per hand-rolled cigarette */
  gramsPerRoll: number;
  defaultType: SmokeType;
  /** fallback price used before any purchase has been logged */
  fallbackPackPrice: number;
  /** ask for a trigger tag right after a one-tap log */
  askTriggerAfterQuickLog: boolean;
  /** warn when logging sooner than the pacing interval */
  pacingWarnings: boolean;
}

export interface AppData {
  logs: CigaretteLog[];
  purchases: Purchase[];
  settings: Settings;
  /** epoch ms — when tracking began, used for lifetime averages */
  startedAt: number;
}

/**
 * The client's view of who is signed in. The authoritative session is a pair of
 * httpOnly Supabase cookies; this is a cache of the parts the UI renders.
 * `guest: true` means local-only preview mode, with no server-side account.
 */
export interface Session {
  userId: string;
  email: string;
  name: string;
  guest: boolean;
}
