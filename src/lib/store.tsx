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
import { uid } from "./utils";

export interface LogDraft {
  ts?: number;
  type?: SmokeType;
  trigger?: TriggerId | null;
  note?: string;
}

interface StoreValue {
  hydrated: boolean;
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
  signUp: (input: { email: string; password: string; name?: string }) => Promise<void>;
  continueAsGuest: () => void;
  signOut: () => void;
  addLog: (draft?: LogDraft) => CigaretteLog;
  updateLog: (id: string, patch: Partial<Omit<CigaretteLog, "id" | "createdAt">>) => void;
  deleteLog: (id: string) => void;
  addPurchase: (input: Omit<Purchase, "id" | "createdAt">) => Purchase;
  updatePurchase: (id: string, patch: Partial<Omit<Purchase, "id" | "createdAt">>) => void;
  deletePurchase: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetData: () => void;
  exportData: () => string;
  importData: (json: string) => void;
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
    ashStore.enterSession(await auth.signIn(input));
  }, []);

  const signUp = useCallback(
    async (input: { email: string; password: string; name?: string }) => {
      const next = await auth.signUp(input);
      // A guest who signs up keeps everything they logged in preview mode.
      if (auth.guestHasData()) auth.claimGuestData(next.userId);
      ashStore.enterSession(next);
    },
    [],
  );

  const continueAsGuest = useCallback(() => {
    ashStore.enterSession(auth.continueAsGuest());
  }, []);

  const signOut = useCallback(() => {
    auth.signOut();
    ashStore.clearSession();
  }, []);

  const addLog = useCallback((draft: LogDraft = {}) => {
    const log: CigaretteLog = {
      id: uid("cig"),
      ts: draft.ts ?? Date.now(),
      type: draft.type ?? ashStore.getSnapshot().data.settings.defaultType,
      trigger: draft.trigger ?? null,
      note: draft.note?.trim() || undefined,
      createdAt: Date.now(),
    };
    ashStore.update((prev) => ({
      ...prev,
      logs: [log, ...prev.logs].sort((a, b) => b.ts - a.ts),
    }));
    return log;
  }, []);

  const updateLog = useCallback(
    (id: string, patch: Partial<Omit<CigaretteLog, "id" | "createdAt">>) => {
      ashStore.update((prev) => ({
        ...prev,
        logs: prev.logs
          .map((l) => (l.id === id ? { ...l, ...patch } : l))
          .sort((a, b) => b.ts - a.ts),
      }));
    },
    [],
  );

  const deleteLog = useCallback((id: string) => {
    ashStore.update((prev) => ({
      ...prev,
      logs: prev.logs.filter((l) => l.id !== id),
    }));
  }, []);

  const addPurchase = useCallback((input: Omit<Purchase, "id" | "createdAt">) => {
    const purchase: Purchase = { ...input, id: uid("buy"), createdAt: Date.now() };
    ashStore.update((prev) => ({
      ...prev,
      purchases: [purchase, ...prev.purchases].sort((a, b) => b.ts - a.ts),
    }));
    return purchase;
  }, []);

  const updatePurchase = useCallback(
    (id: string, patch: Partial<Omit<Purchase, "id" | "createdAt">>) => {
      ashStore.update((prev) => ({
        ...prev,
        purchases: prev.purchases
          .map((p) => (p.id === id ? { ...p, ...patch } : p))
          .sort((a, b) => b.ts - a.ts),
      }));
    },
    [],
  );

  const deletePurchase = useCallback((id: string) => {
    ashStore.update((prev) => ({
      ...prev,
      purchases: prev.purchases.filter((p) => p.id !== id),
    }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    ashStore.update((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
  }, []);

  const resetData = useCallback(() => {
    ashStore.replace(emptyData(Date.now()));
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

  const importData = useCallback((json: string) => {
    const parsed = JSON.parse(json) as Partial<AppData>;
    ashStore.replace({
      ...emptyData(Date.now()),
      ...parsed,
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
      settings: { ...emptyData(0).settings, ...(parsed.settings ?? {}) },
    });
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
