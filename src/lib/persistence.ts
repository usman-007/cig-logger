"use client";

import { api, ApiRequestError, NetworkError } from "./api-client";
import { readSession, writeSession } from "./auth";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "./constants";
import { collapse, flush, type Mutation } from "./outbox";
import type { AppData, Session } from "./types";

export interface Snapshot {
  /** false until we know who (if anyone) is signed in */
  hydrated: boolean;
  /** a network reconcile is in flight */
  syncing: boolean;
  /** mutations waiting to reach the server */
  pending: number;
  /** last sync problem worth telling the user about */
  syncError: string | null;
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
  syncing: false,
  pending: 0,
  syncError: null,
  session: null,
  data: emptyData(0),
};

interface BootstrapResponse {
  user: { id: string; email: string; name: string } | null;
  data: AppData | null;
}

/**
 * A tiny external store, read through useSyncExternalStore. Keeping it outside
 * React means the first client render already sees real data instead of an
 * effect writing state in after mount.
 *
 * The server is the source of truth; localStorage is a cache in front of it and
 * an outbox behind it. Every mutation commits locally first — one-tap logging
 * cannot wait on a round trip, let alone on having signal.
 */
class AshStore {
  private snapshot: Snapshot = SERVER_SNAPSHOT;
  private listeners = new Set<() => void>();
  private queue: Mutation[] = [];
  private flushing = false;
  private flushAgain = false;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.hydrate();
      window.addEventListener("storage", this.onStorage);
      window.addEventListener("online", this.onOnline);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        window.removeEventListener("storage", this.onStorage);
        window.removeEventListener("online", this.onOnline);
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

  private patch(partial: Partial<Snapshot>) {
    this.commit({ ...this.snapshot, ...partial });
  }

  // ── local cache ──────────────────────────────────────────────────────────

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

  private loadQueue(userId: string): Mutation[] {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.outbox(userId));
      return raw ? (JSON.parse(raw) as Mutation[]) : [];
    } catch {
      return [];
    }
  }

  private persistQueue() {
    const { session } = this.snapshot;
    if (!session) return;
    try {
      if (this.queue.length === 0) {
        window.localStorage.removeItem(STORAGE_KEYS.outbox(session.userId));
      } else {
        window.localStorage.setItem(
          STORAGE_KEYS.outbox(session.userId),
          JSON.stringify(this.queue),
        );
      }
    } catch {
      // See persist().
    }
  }

  private onStorage = (event: StorageEvent) => {
    const { session } = this.snapshot;
    if (!session || event.key !== STORAGE_KEYS.data(session.userId)) return;
    if (!event.newValue) return;
    try {
      this.patch({
        data: migrate(JSON.parse(event.newValue), this.snapshot.data.startedAt),
      });
    } catch {
      // ignore malformed writes from another tab
    }
  };

  private onOnline = () => {
    void this.flushQueue();
    void this.refresh();
  };

  // ── lifecycle ────────────────────────────────────────────────────────────

  hydrate() {
    if (this.snapshot.hydrated || this.snapshot.syncing) return;
    const cached = readSession();

    if (cached) {
      // Paint from cache straight away, then reconcile in the background.
      this.queue = this.loadQueue(cached.userId);
      this.commit({
        hydrated: true,
        syncing: !cached.guest,
        pending: this.queue.length,
        syncError: null,
        session: cached,
        data: this.load(cached.userId),
      });
      if (cached.guest) return;
      void this.flushQueue().then(() => this.refresh());
      return;
    }

    // No cached session, but the cookies may still be valid — wait for the
    // server rather than flashing the login screen at a signed-in user.
    this.patch({ syncing: true });
    void this.refresh();
  }

  /** Pulls authoritative state from the server and replaces the local copy. */
  async refresh() {
    if (this.snapshot.session?.guest) return;
    this.patch({ syncing: true });

    try {
      const result = await api<BootstrapResponse>({
        method: "GET",
        path: "/api/bootstrap",
      });

      if (!result.user || !result.data) {
        this.signedOut();
        return;
      }

      const session: Session = {
        userId: result.user.id,
        email: result.user.email,
        name: result.user.name || result.user.email.split("@")[0],
        guest: false,
      };
      writeSession(session);
      this.queue = this.loadQueue(session.userId);

      this.commit({
        hydrated: true,
        syncing: false,
        pending: this.queue.length,
        syncError: null,
        session,
        data: result.data,
      });
      this.persist();

      // Anything queued while we were away still needs sending.
      if (this.queue.length > 0) void this.flushQueue();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        this.signedOut();
        return;
      }
      // Offline or the server is down. Whatever is cached stays on screen —
      // that is the point of a local-first PWA.
      this.commit({
        ...this.snapshot,
        hydrated: true,
        syncing: false,
        syncError:
          error instanceof NetworkError
            ? null
            : error instanceof Error
              ? error.message
              : "Couldn't reach the server.",
      });
    }
  }

  private signedOut() {
    this.queue = [];
    this.commit({
      hydrated: true,
      syncing: false,
      pending: 0,
      syncError: null,
      session: null,
      data: emptyData(Date.now()),
    });
  }

  enterSession(session: Session, data?: AppData) {
    writeSession(session);
    this.queue = this.loadQueue(session.userId);
    this.commit({
      hydrated: true,
      syncing: false,
      pending: this.queue.length,
      syncError: null,
      session,
      data: data ?? this.load(session.userId),
    });
    this.persist();
  }

  clearSession() {
    this.queue = [];
    this.commit({
      hydrated: true,
      syncing: false,
      pending: 0,
      syncError: null,
      session: null,
      data: emptyData(Date.now()),
    });
  }

  // ── mutations ────────────────────────────────────────────────────────────

  /**
   * Commits `mutate` locally and, for a real account, queues `mutation` for the
   * server. Stays synchronous on purpose: addLog() returns the new log to its
   * caller, and the FAB reads it immediately.
   */
  update(mutate: (data: AppData) => AppData, mutation?: Mutation) {
    const next = mutate(this.snapshot.data);
    this.patch({ data: next });
    this.persist();

    if (!mutation || !this.snapshot.session || this.snapshot.session.guest) return;

    this.queue = collapse(this.queue, mutation);
    this.persistQueue();
    this.patch({ pending: this.queue.length });
    void this.flushQueue();
  }

  replace(data: AppData) {
    this.patch({ data });
    this.persist();
  }

  /** Drops the outbox — used when a bulk endpoint has already reconciled. */
  clearQueue() {
    this.queue = [];
    this.persistQueue();
    this.patch({ pending: 0 });
  }

  async flushQueue(): Promise<void> {
    if (this.queue.length === 0) return;
    if (!this.snapshot.session || this.snapshot.session.guest) return;

    // Serialise: a delete must never overtake the create it cancels.
    if (this.flushing) {
      this.flushAgain = true;
      return;
    }
    this.flushing = true;

    try {
      const result = await flush(this.queue);
      this.queue = result.pending;
      this.persistQueue();

      if (result.unauthorized) {
        this.patch({
          pending: this.queue.length,
          syncError: "Your session expired — sign in again to sync.",
        });
        return;
      }

      this.patch({
        pending: this.queue.length,
        syncError:
          result.rejected.length > 0
            ? `${result.rejected.length} change${
                result.rejected.length === 1 ? "" : "s"
              } couldn't be saved: ${result.rejected[0].message}`
            : null,
      });

      // The server refused something we had already applied locally, so the
      // two copies have diverged. Take the server's version.
      if (result.rejected.length > 0) void this.refresh();
    } finally {
      this.flushing = false;
      if (this.flushAgain) {
        this.flushAgain = false;
        void this.flushQueue();
      }
    }
  }
}

export const ashStore = new AshStore();
