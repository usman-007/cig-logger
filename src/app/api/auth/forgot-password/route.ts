import { createClient } from "@/lib/supabase/server";
import { handle } from "@/lib/api/http";
import { jsonBody, record, text } from "@/lib/api/validate";

export async function POST(request: Request) {
  return handle(async () => {
    const body = record(await jsonBody(request));
    const email = text(body.email, "Email", { max: 254, allowEmpty: false });

    const supabase = await createClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      new URL(request.url).origin;

    await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
      redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
    });

    // Always the same answer, whether or not the address has an account —
    // otherwise this endpoint tells an attacker who is registered.
    return { ok: true };
  });
}
