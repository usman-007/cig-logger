import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for the links Supabase emails — signup confirmation and
 * password recovery.
 *
 * Modern Supabase sends `token_hash` + `type`, which verifyOtp exchanges for a
 * session. (The older `?code=` + exchangeCodeForSession flow is for OAuth and
 * magic links; it does not apply here.)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Only ever an in-app path, never an absolute URL — otherwise this is an
  // open redirect that lends Ash's domain to a phishing link.
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/dashboard";

  if (!tokenHash || !type) {
    redirect("/login?error=link-invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    redirect("/login?error=link-expired");
  }

  redirect(next);
}
