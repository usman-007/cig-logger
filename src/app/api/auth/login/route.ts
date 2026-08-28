import { createClient } from "@/lib/supabase/server";
import { ApiError, handle } from "@/lib/api/http";
import { jsonBody, record, text } from "@/lib/api/validate";
import { authErrorMessage } from "@/lib/api/auth-errors";

export async function POST(request: Request) {
  return handle(async () => {
    const body = record(await jsonBody(request));
    const email = text(body.email, "Email", { max: 254, allowEmpty: false });
    const password = text(body.password, "Password", {
      max: 72,
      allowEmpty: false,
    });

    const supabase = await createClient();
    // Sets the sb-* session cookies on the outgoing response via the cookie
    // adapter in src/lib/supabase/server.ts.
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (error) throw new ApiError(authErrorMessage(error), 401);

    return {
      user: { id: data.user.id, email: data.user.email },
    };
  });
}
