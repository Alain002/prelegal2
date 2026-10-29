"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/useSession";

/**
 * Shows its children only to signed-in users and sends everyone else to the sign-in page.
 * This is a client-side gate for the fake login, not a security boundary: the exported HTML
 * still contains the page. Real protection comes with backend authentication.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const state = useSession();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "unauthenticated") router.replace("/");
  }, [state.status, router]);

  return state.status === "authenticated" ? children : null;
}
