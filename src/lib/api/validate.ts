/**
 * Small hand-rolled validators for request bodies.
 *
 * Deliberately not a schema library: the shapes here are few and fixed, and
 * this keeps the dependency list to exactly the two Supabase packages.
 */
export class ValidationError extends Error {}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** One day of slack, so a clock a little ahead of the server still logs. */
const MAX_FUTURE_MS = 86_400_000;

function bad(message: string): never {
  throw new ValidationError(message);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function record(value: unknown, label = "Request body") {
  if (!isRecord(value)) bad(`${label} must be an object.`);
  return value;
}

export function uuid(value: unknown, field: string) {
  if (typeof value !== "string" || !UUID_RE.test(value))
    bad(`${field} must be a UUID.`);
  return value.toLowerCase();
}

/** Epoch milliseconds, as used throughout src/lib/types.ts. */
export function epochMs(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value))
    bad(`${field} must be a timestamp in milliseconds.`);
  if (value < 0) bad(`${field} can't be before 1970.`);
  if (value > Date.now() + MAX_FUTURE_MS) bad(`${field} can't be in the future.`);
  return Math.round(value);
}

export function literal<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    bad(`${field} must be one of: ${allowed.join(", ")}.`);
  return value as T;
}

export function text(
  value: unknown,
  field: string,
  { max = 500, allowEmpty = true }: { max?: number; allowEmpty?: boolean } = {},
) {
  if (typeof value !== "string") bad(`${field} must be text.`);
  const trimmed = value.trim();
  if (!allowEmpty && !trimmed) bad(`${field} can't be empty.`);
  if (trimmed.length > max) bad(`${field} must be ${max} characters or fewer.`);
  return trimmed;
}

/** Optional free-text note: empty string and null both mean "no note". */
export function optionalText(value: unknown, field: string, max = 500) {
  if (value === null || value === undefined) return null;
  const trimmed = text(value, field, { max });
  return trimmed || null;
}

export function number(
  value: unknown,
  field: string,
  { min = -Infinity, max = Infinity, integer = false }: {
    min?: number;
    max?: number;
    integer?: boolean;
  } = {},
) {
  if (typeof value !== "number" || !Number.isFinite(value))
    bad(`${field} must be a number.`);
  if (integer && !Number.isInteger(value)) bad(`${field} must be a whole number.`);
  if (value < min) bad(`${field} must be at least ${min}.`);
  if (value > max) bad(`${field} must be at most ${max}.`);
  return value;
}

export function boolean(value: unknown, field: string) {
  if (typeof value !== "boolean") bad(`${field} must be true or false.`);
  return value;
}

/** Reads a JSON body, turning malformed input into a 400 rather than a 500. */
export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    bad("Expected a JSON body.");
  }
}
