"use client";

import { api } from "./api-client";
import { GUEST_USER_ID, STORAGE_KEYS } from "./constants";
import type { AppData, Session } from "./types";

/**
 * Accounts live in Supabase Auth. The session itself is a pair of httpOnly
 * cookies this file never sees — everything here goes through /api/auth/*, and
 * the copy in STORAGE_KEYS.session is only a cache so the first paint after a
 * reload doesn't flash the login screen.
 *
 * Guest mode is the exception and stays entirely local: no Supabase user, no
 * rows, just localStorage under GUEST_USER_ID.
 */
export const PASSWORD_MIN = 8;

const GUEST_COOKIE = "ash-guest";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export async function signUp(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ session: Session | null; needsConfirmation: boolean }> {
  const email = normalizeEmail(input.email);
  if (!validateEmail(email)) throw new Error("Enter a valid email address.");
  if (input.password.length < PASSWORD_MIN)
    throw new Error(`Password needs at least ${PASSWORD_MIN} characters.`);

  const result = await api<{ user: AuthUser | null; needsConfirmation: boolean }>({
    method: "POST",
    path: "/api/auth/signup",
    body: { email, password: input.password, name: input.name?.trim() || undefined },
  });

  // With email confirmation switched on there is no session yet — the caller
  // shows "check your inbox" instead of navigating to the dashboard.
  if (result.needsConfirmation || !result.user) {
    return { session: null, needsConfirmation: true };
  }

  return {
    session: toSession(result.user, input.name?.trim()),
    needsConfirmation: false,
  };
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<Session> {
  const email = normalizeEmail(input.email);
  if (!validateEmail(email)) throw new Error("Enter a valid email address.");

  const result = await api<{ user: AuthUser }>({
    method: "POST",
    path: "/api/auth/login",
    body: { email, password: input.password },
  });

  return toSession(result.user);
}

export async function requestPasswordReset(email: string) {
  await api({
    method: "POST",
    path: "/api/auth/forgot-password",
    body: { email: normalizeEmail(email) },
  });
}

export async function completePasswordReset(password: string) {
  if (password.length < PASSWORD_MIN)
    throw new Error(`Password needs at least ${PASSWORD_MIN} characters.`);
  await api({ method: "POST", path: "/api/auth/reset-password", body: { password } });
}

function toSession(user: AuthUser, fallbackName?: string): Session {
  return {
    userId: user.id,
    email: user.email,
    name: user.name || fallbackName || user.email.split("@")[0],
    guest: false,
  };
}

export function continueAsGuest(): Session {
  const session: Session = {
    userId: GUEST_USER_ID,
    email: "guest@local",
    name: "Guest",
    guest: true,
  };
  writeSession(session);
  // Read by src/proxy.ts so a guest isn't redirected off /dashboard for having
  // no Supabase session.
  document.cookie = `${GUEST_COOKIE}=1; path=/; max-age=${GUEST_COOKIE_MAX_AGE}; samesite=lax`;
  return session;
}

export async function signOut() {
  clearGuestCookie();
  window.localStorage.removeItem(STORAGE_KEYS.session);
  try {
    await api({ method: "POST", path: "/api/auth/logout" });
  } catch {
    // Offline, or the session had already expired. The local state is gone
    // either way, which is what the user asked for.
  }
}

function clearGuestCookie() {
  document.cookie = `${GUEST_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function writeSession(session: Session) {
  window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  if (!session.guest) clearGuestCookie();
}

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.session);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** The guest's local dataset, for handing over to a freshly created account. */
export function readGuestData(): AppData | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEYS.data(GUEST_USER_ID));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppData;
  } catch {
    return null;
  }
}

export function clearGuestData() {
  window.localStorage.removeItem(STORAGE_KEYS.data(GUEST_USER_ID));
}

export function guestHasData() {
  const data = readGuestData();
  if (!data) return false;
  return (data.logs?.length ?? 0) > 0 || (data.purchases?.length ?? 0) > 0;
}
