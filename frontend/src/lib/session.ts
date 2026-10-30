/**
 * Who is signed in. The backend keeps the session in an httpOnly cookie that scripts can't read,
 * so this module asks GET /api/auth/me and remembers the answer for the components that show it.
 * It is the only code that talks to the /api/auth endpoints.
 */

import { api, setUnauthorizedHandler } from "./api";

export type Session = { email: string };

type SessionResponse = { user: Session | null };

// undefined until the backend has answered.
let current: Session | null | undefined;
// Counts changes, so an answer to an older question can't undo a newer sign-in or sign-out.
let version = 0;
let refreshing: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(session: Session | null) {
  current = session;
  version++;
  listeners.forEach((listener) => listener());
}

/** The signed-in session: null when signed out, undefined while still asking. */
export function getSession(): Session | null | undefined {
  return current;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Asks the backend who is signed in. Calls made while one is in flight share it. */
export function refreshSession(): Promise<void> {
  if (!refreshing) {
    const asked = version;
    const answer = (session: Session | null) => {
      if (version === asked) set(session);
    };
    refreshing = api<SessionResponse>("/api/auth/me")
      .then(({ user }) => answer(user), () => answer(current ?? null))
      .finally(() => (refreshing = null));
  }
  return refreshing;
}

const authenticate = (path: string) => async (email: string, password: string): Promise<Session> => {
  const { user } = await api<SessionResponse>(path, { method: "POST", body: { email, password } });
  set(user);
  return user!;
};

/** Signs in, or throws an ApiError whose message says why not. */
export const signIn = authenticate("/api/auth/signin");

/** Creates an account and signs in, or throws an ApiError whose message says why not. */
export const signUp = authenticate("/api/auth/signup");

/** Signs out. The user is signed out here even if the backend can't be reached. */
export async function signOut(): Promise<void> {
  try {
    await api("/api/auth/signout", { method: "POST" });
  } catch {
    // The session dies with the cookie or the server anyway.
  }
  set(null);
}

// Any other API call answering 401 means the session has ended: show the sign-in page.
setUnauthorizedHandler(() => set(null));
