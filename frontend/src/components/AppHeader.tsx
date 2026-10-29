"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/session";
import { useSession } from "@/lib/useSession";

export function AppHeader() {
  const state = useSession();
  const router = useRouter();

  function handleSignOut() {
    signOut();
    router.replace("/");
  }

  return (
    <header className="bg-brand-navy text-white print:hidden">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <span className="text-lg font-bold tracking-tight text-brand-yellow">Prelegal</span>
        <div className="flex min-w-0 items-center gap-3 text-sm">
          {state.status === "authenticated" && (
            <span className="truncate text-white/80" data-testid="signed-in-email">
              {state.session.email}
            </span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="shrink-0 rounded-md px-3 py-1.5 font-semibold ring-1 ring-white/40 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-brand-yellow"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
