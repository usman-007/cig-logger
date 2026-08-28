import "server-only";
import type { AppData } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { assertOk } from "./http";
import {
  rowToLog,
  rowToPurchase,
  rowToSettings,
  type LogRow,
  type ProfileRow,
  type PurchaseRow,
  type SettingsRow,
} from "./mappers";

/**
 * Reads a user's whole dataset. Every query below runs through the user's own
 * session, so RLS scopes it — the explicit .eq("user_id") is belt-and-braces
 * and lets the indexes do their job.
 */
export interface LoadedAppData extends AppData {
  profile: { email: string; name: string };
}

export async function loadAppData(userId: string): Promise<LoadedAppData> {
  const supabase = await createClient();

  const [profile, settings, logs, purchases] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, name, started_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("cigarette_logs")
      .select("*")
      .eq("user_id", userId)
      .order("smoked_at", { ascending: false }),
    supabase
      .from("purchases")
      .select("*")
      .eq("user_id", userId)
      .order("purchased_at", { ascending: false }),
  ]);

  assertOk(profile.error, "Couldn't load your profile.");
  assertOk(settings.error, "Couldn't load your settings.");
  assertOk(logs.error, "Couldn't load your entries.");
  assertOk(purchases.error, "Couldn't load your purchases.");

  const profileRow = profile.data as ProfileRow | null;

  return {
    profile: {
      email: profileRow?.email ?? "",
      name: profileRow?.name ?? "",
    },
    logs: ((logs.data ?? []) as LogRow[]).map(rowToLog),
    purchases: ((purchases.data ?? []) as PurchaseRow[]).map(rowToPurchase),
    settings: rowToSettings(settings.data as SettingsRow | null),
    startedAt: profileRow ? new Date(profileRow.started_at).getTime() : Date.now(),
  };
}
