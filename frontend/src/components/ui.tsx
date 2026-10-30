import Link from "next/link";
import { useId, type ButtonHTMLAttributes, type ComponentProps, type InputHTMLAttributes, type ReactNode } from "react";
import { DISCLAIMER_APP, DISCLAIMER_HEADING } from "@/lib/disclaimer";

/**
 * Prelegal's UI building blocks. Brand colors follow the contrast rule in CLAUDE.md: yellow, blue
 * and gray only on navy, as large text or as decoration, never as small text on white.
 */

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue";

const variants = {
  primary: "bg-brand-purple text-white shadow-sm hover:bg-brand-purple/90",
  secondary: "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-300 hover:bg-neutral-50",
  ghost: "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
  danger: "bg-red-700 text-white shadow-sm hover:bg-red-800",
};

type Variant = keyof typeof variants;

/** The look of a text box, for inputs and textareas alike. */
export const inputClass =
  "rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm placeholder:text-neutral-500 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40";

const buttonClass = (variant: Variant = "primary", className?: string) =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-60",
    focusRing,
    variants[variant],
    className,
  );

export function Button({
  variant,
  busy,
  className,
  type = "button",
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button type={type} disabled={disabled || busy} aria-busy={busy || undefined} className={buttonClass(variant, className)} {...props}>
      {busy && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function TextField({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-800">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cx("mt-1 block w-full", inputClass)}
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-neutral-600">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * An error (announced at once) or a piece of news (announced politely), with an optional action
 * such as "Try again".
 */
export function Alert({
  tone = "error",
  action,
  className,
  children,
}: {
  tone?: "error" | "info";
  action?: { label: string; onClick: () => void };
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-md px-3 py-2 text-sm",
        tone === "error" ? "bg-red-50 text-red-800 ring-1 ring-red-200" : "bg-sky-50 text-sky-900 ring-1 ring-sky-200",
        action && "flex items-center justify-between gap-3",
        className,
      )}
    >
      {action ? <span>{children}</span> : children}
      {action && (
        <button type="button" onClick={action.onClick} className="shrink-0 font-semibold underline">
          {action.label}
        </button>
      )}
    </div>
  );
}

/** A dashed placeholder card: what goes here, and what to do about it. */
export function EmptyState({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={cx("rounded-xl border-2 border-dashed border-neutral-300 bg-white px-6 py-10 text-neutral-700 sm:px-8", className)}>
      <h2 className="text-xl font-bold text-brand-navy">{title}</h2>
      {children}
    </div>
  );
}

export function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** A centred spinner with a label for screen readers, while a page loads its data. */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-1 items-center justify-center gap-3 py-16 text-neutral-600">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-xl bg-white shadow-sm ring-1 ring-neutral-200", className)}>{children}</div>;
}

/** The Prelegal wordmark. `onDark` for the navy header and panels; `compact` shows only the mark on phones. */
export function Logo({ onDark = false, compact = false }: { onDark?: boolean; compact?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2 text-lg font-bold tracking-tight", onDark ? "text-white" : "text-brand-navy")}>
      <span aria-hidden className="grid size-7 place-items-center rounded-md bg-brand-yellow text-sm font-black text-brand-navy">
        P
      </span>
      {/* Compact: on phones the word is for screen readers only, so the mark still has a name. */}
      <span className={compact ? "sr-only sm:not-sr-only" : undefined}>Prelegal</span>
    </span>
  );
}

/** The "draft, subject to legal review" notice, for the app's screens. */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <aside
      aria-label="Legal disclaimer"
      className={cx("rounded-md border-l-4 border-brand-yellow bg-amber-50 px-4 py-3 text-sm text-neutral-800", className)}
    >
      <p className="font-semibold text-neutral-900">{DISCLAIMER_HEADING}</p>
      <p className="mt-1">{DISCLAIMER_APP}</p>
    </aside>
  );
}
