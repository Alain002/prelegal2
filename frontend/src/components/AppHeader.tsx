"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/session";
import { useSession } from "@/lib/useSession";
import { cx, Logo } from "./ui";

const NAV = [
  { href: "/draft/", label: "New document" },
  { href: "/documents/", label: "My documents" },
];

const onNavy = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow";

export function AppHeader() {
  const state = useSession();
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  return (
    <header className="bg-brand-navy text-white print:hidden">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/draft/" className={cx("rounded-md", onNavy)}>
          <Logo onDark compact />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:ml-4">
          {NAV.map((item) => {
            const current = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "rounded-md px-2 py-1.5 font-medium whitespace-nowrap transition-colors sm:px-3",
                  current ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
                  onNavy,
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-3 text-sm">
          {state.status === "authenticated" && (
            <span className="hidden truncate text-white/80 md:inline" data-testid="signed-in-email">
              {state.session.email}
            </span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className={cx("shrink-0 rounded-md px-3 py-1.5 font-semibold ring-1 ring-white/40 transition-colors hover:bg-white/10", onNavy)}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
