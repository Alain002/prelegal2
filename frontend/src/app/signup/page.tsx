import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = {
  title: "Create your account | Prelegal",
};

export default function SignUpPage() {
  return (
    <AuthShell title="Create your account" subtitle="Draft your first agreement in minutes.">
      <AuthForm mode="signUp" />
    </AuthShell>
  );
}
