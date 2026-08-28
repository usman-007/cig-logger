import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Browser-side Supabase client. The app talks to its own /api routes for
 * everything, so this exists for the rare case something needs Supabase
 * directly from the client (realtime, storage).
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
