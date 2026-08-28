import { createClient } from "@/lib/supabase/server";
import { ApiError, handle } from "@/lib/api/http";
import { jsonBody, record, text } from "@/lib/api/validate";
import { authErrorMessage, PASSWORD_MIN } from "@/lib/api/auth-errors";
import { requireUser } from "@/lib/api/session";

/**
 * Completes a reset. The recovery link goes through /auth/confirm, which
 * exchanges the token for a real session — so by the time this runs the user
 * is signed in and updateUser is all that's left.
 */
export async function POST(request: Request) {
  return handle(async () => {
    await requireUser();

    const body = record(await jsonBody(request));
    const password = text(body.password, "Password", {
      max: 72,
      allowEmpty: false,
    });
    if (password.length < PASSWORD_MIN)
      throw new ApiError(`Password needs at least ${PASSWORD_MIN} characters.`);

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new ApiError(authErrorMessage(error), 400);

    return { ok: true };
  });
}
