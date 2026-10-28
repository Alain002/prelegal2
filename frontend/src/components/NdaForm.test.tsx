// @vitest-environment jsdom
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { defaultNdaValues } from "@/lib/nda/defaults";
import type { NdaValues } from "@/lib/nda/types";
import { group } from "@/test/queries";
import { NdaForm } from "./NdaForm";

/** Renders the form with real state and exposes the latest values. */
function setup(initial: NdaValues = defaultNdaValues) {
  const latest = { values: initial };
  function Harness() {
    const [values, setValues] = useState(initial);
    latest.values = values;
    return <NdaForm values={values} onChange={setValues} />;
  }
  const { container } = render(<Harness />);
  return { user: userEvent.setup(), latest, container };
}

/** The two term groups share their behaviour; these describe how to reach each one. */
const termGroups = [
  {
    legend: "MNDA Term",
    key: "mndaTerm",
    yearsBox: "MNDA term in years",
    yearsRadio: /^Expires/,
    otherRadio: "Continues until terminated",
    years: (years: number) => ({ kind: "expires", years }),
    other: { kind: "untilTerminated" },
  },
  {
    legend: "Term of Confidentiality",
    key: "confidentialityTerm",
    yearsBox: "Confidentiality term in years",
    yearsRadio: /year\(s\) from Effective Date/,
    otherRadio: "In perpetuity",
    years: (years: number) => ({ kind: "years", years }),
    other: { kind: "perpetual" },
  },
] as const;

describe("NdaForm", () => {
  it("shows the default values", () => {
    setup();
    expect(screen.getByLabelText(/^Purpose/)).toHaveValue(defaultNdaValues.purpose);
    expect(screen.getByLabelText("MNDA term in years")).toHaveValue(1);
    expect(screen.getByLabelText("Confidentiality term in years")).toHaveValue(1);
    expect(group("MNDA Term").getByRole("radio", { name: /^Expires/ })).toBeChecked();
    expect(group("Term of Confidentiality").getByRole("radio", { name: /year\(s\) from Effective Date/ })).toBeChecked();
  });

  it("labels every field and groups related fields", () => {
    setup();
    for (const name of ["Agreement", "MNDA Term", "Term of Confidentiality", "Governing Law & Jurisdiction", "Party 1", "Party 2"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
    for (const label of [/^Purpose/, /^Effective Date/, /^Governing Law/, /^Jurisdiction/, /^MNDA Modifications/]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    for (const label of ["Company", "Signer name", "Signer title", /^Notice address/]) {
      expect(screen.getAllByLabelText(label)).toHaveLength(2);
    }
  });

  it("updates text fields", async () => {
    const { user, latest } = setup();
    await user.clear(screen.getByLabelText(/^Purpose/));
    await user.type(screen.getByLabelText(/^Purpose/), "Joint venture");
    await user.type(screen.getByLabelText(/^Governing Law/), "Delaware");
    await user.type(screen.getByLabelText(/^Jurisdiction/), "New Castle, DE");
    await user.type(screen.getByLabelText(/^MNDA Modifications/), "None{Enter}Really");

    expect(latest.values).toMatchObject({
      purpose: "Joint venture",
      governingLaw: "Delaware",
      jurisdiction: "New Castle, DE",
      modifications: "None\nReally",
    });
  });

  it("updates the effective date", () => {
    const { latest } = setup();
    // jsdom can't type into date inputs segment by segment, so set the value directly.
    fireEvent.change(screen.getByLabelText("Effective Date"), { target: { value: "2026-12-01" } });
    expect(latest.values.effectiveDate).toBe("2026-12-01");
  });

  it("updates only the party being edited", async () => {
    const { user, latest } = setup();
    const party2 = group("Party 2");
    await user.type(party2.getByLabelText("Company"), "Globex");
    await user.type(party2.getByLabelText("Signer name"), "Alan");
    await user.type(party2.getByLabelText("Signer title"), "CTO");
    await user.type(party2.getByLabelText(/^Notice address/), "1 Main St{Enter}Wilmington");

    expect(latest.values.parties[1]).toEqual({
      company: "Globex",
      name: "Alan",
      title: "CTO",
      noticeAddress: "1 Main St\nWilmington",
    });
    expect(latest.values.parties[0]).toEqual(defaultNdaValues.parties[0]);
  });

  describe.each(termGroups)("$legend", (term) => {
    it("switches to the open-ended option and disables the years box", async () => {
      const { user, latest } = setup();
      await user.click(group(term.legend).getByRole("radio", { name: term.otherRadio }));
      expect(latest.values[term.key]).toEqual(term.other);
      expect(screen.getByLabelText(term.yearsBox)).toBeDisabled();
    });

    it("remembers the chosen years after switching away and back", async () => {
      const { user, latest } = setup();
      const years = screen.getByLabelText(term.yearsBox);
      await user.clear(years);
      await user.type(years, "4");
      await user.click(group(term.legend).getByRole("radio", { name: term.otherRadio }));
      await user.click(group(term.legend).getByRole("radio", { name: term.yearsRadio }));

      expect(latest.values[term.key]).toEqual(term.years(4));
      expect(years).toBeEnabled();
      expect(years).toHaveValue(4);
    });

    it("leaves the other term group unchanged", async () => {
      const { user, latest } = setup();
      const other = termGroups.find((g) => g !== term)!;
      const years = screen.getByLabelText(term.yearsBox);
      await user.clear(years);
      await user.type(years, "7");
      expect(latest.values[term.key]).toEqual(term.years(7));
      expect(latest.values[other.key]).toEqual(other.years(1));
    });
  });

  describe("years box", () => {
    const yearsBox = () => screen.getByLabelText("MNDA term in years");

    it("can be cleared and retyped", async () => {
      const { user, latest } = setup();
      await user.clear(yearsBox());
      expect(yearsBox()).toHaveValue(null); // empty while editing, no snap back to 1
      await user.type(yearsBox(), "5");
      expect(yearsBox()).toHaveValue(5);
      expect(latest.values.mndaTerm).toEqual({ kind: "expires", years: 5 });
    });

    it("accepts two-digit values", async () => {
      const { user, latest } = setup();
      await user.clear(yearsBox());
      await user.type(yearsBox(), "12");
      expect(latest.values.mndaTerm).toEqual({ kind: "expires", years: 12 });
    });

    it.each(["0", "-3"])("rejects %j and restores the last valid value when leaving the field", async (input) => {
      const { user, latest } = setup();
      await user.clear(yearsBox());
      await user.type(yearsBox(), input);
      expect(latest.values.mndaTerm).toEqual({ kind: "expires", years: 1 });
      await user.tab();
      expect(yearsBox()).toHaveValue(1);
    });

    it("restores the last valid value when left empty", async () => {
      const { user, latest } = setup();
      await user.clear(yearsBox());
      await user.tab();
      expect(yearsBox()).toHaveValue(1);
      expect(latest.values.mndaTerm).toEqual({ kind: "expires", years: 1 });
    });

    it("keeps the last valid value when typing past 99", async () => {
      const { user, latest } = setup();
      await user.clear(yearsBox());
      await user.type(yearsBox(), "100"); // passes through 1 and 10, then 100 is rejected
      await user.tab();
      expect(latest.values.mndaTerm).toEqual({ kind: "expires", years: 10 });
      expect(yearsBox()).toHaveValue(10);
    });

    it("rounds decimals down", () => {
      const { latest } = setup();
      // A single change event: typing would commit "2" before the decimal is entered.
      fireEvent.change(yearsBox(), { target: { value: "3.7" } });
      expect(latest.values.mndaTerm).toEqual({ kind: "expires", years: 3 });
    });
  });

  it("prevents the browser's default form submission", () => {
    const { container } = setup();
    const form = container.querySelector("form")!; // the form has no accessible name to query by
    const submit = createEvent.submit(form);
    fireEvent(form, submit);
    expect(submit.defaultPrevented).toBe(true);
  });
});
