import { createClient } from "@/lib/supabase/server";
import { ApiError, handle } from "@/lib/api/http";
import { jsonBody, record, text } from "@/lib/api/validate";
import { authErrorMessage, PASSWORD_MIN } from "@/lib/api/auth-errors";

export async function POST(request: Request) {
  return handle(async () => {
    const body = record(await jsonBody(request));
    const email = text(body.email, "Email", { max: 254, allowEmpty: false });
    const password = text(body.password, "Password", {
      max: 72,
      allowEmpty: false,
    });
    const name = body.name === undefined ? "" : text(body.name, "Name", { max: 80 });

    if (password.length < PASSWORD_MIN)
      throw new ApiError(`Password needs at least ${PASSWORD_MIN} characters.`);

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        // Read by the handle_new_user() trigger to seed profiles.name.
        data: { name },
        emailRedirectTo: `${siteUrl(request)}/auth/confirm`,
      },
    });

    if (error) throw new ApiError(authErrorMessage(error), 400);

    // With "Confirm email" on, Supabase returns a user but no session — the
    // account exists and is waiting on the emailed link.
    return {
      user: data.user ? { id: data.user.id, email: data.user.email } : null,
      needsConfirmation: !data.session,
    };
  });
}

function siteUrl(request: Request) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? new URL(request.url).origin
  );
}
