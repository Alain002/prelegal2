import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in | Prelegal",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-2xl font-bold tracking-tight text-brand-navy">Prelegal</p>
          <div aria-hidden className="mx-auto mt-2 h-1 w-12 rounded-full bg-brand-yellow" />
          <h1 className="mt-4 text-xl font-semibold text-brand-navy">Sign in to your account</h1>
          <p className="mt-1 text-sm text-neutral-600">Draft legal agreements from standard templates.</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-neutral-200">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
