// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/chat/api";
import { stubApi } from "@/test/api";
import { documents, pilotDraft, realTemplate } from "@/test/fixtures";
import { location } from "@/test/router";
import { DraftWorkspace } from "./DraftWorkspace";

const workspace = () => <DraftWorkspace documents={documents} ndaTemplate={realTemplate} />;

const messages: ChatMessage[] = [
  { role: "assistant", content: "Hi!" },
  { role: "user", content: "A pilot." },
  { role: "assistant", content: "Which product?" },
];

describe("DraftWorkspace", () => {
  it("starts a new draft at /draft/", () => {
    render(workspace());
    expect(screen.getByRole("heading", { name: "Your agreement will appear here" })).toBeInTheDocument();
  });

  it("opens the saved document named by ?id=", async () => {
    location.search = "?id=3";
    const fetch = stubApi({ "GET /api/documents/3": { body: { id: 3, documentId: "pilot", draft: pilotDraft, messages } } });
    render(workspace());
    expect(screen.getByRole("status")).toHaveTextContent("Opening your document…");

    expect(await screen.findByRole("heading", { level: 1, name: "Pilot Agreement" })).toBeInTheDocument();
    expect(screen.getByText("Which product?")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("says when the document doesn't exist", async () => {
    location.search = "?id=99";
    stubApi({ "GET /api/documents/99": { status: 404, body: { detail: "Document not found." } } });
    render(workspace());
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't find that document.");
    expect(screen.getByRole("link", { name: "My documents" })).toBeInTheDocument();
  });

  it.each(["abc", "0", "-1", "1.5", ""])("treats ?id=%s as missing without asking the backend", async (id) => {
    location.search = `?id=${id}`;
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(workspace());
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't find that document.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows other failures", async () => {
    location.search = "?id=3";
    stubApi({ "GET /api/documents/3": new TypeError("offline") });
    render(workspace());
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach Prelegal.");
  });

  it("keeps a new draft on screen when its first save gives it an address, and reopens that address later", async () => {
    const saved = { id: 7, documentId: "pilot", draft: pilotDraft, messages };
    const fetch = stubApi({
      "POST /api/chat": { body: { reply: "Pilot it is.", draft: pilotDraft } },
      "POST /api/documents": { status: 201, body: saved },
      "GET /api/documents/7": { body: saved },
    });
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { rerender } = render(workspace());

    await userEvent.setup().type(screen.getByLabelText("Your message"), "A pilot{Enter}");
    await screen.findByText("Pilot it is.");
    await waitFor(() => expect(replaceState).toHaveBeenCalledWith(null, "", "/draft/?id=7"));

    // Next reports the new address: the draft stays as it is, conversation and all.
    location.search = "?id=7";
    rerender(workspace());
    expect(screen.getByText("Pilot it is.")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith("/api/documents/7", expect.anything());

    // New document starts afresh...
    location.search = "";
    rerender(workspace());
    expect(screen.getByRole("heading", { name: "Your agreement will appear here" })).toBeInTheDocument();

    // ...and going back opens the saved document from the server.
    location.search = "?id=7";
    rerender(workspace());
    expect(await screen.findByText("Which product?")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/documents/7", { method: "GET" });
  });
});
