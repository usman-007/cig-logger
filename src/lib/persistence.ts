"use client";

import { DEFAULT_SETTINGS, STORAGE_KEYS } from "./constants";
import { readSession } from "./auth";
import type { AppData, Session } from "./types";

export interface Snapshot {
  /** false until localStorage has been read on the client */
  hydrated: boolean;
  session: Session | null;
  data: AppData;
}

export function emptyData(startedAt = 0): AppData {
  return {
    logs: [],
    purchases: [],
    settings: { ...DEFAULT_SETTINGS },
    startedAt,
  };
}

export function migrate(raw: unknown, fallbackStartedAt: number): AppData {
  const base = emptyData(fallbackStartedAt);
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<AppData>;
  return {
    logs: Array.isArray(data.logs) ? data.logs : [],
    purchases: Array.isArray(data.purchases) ? data.purchases : [],
    settings: { ...base.settings, ...(data.settings ?? {}) },
    startedAt:
      typeof data.startedAt === "number" ? data.startedAt : fallbackStartedAt,
  };
}

/** Rendered on the server and before hydration — must be referentially stable. */
const SERVER_SNAPSHOT: Snapshot = {
  hydrated: false,
  session: null,
  data: emptyData(0),
};

/**
 * A tiny external store over localStorage, read through useSyncExternalStore.
 * Keeping it outside React means the first client render already sees the real
 * data instead of an effect writing state in after mount.
 */
class AshStore {
  private snapshot: Snapshot = SERVER_SNAPSHOT;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.hydrate();
      window.addEventListener("storage", this.onStorage);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        window.removeEventListener("storage", this.onStorage);
      }
    };
  };

  getSnapshot = () => this.snapshot;

  getServerSnapshot = () => SERVER_SNAPSHOT;

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private commit(next: Snapshot) {
    this.snapshot = next;
    this.emit();
  }

  private load(userId: string): AppData {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.data(userId));
      return raw ? migrate(JSON.parse(raw), Date.now()) : emptyData(Date.now());
    } catch {
      return emptyData(Date.now());
    }
  }

  private persist() {
    const { session, data } = this.snapshot;
    if (!session) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.data(session.userId),
        JSON.stringify(data),
      );
    } catch {
      // Quota or private-mode failures shouldn't take the UI down.
    }
  }

  private onStorage = (event: StorageEvent) => {
    const { session } = this.snapshot;
    if (!session || event.key !== STORAGE_KEYS.data(session.userId)) return;
    if (!event.newValue) return;
    try {
      this.commit({
        ...this.snapshot,
        data: migrate(JSON.parse(event.newValue), this.snapshot.data.startedAt),
      });
    } catch {
      // ignore malformed writes from another tab
    }
  };

  hydrate() {
    if (this.snapshot.hydrated) return;
    const session = readSession();
    this.snapshot = {
      hydrated: true,
      session,
      data: session ? this.load(session.userId) : emptyData(Date.now()),
    };
  }

  enterSession(session: Session) {
    this.commit({ hydrated: true, session, data: this.load(session.userId) });
  }

  clearSession() {
    this.commit({ hydrated: true, session: null, data: emptyData(Date.now()) });
  }

  update(mutate: (data: AppData) => AppData) {
    this.commit({ ...this.snapshot, data: mutate(this.snapshot.data) });
    this.persist();
  }

  replace(data: AppData) {
    this.commit({ ...this.snapshot, data });
    this.persist();
  }
}

export const ashStore = new AshStore();
