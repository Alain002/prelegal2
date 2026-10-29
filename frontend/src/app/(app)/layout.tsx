import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";

/** Layout for every page inside the platform: signed-in users only, with the app header. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppHeader />
      {children}
    </AuthGuard>
  );
}
