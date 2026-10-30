import type { ReactNode } from "react";
import { Card, Disclaimer, Logo } from "./ui";

const POINTS = [
  { title: "Chat, don't fill in forms", text: "Describe the deal in plain words. The AI picks the agreement and fills it in." },
  { title: "11 standard agreements", text: "NDAs, cloud service, data processing, pilots and more, from Common Paper." },
  { title: "Pick up where you left off", text: "Every draft is saved to your account, ready to edit or download." },
];

/** The sign-in and sign-up pages: the product's pitch beside the form (stacked on small screens). */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <section className="bg-brand-navy px-6 py-10 text-white sm:px-10 lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:py-12">
        <Logo onDark />
        <div className="mt-8 lg:mt-0">
          <p className="max-w-md text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Legal agreements, drafted in a conversation.
          </p>
          <div aria-hidden className="mt-5 h-1 w-14 rounded-full bg-brand-yellow" />
          <ul className="mt-8 hidden max-w-md space-y-5 sm:block">
            {POINTS.map((point) => (
              <li key={point.title} className="flex gap-3">
                <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-yellow" />
                <span>
                  <span className="block font-semibold">{point.title}</span>
                  <span className="block text-sm text-white/80">{point.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-10 hidden text-xs text-white/70 lg:block">Templates by Common Paper, licensed under CC BY 4.0.</p>
      </section>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold tracking-tight text-brand-navy">{title}</h1>
          <p className="mt-1 text-neutral-600">{subtitle}</p>
          <Card className="mt-6 p-6 sm:p-8">{children}</Card>
          <Disclaimer className="mt-6" />
        </div>
      </main>
    </div>
  );
}
