import { useEffect, useSyncExternalStore } from "react";
import { getSession, refreshSession, subscribe, type Session } from "./session";

export type SessionState =
  | { status: "loading" }
  | { status: "authenticated"; session: Session }
  | { status: "unauthenticated" };

// The prerendered HTML can't know who is signed in, so the server snapshot is "loading".
// That keeps the first client render identical to the HTML and avoids hydration errors.
const serverSnapshot = () => undefined;

/** Who is signed in. Each component using it checks with the backend when it mounts. */
export function useSession(): SessionState {
  const session = useSyncExternalStore<Session | null | undefined>(subscribe, getSession, serverSnapshot);
  useEffect(() => {
    void refreshSession();
  }, []);
  if (session === undefined) return { status: "loading" };
  return session ? { status: "authenticated", session } : { status: "unauthenticated" };
}
