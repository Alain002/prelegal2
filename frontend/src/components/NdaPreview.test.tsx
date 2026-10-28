// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildNda } from "@/lib/nda/buildNda";
import { defaultNdaValues } from "@/lib/nda/defaults";
import { filledValues, realTemplate } from "@/test/fixtures";
import { NdaPreview } from "./NdaPreview";

const renderPreview = (values = filledValues) => render(<NdaPreview nda={buildNda(values, realTemplate)} />);

describe("NdaPreview", () => {
  it("shows the title and both parts of the agreement", () => {
    renderPreview();
    expect(screen.getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Cover Page" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Standard Terms" })).toBeInTheDocument();
  });

  it("shows every cover page field with its value", () => {
    renderPreview();
    for (const heading of ["Purpose", "Effective Date", "MNDA Term", "Term of Confidentiality", "Governing Law & Jurisdiction", "MNDA Modifications"]) {
      expect(screen.getByRole("heading", { level: 3, name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText("Exploring a partnership.")).toBeInTheDocument();
    expect(screen.getByText("November 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("Expires 2 years from Effective Date.")).toBeInTheDocument();
    expect(screen.getByText("Governing Law: Delaware")).toBeInTheDocument();
  });

  it("shows placeholders for missing details", () => {
    renderPreview(defaultNdaValues);
    expect(screen.getByText("[Effective Date]")).toBeInTheDocument();
    expect(screen.getByText("Governing Law: [Governing Law]")).toBeInTheDocument();
    expect(screen.getByText("Jurisdiction: [Jurisdiction]")).toBeInTheDocument();
  });

  it("renders the signature table with a column per party", () => {
    renderPreview();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["", "PARTY 1", "PARTY 2"]);

    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getByRole("rowheader").textContent)).toEqual([
      "Signature",
      "Print Name",
      "Title",
      "Company",
      "Notice AddressUse either email or postal address",
      "Date",
    ]);
    const nameRow = within(rows[1]).getAllByRole("cell").map((c) => c.textContent);
    expect(nameRow).toEqual(["Ada Lovelace", "Alan Turing"]);
  });

  it("keeps line breaks in multi-line values", () => {
    renderPreview();
    const cell = screen.getByText(/1 Main St/);
    expect(cell.textContent).toBe("1 Main St\nWilmington, DE");
  });

  it("lists all 11 Standard Terms clauses in order", () => {
    renderPreview();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(11);
    expect(items[0]).toHaveTextContent(/^1\. Introduction\./);
    expect(items[10]).toHaveTextContent(/^11\. General\./);
  });

  it("keeps cover page references as defined terms rather than filling in values", () => {
    // The Standard Terms refer to the Cover Page, as Common Paper intends.
    renderPreview();
    const clause9 = within(screen.getByRole("list")).getAllByRole("listitem")[8];
    expect(clause9).toHaveTextContent("governed by, and construed in accordance with, the laws of the State of Governing Law,");
    expect(clause9).not.toHaveTextContent("Delaware");
  });

  it("opens external links safely in a new tab", () => {
    renderPreview();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(
      expect.arrayContaining(["https://commonpaper.com/standards/mutual-nda/1.0", "https://creativecommons.org/licenses/by/4.0/"]),
    );
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    }
  });

  it("renders user input as text, not HTML", () => {
    renderPreview({ ...filledValues, purpose: "<img src=x onerror=alert(1)>" });
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
