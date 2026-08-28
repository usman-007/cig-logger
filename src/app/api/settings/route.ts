import { ApiError, assertOk, handle } from "@/lib/api/http";
import { requireUser } from "@/lib/api/session";
import { createClient } from "@/lib/supabase/server";
import { parseSettingsPatch } from "@/lib/api/schemas";
import { jsonBody } from "@/lib/api/validate";
import { rowToSettings, settingsToRow, type SettingsRow } from "@/lib/api/mappers";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    assertOk(error, "Couldn't load your settings.");
    return { settings: rowToSettings(data as SettingsRow | null) };
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const patch = parseSettingsPatch(await jsonBody(request));
    const update = settingsToRow(patch);

    if (Object.keys(update).length === 0)
      throw new ApiError("Nothing to update.");

    const supabase = await createClient();
    // upsert, not update: the signup trigger normally creates this row, but a
    // user who predates the trigger would otherwise be stuck with no settings.
    const { data, error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, ...update }, { onConflict: "user_id" })
      .select()
      .single();

    assertOk(error, "Couldn't save your settings.");
    return { settings: rowToSettings(data as SettingsRow) };
  });
}
