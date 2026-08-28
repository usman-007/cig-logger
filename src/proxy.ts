import { NextResponse, type NextRequest } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy-client";

/**
 * Runs before every rendered route.
 *
 * Two jobs:
 *  1. Refresh the Supabase session cookie. Server Components can't write
 *     cookies, so this is the only place the rotated token gets persisted.
 *  2. An *optimistic* redirect for signed-out visitors. This is a UX shortcut,
 *     not a security control — RLS and requireUser() in src/lib/api/session.ts
 *     are what actually protect data.
 *
 * Note for anyone following a Supabase guide: in Next.js 16 the `middleware.ts`
 * convention is deprecated and renamed to `proxy.ts` with a `proxy` export.
 * A file named middleware.ts here would silently never run.
 */
const PUBLIC_PREFIXES = ["/login", "/offline", "/auth", "/api/auth"];

/**
 * Guest mode is deliberately local-only: no Supabase user, no rows, everything
 * in localStorage. This cookie is set by continueAsGuest() purely so the
 * redirect below doesn't bounce guests off /dashboard. Trusting it costs
 * nothing — a guest has no server-side data, and every /api route still
 * demands a real Supabase session.
 */
const GUEST_COOKIE = "ash-guest";

export async function proxy(request: NextRequest) {
  const { supabase, response } = createProxyClient(request);

  // Must be getUser(), not getSession(): getUser() revalidates the JWT against
  // Supabase, and calling it here is what triggers the refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" || PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));

  // API routes answer 401 themselves — redirecting them would hand the client
  // an HTML login page where it expects JSON.
  const isGuest = request.cookies.get(GUEST_COOKIE)?.value === "1";

  if (!user && !isGuest && !isPublic && !path.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response();
}

export const config = {
  // Everything except static assets and the PWA files, which must stay
  // reachable while signed out or the install flow breaks.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.png$).*)",
  ],
};
