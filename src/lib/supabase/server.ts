import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Request-scoped Supabase client for Server Components and Route Handlers.
 * Reads and writes the session through Next's cookie store, so every query it
 * makes runs as the signed-in user and RLS applies.
 *
 * `cookies()` is async in Next 16 — hence the await.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't write cookies. Safe to swallow *only*
          // because src/proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}
