import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Builds the Supabase client used by src/proxy.ts, along with the response the
 * refreshed auth cookies get written to.
 *
 * The caller MUST return that exact response object. Constructing a fresh
 * NextResponse without copying its cookies across drops the rotated refresh
 * token, which shows up as users being signed out at seemingly random
 * intervals — the single most common bug in Supabase + Next.js setups.
 */
export function createProxyClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  return { supabase, response: () => response };
}
