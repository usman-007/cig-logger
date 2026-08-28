"use client";

/** Thrown when the server answered, but with a non-2xx status. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }

  /** A 4xx that retrying will never fix — the outbox drops these. */
  get isPermanent() {
    return (
      this.status >= 400 &&
      this.status < 500 &&
      this.status !== 401 &&
      this.status !== 408 &&
      this.status !== 429
    );
  }
}

/** Thrown when the request never reached the server (offline, DNS, abort). */
export class NetworkError extends Error {
  constructor() {
    super("You're offline — this will sync when you reconnect.");
  }
}

export interface ApiRequest {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
}

export async function api<T>({ method, path, body }: ApiRequest): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      // The session lives in cookies; same-origin is the default but be explicit.
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new NetworkError();
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload as { error?: string } | null)?.error ??
      `Request failed (${response.status}).`;
    throw new ApiRequestError(message, response.status);
  }

  return payload as T;
}
