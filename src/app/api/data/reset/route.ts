import { assertOk, handle } from "@/lib/api/http";
import { requireUser } from "@/lib/api/session";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { settingsToRow } from "@/lib/api/mappers";

/**
 * Clears every log and purchase and puts settings back to DEFAULT_SETTINGS.
 * The account itself survives — this is the Settings page's "Delete
 * everything", not "delete my account".
 */
export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    const supabase = await createClient();

    const [logs, purchases] = await Promise.all([
      supabase.from("cigarette_logs").delete().eq("user_id", user.id),
      supabase.from("purchases").delete().eq("user_id", user.id),
    ]);
    assertOk(logs.error, "Couldn't clear your entries.");
    assertOk(purchases.error, "Couldn't clear your purchases.");

    const settings = await supabase
      .from("user_settings")
      .upsert(
        { user_id: user.id, ...settingsToRow(DEFAULT_SETTINGS) },
        { onConflict: "user_id" },
      );
    assertOk(settings.error, "Couldn't reset your settings.");

    // Tracking starts over from now, so lifetime averages aren't skewed by a
    // start date with no data behind it.
    const startedAt = new Date().toISOString();
    const profile = await supabase
      .from("profiles")
      .update({ started_at: startedAt })
      .eq("id", user.id);
    assertOk(profile.error, "Couldn't reset your start date.");

    return { startedAt: Date.parse(startedAt) };
  });
}
