"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { signIn } from "@/lib/session";
import { useSession } from "@/lib/useSession";

const inputClass =
  "mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40";

/** Fake sign-in: any email and password let the user in. */
export function LoginForm() {
  const state = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signed in (just now, or on an earlier visit): go into the platform.
  useEffect(() => {
    if (state.status === "authenticated") router.replace("/nda/");
  }, [state.status, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signIn(email);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Sign in">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-neutral-800">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-neutral-800">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        className="w-full rounded-md bg-brand-purple px-4 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-brand-purple/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
      >
        Sign in
      </button>
      <p className="text-xs text-neutral-600">Prototype: no account needed. Any email and password will sign you in.</p>
    </form>
  );
}
