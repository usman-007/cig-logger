import { NextResponse } from "next/server";
import { Unauthorized } from "./session";
import { ValidationError } from "./validate";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/**
 * Wraps a handler body so every route reports failures the same way:
 * `{ error: string }` with a sensible status. The client's fetch helper in
 * src/lib/api-client.ts reads exactly that shape.
 */
export async function handle<T>(fn: () => Promise<T>) {
  try {
    return NextResponse.json((await fn()) ?? { ok: true });
  } catch (error) {
    if (error instanceof Unauthorized)
      return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ValidationError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof ApiError)
      return NextResponse.json({ error: error.message }, { status: error.status });

    // Anything unrecognised is a bug — log it server-side, stay vague to the
    // client rather than leaking a Postgres or Supabase internal.
    console.error("[api]", error);
    return NextResponse.json(
      { error: "Something went wrong on our end." },
      { status: 500 },
    );
  }
}

/** Turns a PostgrestError into an ApiError, so handlers can stay linear. */
export function assertOk(
  error: { message: string; code?: string } | null,
  fallback: string,
): asserts error is null {
  if (!error) return;
  console.error("[supabase]", error);
  // 23514 = check_violation, 23503 = foreign_key_violation — both mean the
  // request was bad, not that the server broke.
  const status = error.code === "23514" || error.code === "23503" ? 400 : 500;
  throw new ApiError(fallback, status);
}
