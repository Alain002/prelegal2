import { describe, expect, it, vi } from "vitest";
import { defaultNdaValues, todayIso } from "./defaults";

describe("todayIso", () => {
  it("runs in a timezone behind UTC, so a UTC-based date would fail", () => {
    // Set in vitest.config.mts. Guards the test below against passing by accident.
    expect(new Date(2026, 0, 5, 23, 59).getTimezoneOffset()).toBeGreaterThan(0);
  });

  it("uses the local calendar day, not the UTC one", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 23:59 local in Los Angeles is already January 6 in UTC.
    vi.setSystemTime(new Date(2026, 0, 5, 23, 59));
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-01-06");
    expect(todayIso()).toBe("2026-01-05");
  });

  it("pads single-digit months and days", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 2, 7, 12, 0));
    expect(todayIso()).toBe("2026-03-07");
  });
});

describe("defaultNdaValues", () => {
  it("starts with one-year terms and no date (filled in after the page loads)", () => {
    expect(defaultNdaValues.mndaTerm).toEqual({ kind: "expires", years: 1 });
    expect(defaultNdaValues.confidentialityTerm).toEqual({ kind: "years", years: 1 });
    expect(defaultNdaValues.effectiveDate).toBe("");
  });

  it("gives each party its own object", () => {
    expect(defaultNdaValues.parties).toHaveLength(2);
    expect(defaultNdaValues.parties[0]).not.toBe(defaultNdaValues.parties[1]);
  });
});
