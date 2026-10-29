import { useSyncExternalStore } from "react";
import { getSession, subscribe, type Session } from "./session";

export type SessionState =
  | { status: "loading" }
  | { status: "authenticated"; session: Session }
  | { status: "unauthenticated" };

// The prerendered HTML can't know who is signed in, so the server snapshot is "loading".
// That keeps the first client render identical to the HTML and avoids hydration errors.
const serverSnapshot = () => undefined;

export function useSession(): SessionState {
  const session = useSyncExternalStore<Session | null | undefined>(subscribe, getSession, serverSnapshot);
  if (session === undefined) return { status: "loading" };
  return session ? { status: "authenticated", session } : { status: "unauthenticated" };
}
