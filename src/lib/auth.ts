"use client";

import { GUEST_USER_ID, STORAGE_KEYS } from "./constants";
import type { Session, StoredAccount } from "./types";
import { uid } from "./utils";

/**
 * Accounts live in this browser only — there is no server in this app, so a
 * password protects the local profile switch, not a network boundary. Hashes
 * use PBKDF2-SHA256 (210k iterations) so a stored hash is not reversible.
 */
const ITERATIONS = 210_000;

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function derive(password: string, saltHex: string) {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(
    saltHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [],
  );
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

function readAccounts(): StoredAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.accounts);
    return raw ? (JSON.parse(raw) as StoredAccount[]) : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredAccount[]) {
  window.localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function accountExists(email: string) {
  const target = normalizeEmail(email);
  return readAccounts().some((a) => a.email === target);
}

export function hasAnyAccount() {
  return readAccounts().length > 0;
}

export async function signUp(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<Session> {
  const email = normalizeEmail(input.email);
  if (!validateEmail(email)) throw new Error("Enter a valid email address.");
  if (input.password.length < 6)
    throw new Error("Password needs at least 6 characters.");

  const accounts = readAccounts();
  if (accounts.some((a) => a.email === email))
    throw new Error("An account with that email already exists on this device.");

  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await derive(input.password, salt);
  const account: StoredAccount = {
    id: uid("user"),
    email,
    name: input.name?.trim() || email.split("@")[0],
    salt,
    hash,
    createdAt: Date.now(),
  };
  writeAccounts([...accounts, account]);
  return startSession(account);
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<Session> {
  const email = normalizeEmail(input.email);
  const account = readAccounts().find((a) => a.email === email);
  if (!account) throw new Error("No account found for that email on this device.");
  const hash = await derive(input.password, account.salt);
  if (hash !== account.hash) throw new Error("That password doesn't match.");
  return startSession(account);
}

export function continueAsGuest(): Session {
  const session: Session = {
    userId: GUEST_USER_ID,
    email: "guest@local",
    name: "Guest",
    guest: true,
  };
  writeSession(session);
  return session;
}

function startSession(account: StoredAccount): Session {
  const session: Session = {
    userId: account.id,
    email: account.email,
    name: account.name,
    guest: false,
  };
  writeSession(session);
  return session;
}

export function writeSession(session: Session) {
  window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
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

export function signOut() {
  window.localStorage.removeItem(STORAGE_KEYS.session);
}

/** Move guest-mode data onto a fresh account so a preview isn't thrown away. */
export function claimGuestData(userId: string) {
  const guestKey = STORAGE_KEYS.data(GUEST_USER_ID);
  const guestData = window.localStorage.getItem(guestKey);
  if (!guestData) return false;
  window.localStorage.setItem(STORAGE_KEYS.data(userId), guestData);
  window.localStorage.removeItem(guestKey);
  return true;
}

export function guestHasData() {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(STORAGE_KEYS.data(GUEST_USER_ID));
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { logs?: unknown[]; purchases?: unknown[] };
    return (parsed.logs?.length ?? 0) > 0 || (parsed.purchases?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
