// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildDocument } from "@/lib/documents/buildDocument";
import type { Draft } from "@/lib/documents/types";
import { documentInfo, pilotDraft } from "@/test/fixtures";
import { DocumentPreview } from "./DocumentPreview";

const renderPreview = (id = "pilot", draft: Draft = pilotDraft) => render(<DocumentPreview doc={buildDocument(documentInfo(id), draft)} />);

describe("DocumentPreview", () => {
  it("shows the title, the cover page and the Standard Terms", () => {
    renderPreview();
    expect(screen.getByRole("heading", { level: 1, name: "Pilot Agreement" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Cover Page" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Standard Terms" })).toBeInTheDocument();
  });

  it("shows every key term", () => {
    renderPreview();
    for (const heading of ["Parties", "Effective Date", "Product", "Pilot Period", "General Cap Amount", "Governing Law", "Chosen Courts", "Fees"]) {
      expect(screen.getByRole("heading", { level: 3, name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText("Acme Analytics")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("numbers sections, clauses and sub-clauses", () => {
    renderPreview("csa", { documentId: "csa", fields: {} });
    expect(screen.getByRole("heading", { level: 3, name: "1. Service" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "13. Definitions" })).toBeInTheDocument();
    expect(screen.getByText("2.1").closest("p")).toHaveTextContent(/^2\.1 Restrictions on Customer\.$/);
    expect(screen.getAllByText("(a)").length).toBeGreaterThan(0);
  });

  it("highlights terms defined on the cover page", () => {
    renderPreview();
    const clauses = screen.getByRole("heading", { level: 2, name: "Standard Terms" }).parentElement!;
    expect(within(clauses).getAllByText("Customer", { selector: "span.font-semibold" }).length).toBeGreaterThan(0);
  });

  it("credits Common Paper with a link to the licence", () => {
    renderPreview();
    expect(screen.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
  });
});
