/**
 * Both values are inlined into the browser bundle at build time — that is
 * expected. They are safe to expose only because Row Level Security is enabled
 * on every table (supabase/migrations/*_rls.sql). RLS is the security boundary.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Add them to .env and restart the dev server.",
  );
}
