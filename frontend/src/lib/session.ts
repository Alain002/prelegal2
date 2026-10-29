/**
 * FAKE session for the V1 foundation: there is no authentication yet. Signing in only
 * remembers the email in localStorage. This module is the only code that knows how the
 * session is stored, so real sign in can replace it later behind the same functions.
 */

export type Session = { email: string };

export const SESSION_KEY = "prelegal.session";

const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && "email" in value && typeof value.email === "string" && value.email) {
      return { email: value.email };
    }
  } catch {
    // Corrupt value: treat as signed out.
  }
  return null;
}

// useSyncExternalStore needs the same object back until the stored value changes.
let cachedRaw: string | null = null;
let cached: Session | null = null;

/** The signed-in session, or null when signed out. Browser only. */
export function getSession(): Session | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

function notify() {
  listeners.forEach((listener) => listener());
}

/** Signs in with any email. There is no password check yet. */
export function signIn(email: string): Session {
  const session = { email: email.trim() };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable (e.g. blocked): the user simply stays signed out.
  }
  notify();
  return session;
}

export function signOut(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing stored.
  }
  notify();
}

/** Calls `listener` whenever the session changes, in this tab or another one. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SESSION_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
