import { createClient } from "@/lib/supabase/server";
import { handle } from "@/lib/api/http";

export async function POST() {
  return handle(async () => {
    const supabase = await createClient();
    // Errors here mean the session was already gone — the caller's intent is
    // satisfied either way, so don't turn that into a failure.
    await supabase.auth.signOut();
    return { ok: true };
  });
}
