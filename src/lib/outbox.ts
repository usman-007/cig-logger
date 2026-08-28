"use client";

import { api, ApiRequestError, NetworkError, type ApiRequest } from "./api-client";
import type { CigaretteLog, Purchase, Settings } from "./types";

/**
 * A durable queue of mutations waiting to reach the server.
 *
 * One-tap logging has to work with no signal — that is the whole point of the
 * FAB — so every mutation commits to the store immediately and lands here.
 * Replay is safe because entry ids are client-generated UUIDs and the POST
 * handlers upsert: sending the same create twice is a no-op.
 */
export type Mutation =
  | { kind: "log.create"; id: string; log: CigaretteLog }
  | { kind: "log.update"; id: string; patch: Partial<CigaretteLog> }
  | { kind: "log.delete"; id: string }
  | { kind: "purchase.create"; id: string; purchase: Purchase }
  | { kind: "purchase.update"; id: string; patch: Partial<Purchase> }
  | { kind: "purchase.delete"; id: string }
  | { kind: "settings.update"; patch: Partial<Settings> };

function toRequest(mutation: Mutation): ApiRequest {
  switch (mutation.kind) {
    case "log.create":
      return { method: "POST", path: "/api/logs", body: mutation.log };
    case "log.update":
      return {
        method: "PATCH",
        path: `/api/logs/${mutation.id}`,
        body: mutation.patch,
      };
    case "log.delete":
      return { method: "DELETE", path: `/api/logs/${mutation.id}` };
    case "purchase.create":
      return { method: "POST", path: "/api/purchases", body: mutation.purchase };
    case "purchase.update":
      return {
        method: "PATCH",
        path: `/api/purchases/${mutation.id}`,
        body: mutation.patch,
      };
    case "purchase.delete":
      return { method: "DELETE", path: `/api/purchases/${mutation.id}` };
    case "settings.update":
      return { method: "PATCH", path: "/api/settings", body: mutation.patch };
  }
}

/**
 * Folds a new mutation into the pending queue instead of blindly appending.
 *
 * This is what makes Undo work offline: tapping the FAB then Undo enqueues a
 * create and a delete for the same id, and collapsing them to nothing is both
 * correct and avoids a guaranteed-404 round trip. Same idea for edits landing
 * on an unsent create, and for settings, where only the last value matters.
 */
export function collapse(queue: Mutation[], next: Mutation): Mutation[] {
  switch (next.kind) {
    case "log.delete":
    case "purchase.delete": {
      const createKind =
        next.kind === "log.delete" ? "log.create" : "purchase.create";
      const hasPendingCreate = queue.some(
        (m) => m.kind === createKind && m.id === next.id,
      );
      const withoutId = queue.filter(
        (m) => !("id" in m) || m.id !== next.id,
      );
      // Never sent, now deleted — as if it never happened.
      return hasPendingCreate ? withoutId : [...withoutId, next];
    }

    case "log.update": {
      const merged = [...queue];
      // Fold the edit into an unsent create, so the server only ever sees the
      // final version of an entry that never existed remotely.
      const createIndex = merged.findIndex(
        (m) => m.kind === "log.create" && m.id === next.id,
      );
      if (createIndex !== -1) {
        const create = merged[createIndex] as Extract<
          Mutation,
          { kind: "log.create" }
        >;
        merged[createIndex] = {
          ...create,
          log: { ...create.log, ...next.patch },
        };
        return merged;
      }
      const updateIndex = merged.findIndex(
        (m) => m.kind === "log.update" && m.id === next.id,
      );
      if (updateIndex === -1) return [...merged, next];
      const existing = merged[updateIndex] as Extract<
        Mutation,
        { kind: "log.update" }
      >;
      merged[updateIndex] = {
        ...existing,
        patch: { ...existing.patch, ...next.patch },
      };
      return merged;
    }

    case "purchase.update": {
      const merged = [...queue];
      const createIndex = merged.findIndex(
        (m) => m.kind === "purchase.create" && m.id === next.id,
      );
      if (createIndex !== -1) {
        const create = merged[createIndex] as Extract<
          Mutation,
          { kind: "purchase.create" }
        >;
        merged[createIndex] = {
          ...create,
          purchase: { ...create.purchase, ...next.patch },
        };
        return merged;
      }
      const updateIndex = merged.findIndex(
        (m) => m.kind === "purchase.update" && m.id === next.id,
      );
      if (updateIndex === -1) return [...merged, next];
      const existing = merged[updateIndex] as Extract<
        Mutation,
        { kind: "purchase.update" }
      >;
      merged[updateIndex] = {
        ...existing,
        patch: { ...existing.patch, ...next.patch },
      };
      return merged;
    }

    case "settings.update": {
      const index = queue.findIndex((m) => m.kind === "settings.update");
      if (index === -1) return [...queue, next];
      const merged = [...queue];
      const existing = merged[index] as Extract<Mutation, { kind: "settings.update" }>;
      merged[index] = { kind: "settings.update", patch: { ...existing.patch, ...next.patch } };
      return merged;
    }

    default:
      return [...queue, next];
  }
}

export interface FlushResult {
  /** Mutations still waiting — network was unavailable partway through. */
  pending: Mutation[];
  /** Rejected outright by the server; dropped, with a message to surface. */
  rejected: { mutation: Mutation; message: string }[];
  /** True when the session is gone and the caller should sign the user out. */
  unauthorized: boolean;
}

/**
 * Sends the queue in order. Order matters: a delete must not overtake the
 * create it cancels.
 */
export async function flush(queue: Mutation[]): Promise<FlushResult> {
  const rejected: FlushResult["rejected"] = [];

  for (let i = 0; i < queue.length; i += 1) {
    const mutation = queue[i];
    try {
      await api(toRequest(mutation));
    } catch (error) {
      if (error instanceof NetworkError) {
        // Still offline. Keep this one and everything after it.
        return { pending: queue.slice(i), rejected, unauthorized: false };
      }
      if (error instanceof ApiRequestError) {
        if (error.status === 401)
          return { pending: queue.slice(i), rejected, unauthorized: true };
        if (error.isPermanent) {
          // Retrying bad data forever would wedge the queue behind it.
          rejected.push({ mutation, message: error.message });
          continue;
        }
        return { pending: queue.slice(i), rejected, unauthorized: false };
      }
      return { pending: queue.slice(i), rejected, unauthorized: false };
    }
  }

  return { pending: [], rejected, unauthorized: false };
}
