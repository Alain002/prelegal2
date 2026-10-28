"use client";

import { useState, type ReactNode } from "react";
import type { NdaValues, Party } from "@/lib/nda/types";

const MAX_YEARS = 99;

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
      <legend className="px-1 text-sm font-semibold text-neutral-900">{legend}</legend>
      {children}
    </fieldset>
  );
}

interface TextFieldProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  /** Renders a multi-line textarea with this many rows. */
  rows?: number;
  type?: "text" | "date";
}

function TextField({ label, hint, value, onChange, rows, type = "text" }: TextFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
      {rows ? (
        <textarea rows={rows} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

/** A number box for years that can be cleared while typing; out-of-range values are fixed on blur. */
function YearsInput({ label, years, disabled, onChange }: {
  label: string;
  years: number;
  disabled: boolean;
  onChange: (years: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (text: string) => {
    const n = Math.floor(Number(text));
    if (n >= 1 && n <= MAX_YEARS) onChange(n);
  };

  return (
    <input
      type="number"
      min={1}
      max={MAX_YEARS}
      aria-label={label}
      value={draft ?? years}
      disabled={disabled}
      onChange={(e) => {
        setDraft(e.target.value);
        commit(e.target.value);
      }}
      onBlur={() => setDraft(null)}
      className="mx-1 w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
    />
  );
}

/** Two radio options: a fixed number of years, or an open-ended alternative. */
function TermChoice({ name, years, fixed, yearsLabel, before, after, otherLabel, onYears, onOther }: {
  name: string;
  /** Current number of years, or null when the open-ended option is selected. */
  years: number | null;
  /** Years to show when switching back from the open-ended option. */
  fixed: number;
  yearsLabel: string;
  before?: string;
  after: string;
  otherLabel: string;
  onYears: (years: number) => void;
  onOther: () => void;
}) {
  const radioClass = "flex items-center text-sm text-neutral-800";
  return (
    <>
      <label className={radioClass}>
        <input type="radio" name={name} className="mr-2" checked={years !== null} onChange={() => onYears(fixed)} />
        {before}
        <YearsInput label={yearsLabel} years={years ?? fixed} disabled={years === null} onChange={onYears} />
        {after}
      </label>
      <label className={radioClass}>
        <input type="radio" name={name} className="mr-2" checked={years === null} onChange={onOther} />
        {otherLabel}
      </label>
    </>
  );
}

interface NdaFormProps {
  values: NdaValues;
  onChange: (values: NdaValues) => void;
}

export function NdaForm({ values, onChange }: NdaFormProps) {
  const set = <K extends keyof NdaValues>(key: K, value: NdaValues[K]) => onChange({ ...values, [key]: value });

  const setParty = (index: number, key: keyof Party, value: string) =>
    set("parties", values.parties.map((p, i) => (i === index ? { ...p, [key]: value } : p)) as NdaValues["parties"]);

  // Remember the last chosen number of years so toggling the radio doesn't reset it.
  const [lastYears, setLastYears] = useState({ mnda: 1, confidentiality: 1 });

  const { mndaTerm, confidentialityTerm } = values;

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      <Fieldset legend="Agreement">
        <TextField
          label="Purpose"
          hint="How Confidential Information may be used"
          rows={3}
          value={values.purpose}
          onChange={(v) => set("purpose", v)}
        />
        <TextField label="Effective Date" type="date" value={values.effectiveDate} onChange={(v) => set("effectiveDate", v)} />
      </Fieldset>

      <Fieldset legend="MNDA Term">
        <TermChoice
          name="mndaTerm"
          years={mndaTerm.kind === "expires" ? mndaTerm.years : null}
          fixed={lastYears.mnda}
          yearsLabel="MNDA term in years"
          before="Expires"
          after="year(s) from Effective Date"
          otherLabel="Continues until terminated"
          onYears={(years) => {
            setLastYears((l) => ({ ...l, mnda: years }));
            set("mndaTerm", { kind: "expires", years });
          }}
          onOther={() => set("mndaTerm", { kind: "untilTerminated" })}
        />
      </Fieldset>

      <Fieldset legend="Term of Confidentiality">
        <TermChoice
          name="confidentialityTerm"
          years={confidentialityTerm.kind === "years" ? confidentialityTerm.years : null}
          fixed={lastYears.confidentiality}
          yearsLabel="Confidentiality term in years"
          after="year(s) from Effective Date"
          otherLabel="In perpetuity"
          onYears={(years) => {
            setLastYears((l) => ({ ...l, confidentiality: years }));
            set("confidentialityTerm", { kind: "years", years });
          }}
          onOther={() => set("confidentialityTerm", { kind: "perpetual" })}
        />
      </Fieldset>

      <Fieldset legend="Governing Law & Jurisdiction">
        <TextField
          label="Governing Law"
          hint="State whose laws govern, e.g. Delaware"
          value={values.governingLaw}
          onChange={(v) => set("governingLaw", v)}
        />
        <TextField
          label="Jurisdiction"
          hint="City or county and state, e.g. courts located in New Castle, DE"
          value={values.jurisdiction}
          onChange={(v) => set("jurisdiction", v)}
        />
        <TextField
          label="MNDA Modifications"
          hint="Optional changes to the Standard Terms"
          rows={2}
          value={values.modifications}
          onChange={(v) => set("modifications", v)}
        />
      </Fieldset>

      {values.parties.map((party, index) => (
        <Fieldset key={index} legend={`Party ${index + 1}`}>
          <TextField label="Company" value={party.company} onChange={(v) => setParty(index, "company", v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Signer name" value={party.name} onChange={(v) => setParty(index, "name", v)} />
            <TextField label="Signer title" value={party.title} onChange={(v) => setParty(index, "title", v)} />
          </div>
          <TextField
            label="Notice address"
            hint="Email or postal address"
            rows={2}
            value={party.noticeAddress}
            onChange={(v) => setParty(index, "noticeAddress", v)}
          />
        </Fieldset>
      ))}
    </form>
  );
}
