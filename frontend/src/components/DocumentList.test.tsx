// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { SavedSummary } from "@/lib/saved/api";
import { stubApi } from "@/test/api";
import { route } from "@/test/router";
import { DocumentList } from "./DocumentList";

const pilot: SavedSummary = {
  id: 2,
  documentId: "pilot",
  documentName: "Pilot Agreement",
  title: "Acme Inc. / Globex LLC",
  createdAt: "2026-10-29T10:00:00+00:00",
  updatedAt: "2026-10-30T09:15:00+00:00",
};
const csa: SavedSummary = { ...pilot, id: 1, documentId: "csa", documentName: "Cloud Service Agreement", title: null };

const rows = () => within(screen.getByRole("list", { name: "Saved documents" })).getAllByRole("listitem");

describe("DocumentList", () => {
  it("lists the user's documents, each linking back to the drafting page", async () => {
    stubApi({ "GET /api/documents": { body: { documents: [pilot, csa] } } });
    render(<DocumentList />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your documents…");

    await waitFor(() => expect(rows()).toHaveLength(2));
    const [first, second] = rows();
    expect(within(first).getByRole("link", { name: "Acme Inc. / Globex LLC" })).toHaveAttribute("href", route("/draft/?id=2"));
    expect(first).toHaveTextContent("Pilot Agreement");
    expect(first).toHaveTextContent(/Last edited .*2026/);
    expect(within(first).getByRole("link", { name: "Open Acme Inc. / Globex LLC" })).toHaveAttribute("href", route("/draft/?id=2"));
    // Without party names yet, a document goes by its type.
    expect(within(second).getByRole("link", { name: "Cloud Service Agreement" })).toBeInTheDocument();
  });

  it("invites a new user to draft their first agreement", async () => {
    stubApi({ "GET /api/documents": { body: { documents: [] } } });
    render(<DocumentList />);
    expect(await screen.findByRole("heading", { name: "No documents yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Draft your first agreement" })).toHaveAttribute("href", route("/draft/"));
  });

  it("deletes a document after confirming, and can cancel", async () => {
    const fetch = stubApi({
      "GET /api/documents": { body: { documents: [pilot, csa] } },
      "DELETE /api/documents/2": { status: 204 },
    });
    render(<DocumentList />);
    const user = userEvent.setup();
    await waitFor(() => expect(rows()).toHaveLength(2));

    await user.click(screen.getByRole("button", { name: "Delete Acme Inc. / Globex LLC" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetch).not.toHaveBeenCalledWith("/api/documents/2", { method: "DELETE" });

    await user.click(screen.getByRole("button", { name: "Delete Acme Inc. / Globex LLC" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete Acme Inc. / Globex LLC" }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(fetch).toHaveBeenCalledWith("/api/documents/2", { method: "DELETE" });
    expect(screen.queryByText("Acme Inc. / Globex LLC")).not.toBeInTheDocument();
  });

  it("keeps a document whose delete failed, and says why", async () => {
    stubApi({ "GET /api/documents": { body: { documents: [pilot] } }, "DELETE /api/documents/2": { status: 500 } });
    render(<DocumentList />);
    const user = userEvent.setup();
    await waitFor(() => expect(rows()).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "Delete Acme Inc. / Globex LLC" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete Acme Inc. / Globex LLC" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    expect(rows()).toHaveLength(1);
  });

  it("says when the list can't be loaded, and tries again", async () => {
    stubApi({ "GET /api/documents": new TypeError("offline") });
    render(<DocumentList />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach Prelegal.");

    stubApi({ "GET /api/documents": { body: { documents: [pilot] } } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(rows()).toHaveLength(1));
  });
});
