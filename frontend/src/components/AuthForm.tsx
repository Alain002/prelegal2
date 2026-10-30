"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/api";
import { signIn, signUp } from "@/lib/session";
import { useSession } from "@/lib/useSession";
import { Alert, Button, TextField } from "./ui";

// Matches MIN_PASSWORD_LENGTH in backend/app/routers/auth.py.
const MIN_PASSWORD_LENGTH = 8;

const MODES = {
  signIn: {
    label: "Sign in",
    submit: signIn,
    busy: "Signing in…",
    passwordAutoComplete: "current-password",
    switchText: "New to Prelegal?",
    switchLink: { href: "/signup/", label: "Create an account" },
  },
  signUp: {
    label: "Create account",
    submit: signUp,
    busy: "Creating your account…",
    passwordAutoComplete: "new-password",
    switchText: "Already have an account?",
    switchLink: { href: "/", label: "Sign in" },
  },
};

/** The sign-in or sign-up form. Signed-in users go straight to the drafting page. */
export function AuthForm({ mode }: { mode: keyof typeof MODES }) {
  const config = MODES[mode];
  const state = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed in (just now, or on an earlier visit): go into the platform.
  useEffect(() => {
    if (state.status === "authenticated") router.replace("/draft/");
  }, [state.status, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await config.submit(email, password);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-label={config.label}>
      {error && <Alert>{error}</Alert>}
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete={config.passwordAutoComplete}
        required
        minLength={mode === "signUp" ? MIN_PASSWORD_LENGTH : undefined}
        hint={mode === "signUp" ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" busy={busy} className="w-full">
        {busy ? config.busy : config.label}
      </Button>
      <p className="text-center text-sm text-neutral-600">
        {config.switchText}{" "}
        <Link href={config.switchLink.href} className="font-semibold text-brand-purple underline-offset-2 hover:underline">
          {config.switchLink.label}
        </Link>
      </p>
    </form>
  );
}
