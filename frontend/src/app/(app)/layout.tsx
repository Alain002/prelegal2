import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { DISCLAIMER_SHORT } from "@/lib/disclaimer";

/** Layout for every page inside the platform: signed-in users only, with the app header and footer. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppHeader />
      {children}
      <footer className="border-t border-neutral-200 bg-white print:hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-neutral-600 sm:flex-row sm:justify-between sm:px-6">
          <p>{DISCLAIMER_SHORT}</p>
          <p>Templates by Common Paper, licensed under CC BY 4.0.</p>
        </div>
      </footer>
    </AuthGuard>
  );
}
