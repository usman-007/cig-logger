import { assertOk, handle } from "@/lib/api/http";
import { requireUser } from "@/lib/api/session";
import { createClient } from "@/lib/supabase/server";
import { parseLogCreate } from "@/lib/api/schemas";
import { jsonBody } from "@/lib/api/validate";
import { rowToLog, type LogRow } from "@/lib/api/mappers";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("cigarette_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("smoked_at", { ascending: false });

    assertOk(error, "Couldn't load your entries.");
    return { logs: ((data ?? []) as LogRow[]).map(rowToLog) };
  });
}

/**
 * The id comes from the client (crypto.randomUUID) so the FAB can commit
 * optimistically. `upsert` rather than `insert` makes the offline outbox's
 * retries idempotent: replaying a POST that already landed is a no-op.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const input = parseLogCreate(await jsonBody(request));
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("cigarette_logs")
      .upsert(
        {
          id: input.id,
          user_id: user.id,
          smoked_at: new Date(input.ts).toISOString(),
          type: input.type,
          trigger: input.trigger,
          note: input.note,
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    assertOk(error, "Couldn't save that entry.");
    return { log: rowToLog(data as LogRow) };
  });
}
