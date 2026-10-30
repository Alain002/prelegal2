"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/useSession";
import { Loading } from "./ui";

/**
 * Shows its children only to signed-in users and sends everyone else to the sign-in page. The
 * exported HTML still contains the page, so this is about experience: the backend's API is what
 * refuses signed-out requests.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const state = useSession();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "unauthenticated") router.replace("/");
  }, [state.status, router]);

  if (state.status === "authenticated") return children;
  return <Loading label={state.status === "loading" ? "Loading…" : "Redirecting to sign in…"} />;
}
