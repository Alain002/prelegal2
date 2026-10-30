import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = {
  title: "Sign in | Prelegal",
};

export default function SignInPage() {
  return (
    <AuthShell title="Sign in to your account" subtitle="Welcome back. Your saved drafts are waiting.">
      <AuthForm mode="signIn" />
    </AuthShell>
  );
}
