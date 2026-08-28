import { assertOk, handle } from "@/lib/api/http";
import { requireUser } from "@/lib/api/session";
import { createClient } from "@/lib/supabase/server";
import { parseImport } from "@/lib/api/schemas";
import { jsonBody } from "@/lib/api/validate";
import { logToRow, purchaseToRow, settingsToRow } from "@/lib/api/mappers";
import { loadAppData } from "@/lib/api/queries";

/** Postgrest chokes on very large single statements; chunk the upserts. */
const CHUNK = 500;

/**
 * Two callers: the Settings page's "import a file" button, and the guest →
 * account handover on signup.
 *
 * `mode: "replace"` (the default, matching the old importData behaviour) wipes
 * existing rows first. `mode: "merge"` keeps them and upserts on top — that's
 * what the guest handover wants, so a signup can't clobber a returning user.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await jsonBody(request)) as Record<string, unknown>;
    const mode = body?.mode === "merge" ? "merge" : "replace";
    const input = parseImport(body);
    const supabase = await createClient();

    if (mode === "replace") {
      const [logs, purchases] = await Promise.all([
        supabase.from("cigarette_logs").delete().eq("user_id", user.id),
        supabase.from("purchases").delete().eq("user_id", user.id),
      ]);
      assertOk(logs.error, "Couldn't clear your existing entries.");
      assertOk(purchases.error, "Couldn't clear your existing purchases.");
    }

    for (const batch of chunk(input.logs.map((l) => logToRow(l, user.id)))) {
      const { error } = await supabase
        .from("cigarette_logs")
        .upsert(batch, { onConflict: "id" });
      assertOk(error, "Couldn't import your entries.");
    }

    for (const batch of chunk(input.purchases.map((p) => purchaseToRow(p, user.id)))) {
      const { error } = await supabase
        .from("purchases")
        .upsert(batch, { onConflict: "id" });
      assertOk(error, "Couldn't import your purchases.");
    }

    const settingsUpdate = settingsToRow(input.settings);
    if (Object.keys(settingsUpdate).length > 0) {
      const { error } = await supabase
        .from("user_settings")
        .upsert({ user_id: user.id, ...settingsUpdate }, { onConflict: "user_id" });
      assertOk(error, "Couldn't import your settings.");
    }

    if (input.startedAt !== null) {
      const { error } = await supabase
        .from("profiles")
        .update({ started_at: new Date(input.startedAt).toISOString() })
        .eq("id", user.id);
      assertOk(error, "Couldn't import your start date.");
    }

    // Hand back the reconciled state so the client can commit it wholesale
    // rather than guessing what the merge produced.
    const { profile: _profile, ...data } = await loadAppData(user.id);
    return { data };
  });
}

function chunk<T>(items: T[]): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) {
    batches.push(items.slice(i, i + CHUNK));
  }
  return batches;
}
