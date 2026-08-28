"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { clock } from "./clock";
import { computeUnitCosts, type UnitCosts } from "./cost";
import { startOfDay } from "./date";
import { ashStore, emptyData } from "./persistence";
import { api } from "./api-client";
import * as auth from "./auth";
import type {
  AppData,
  CigaretteLog,
  Purchase,
  Session,
  Settings,
  SmokeType,
  TriggerId,
} from "./types";

export interface LogDraft {
  ts?: number;
  type?: SmokeType;
  trigger?: TriggerId | null;
  note?: string;
}

interface StoreValue {
  hydrated: boolean;
  /** a reconcile with the server is in flight */
  syncing: boolean;
  /** local changes not yet accepted by the server */
  pendingChanges: number;
  /** last sync problem worth surfacing, or null */
  syncError: string | null;
  session: Session | null;
  data: AppData;
  settings: Settings;
  logs: CigaretteLog[];
  purchases: Purchase[];
  unitCosts: UnitCosts;
  /** shared clock, ticking once a second — never call Date.now() in render */
  now: number;
  /** local midnight for `now`; stable across ticks, safe as a memo dependency */
  todayStart: number;
  /** ms since the most recent log, or null when nothing is logged yet */
  msSinceLast: number | null;
  lastLog: CigaretteLog | null;
  /** true when the previous cigarette was closer than the pacing interval */
  pacingBreached: boolean;
  msUntilPaced: number;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  /** resolves `true` when the account still needs its email confirmed */
  signUp: (input: {
    email: string;
    password: string;
    name?: string;
  }) => Promise<boolean>;
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
  /** re-pull everything from the server */
  refresh: () => Promise<void>;
  addLog: (draft?: LogDraft) => CigaretteLog;
  updateLog: (id: string, patch: Partial<Omit<CigaretteLog, "id" | "createdAt">>) => void;
  deleteLog: (id: string) => void;
  addPurchase: (input: Omit<Purchase, "id" | "createdAt">) => Purchase;
  updatePurchase: (id: string, patch: Partial<Omit<Purchase, "id" | "createdAt">>) => void;
  deletePurchase: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetData: () => void;
  exportData: () => string;
  importData: (json: string) => Promise<void>;
}

/**
 * Moves a guest's local dataset onto the account they just created or signed
 * into. "merge" rather than "replace": signing in on a device that happened to
 * have preview data must never wipe what the account already holds.
 */
async function handoverGuestData() {
  if (!auth.guestHasData()) return;
  const guestData = auth.readGuestData();
  if (!guestData) return;
  try {
    await api({
      method: "POST",
      path: "/api/data/import",
      body: { ...guestData, mode: "merge" },
    });
    auth.clearGuestData();
  } catch {
    // Keep the local copy so the next sign-in can try again rather than
    // silently dropping entries the user made in preview mode.
  }
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(
    ashStore.subscribe,
    ashStore.getSnapshot,
    ashStore.getServerSnapshot,
  );
  const tick = useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getServerSnapshot,
  );
  const { session, data } = snapshot;
  // Before the first tick lands, fall back to the newest log so the UI never
  // renders a nonsensical negative gap.
  const now = tick || data.startedAt;

  const signIn = useCallback(async (input: { email: string; password: string }) => {
    const next = await auth.signIn(input);
    ashStore.enterSession(next);
    await handoverGuestData();
    await ashStore.refresh();
  }, []);

  const signUp = useCallback(
    async (input: { email: string; password: string; name?: string }) => {
      const { session: next, needsConfirmation } = await auth.signUp(input);
      // With email confirmation on there is no session yet; the caller shows
      // "check your inbox" and the guest data stays put until they land back.
      if (needsConfirmation || !next) return true;

      ashStore.enterSession(next);
      await handoverGuestData();
      await ashStore.refresh();
      return false;
    },
    [],
  );

  const continueAsGuest = useCallback(() => {
    ashStore.enterSession(auth.continueAsGuest());
  }, []);

  const signOut = useCallback(async () => {
    await auth.signOut();
    ashStore.clearSession();
  }, []);

  const refresh = useCallback(() => ashStore.refresh(), []);

  const addLog = useCallback((draft: LogDraft = {}) => {
    const log: CigaretteLog = {
      // A real UUID, generated here rather than server-side: it lets this
      // function stay synchronous for the FAB, and makes the outbox's retries
      // idempotent against the upsert in /api/logs.
      id: crypto.randomUUID(),
      ts: draft.ts ?? Date.now(),
      type: draft.type ?? ashStore.getSnapshot().data.settings.defaultType,
      trigger: draft.trigger ?? null,
      note: draft.note?.trim() || undefined,
      createdAt: Date.now(),
    };
    ashStore.update(
      (prev) => ({
        ...prev,
        logs: [log, ...prev.logs].sort((a, b) => b.ts - a.ts),
      }),
      { kind: "log.create", id: log.id, log },
    );
    return log;
  }, []);

  const updateLog = useCallback(
    (id: string, patch: Partial<Omit<CigaretteLog, "id" | "createdAt">>) => {
      ashStore.update(
        (prev) => ({
          ...prev,
          logs: prev.logs
            .map((l) => (l.id === id ? { ...l, ...patch } : l))
            .sort((a, b) => b.ts - a.ts),
        }),
        { kind: "log.update", id, patch },
      );
    },
    [],
  );

  const deleteLog = useCallback((id: string) => {
    ashStore.update(
      (prev) => ({
        ...prev,
        logs: prev.logs.filter((l) => l.id !== id),
      }),
      { kind: "log.delete", id },
    );
  }, []);

  const addPurchase = useCallback((input: Omit<Purchase, "id" | "createdAt">) => {
    const purchase: Purchase = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    ashStore.update(
      (prev) => ({
        ...prev,
        purchases: [purchase, ...prev.purchases].sort((a, b) => b.ts - a.ts),
      }),
      { kind: "purchase.create", id: purchase.id, purchase },
    );
    return purchase;
  }, []);

  const updatePurchase = useCallback(
    (id: string, patch: Partial<Omit<Purchase, "id" | "createdAt">>) => {
      ashStore.update(
        (prev) => ({
          ...prev,
          purchases: prev.purchases
            .map((p) => (p.id === id ? { ...p, ...patch } : p))
            .sort((a, b) => b.ts - a.ts),
        }),
        { kind: "purchase.update", id, patch },
      );
    },
    [],
  );

  const deletePurchase = useCallback((id: string) => {
    ashStore.update(
      (prev) => ({
        ...prev,
        purchases: prev.purchases.filter((p) => p.id !== id),
      }),
      { kind: "purchase.delete", id },
    );
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    ashStore.update(
      (prev) => ({
        ...prev,
        settings: { ...prev.settings, ...patch },
      }),
      { kind: "settings.update", patch },
    );
  }, []);

  const resetData = useCallback(() => {
    // Clear locally first so the UI empties instantly, then tell the server.
    // Anything still queued is moot — it all just got deleted.
    ashStore.replace(emptyData(Date.now()));
    ashStore.clearQueue();
    if (ashStore.getSnapshot().session?.guest) return;
    void api({ method: "POST", path: "/api/data/reset" })
      .catch(() => {})
      .then(() => ashStore.refresh());
  }, []);

  const exportData = useCallback(
    () =>
      JSON.stringify(
        { version: 1, exportedAt: Date.now(), ...ashStore.getSnapshot().data },
        null,
        2,
      ),
    [],
  );

  const importData = useCallback(async (json: string) => {
    const parsed = JSON.parse(json) as Partial<AppData>;
    const next: AppData = {
      ...emptyData(Date.now()),
      ...parsed,
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
      settings: { ...emptyData(0).settings, ...(parsed.settings ?? {}) },
    };
    ashStore.replace(next);
    if (ashStore.getSnapshot().session?.guest) return;

    // The queue described the pre-import world; the bulk endpoint supersedes it.
    ashStore.clearQueue();
    const result = await api<{ data: AppData }>({
      method: "POST",
      path: "/api/data/import",
      body: { ...next, mode: "replace" },
    });
    ashStore.replace(result.data);
  }, []);

  const unitCosts = useMemo(
    () => computeUnitCosts(data.purchases, data.settings),
    [data.purchases, data.settings],
  );

  const lastLog = useMemo(
    () =>
      data.logs.reduce<CigaretteLog | null>(
        (best, l) => (!best || l.ts > best.ts ? l : best),
        null,
      ),
    [data.logs],
  );

  const todayStart = useMemo(() => (now ? startOfDay(now).getTime() : 0), [now]);

  const msSinceLast = lastLog && now ? Math.max(0, now - lastLog.ts) : null;
  const pacingMs = data.settings.pacingMinutes * 60_000;
  const msUntilPaced = msSinceLast === null ? 0 : Math.max(0, pacingMs - msSinceLast);

  const value: StoreValue = {
    hydrated: snapshot.hydrated && now > 0,
    syncing: snapshot.syncing,
    pendingChanges: snapshot.pending,
    syncError: snapshot.syncError,
    session,
    data,
    settings: data.settings,
    logs: data.logs,
    purchases: data.purchases,
    unitCosts,
    now,
    todayStart,
    msSinceLast,
    lastLog,
    pacingBreached: msUntilPaced > 0,
    msUntilPaced,
    signIn,
    signUp,
    continueAsGuest,
    signOut,
    refresh,
    addLog,
    updateLog,
    deleteLog,
    addPurchase,
    updatePurchase,
    deletePurchase,
    updateSettings,
    resetData,
    exportData,
    importData,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
