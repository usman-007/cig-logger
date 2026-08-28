import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The Data Access Layer. Every handler that touches user data starts here.
 *
 * The redirect in src/proxy.ts is optimistic — it runs on prefetches and can be
 * bypassed. This check, plus RLS, is what actually holds.
 *
 * React's cache() dedupes the call across a single request, so a handler that
 * needs the user twice still makes one round trip.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export class Unauthorized extends Error {
  constructor(message = "You need to be signed in.") {
    super(message);
  }
}

export async function requireUser() {
  const user = await getUser();
  if (!user) throw new Unauthorized();
  return user;
}
