// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage, ChatTurn } from "@/lib/chat/api";
import type { AgreementDocument, Draft } from "@/lib/documents/types";
import type { NdaDocument } from "@/lib/nda/types";
import { documents, ndaDraft, pilotDraft, realTemplate } from "@/test/fixtures";
import { preview } from "@/test/queries";
import { DraftCreator } from "./DraftCreator";

// The real Word exports are covered by their own tests and the end-to-end tests.
const toDocx = vi.hoisted(() => vi.fn<(nda: NdaDocument) => Promise<Blob>>());
vi.mock("@/lib/nda/toDocx", () => ({ toDocx }));
const documentToDocx = vi.hoisted(() => vi.fn<(doc: AgreementDocument) => Promise<Blob>>());
vi.mock("@/lib/documents/toDocx", () => ({ documentToDocx }));

// The AI is faked: each test scripts what it answers.
const sendChat = vi.hoisted(() => vi.fn<(messages: ChatMessage[], draft: Draft) => Promise<ChatTurn>>());
vi.mock("@/lib/chat/api", () => ({ sendChat }));

// Saving is faked: each test can check what was saved, and when.
const saved = vi.hoisted(() => ({
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
}));
vi.mock("@/lib/saved/api", () => saved);

const { createObjectURL, revokeObjectURL } = URL;

/** Stubs the browser download plumbing jsdom lacks and records what was downloaded. */
function stubDownloads() {
  const downloads: { name: string; href: string }[] = [];
  const stubs = { createObjectURL: vi.fn(() => "blob:mock-url"), revokeObjectURL: vi.fn() };
  Object.assign(URL, stubs);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, href: this.href });
  });
  // Capture the delayed URL release instead of waiting a real second for it.
  const delayed: (() => void)[] = [];
  const realSetTimeout = window.setTimeout;
  vi.spyOn(window, "setTimeout").mockImplementation(((fn: () => void, ms?: number) => {
    if (ms === 1000) return delayed.push(fn);
    return realSetTimeout(fn, ms);
  }) as typeof setTimeout);
  return { downloads, ...stubs, runDelayed: () => delayed.splice(0).forEach((fn) => fn()) };
}

function setup() {
  render(
    <StrictMode>
      <DraftCreator documents={documents} ndaTemplate={realTemplate} />
    </StrictMode>,
  );
  return userEvent.setup();
}

/** Sends a chat message and waits for the AI's scripted reply to appear. */
async function chat(user: ReturnType<typeof userEvent.setup>, text: string, draft: Draft, reply = `Reply to ${text}`) {
  sendChat.mockResolvedValueOnce({ reply, draft });
  await user.type(screen.getByLabelText("Your message"), text);
  await user.keyboard("{Enter}");
  await screen.findByText(reply);
}

const downloadButtons = () => [screen.getByRole("button", { name: "Download PDF" }), screen.getByRole("button", { name: /Download Word|Preparing/ })];

beforeEach(() => {
  toDocx.mockReset();
  documentToDocx.mockReset();
  sendChat.mockReset();
  saved.createDocument.mockReset().mockImplementation(async (draft: Draft, messages: ChatMessage[]) => ({ id: 7, draft, messages }));
  saved.updateDocument.mockReset().mockImplementation(async (id: number, draft: Draft, messages: ChatMessage[]) => ({ id, draft, messages }));
});

afterEach(() => {
  Object.assign(URL, { createObjectURL, revokeObjectURL });
});

describe("DraftCreator", () => {
  it("lists what it can draft until the assistant picks a document", () => {
    setup();
    expect(preview().getByRole("heading", { name: "Your agreement will appear here" })).toBeInTheDocument();
    expect(preview().getAllByRole("listitem").map((li) => li.textContent)).toEqual(documents.map((d) => d.name));
    for (const button of downloadButtons()) expect(button).toBeDisabled();
  });

  it("shows the NDA with its own cover page once the assistant picks it", async () => {
    const user = setup();
    await chat(user, "An NDA between Acme and Globex", ndaDraft);

    expect(preview().getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement" })).toBeInTheDocument();
    expect(preview().getByText("Governing Law: Delaware")).toBeInTheDocument();
    expect(preview().getByText("Expires 2 years from Effective Date.")).toBeInTheDocument();
    expect(preview().getByRole("cell", { name: "Acme Inc." })).toBeInTheDocument();
    for (const button of downloadButtons()) expect(button).toBeEnabled();
  });

  it("shows any other document with a generated cover page and its Standard Terms", async () => {
    const user = setup();
    await chat(user, "A pilot for Globex", pilotDraft);

    expect(preview().getByRole("heading", { level: 1, name: "Pilot Agreement" })).toBeInTheDocument();
    expect(preview().getByText("Provider: Acme Inc.")).toBeInTheDocument();
    expect(preview().getByRole("heading", { level: 3, name: "Pilot Period" })).toBeInTheDocument();
    expect(preview().getByText("90 days")).toBeInTheDocument();
    expect(preview().getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["", "PROVIDER", "CUSTOMER"]);
    expect(preview().getByRole("heading", { level: 3, name: /^1\. / })).toBeInTheDocument();
  });

  it("switches the preview when the assistant switches document, and sends the latest draft", async () => {
    const user = setup();
    await chat(user, "A pilot", pilotDraft);
    await chat(user, "Actually an NDA", ndaDraft);

    expect(preview().getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement" })).toBeInTheDocument();
    expect(sendChat.mock.calls[0][1]).toEqual({ documentId: null, fields: {} });
    expect(sendChat.mock.calls[1][1]).toEqual(pilotDraft);
  });

  it("opens the print dialog for Download PDF", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = setup();
    await chat(user, "A pilot", pilotDraft);
    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(print).toHaveBeenCalledOnce();
  });

  it("downloads the NDA's Word file, named after the companies", async () => {
    const stubs = stubDownloads();
    const blob = new Blob(["docx"]);
    toDocx.mockResolvedValue(blob);
    const user = setup();

    await chat(user, "An NDA", ndaDraft);
    await user.click(screen.getByRole("button", { name: "Download Word" }));

    await waitFor(() => expect(stubs.downloads).toEqual([{ name: "Mutual-NDA-Acme-Inc-Globex-LLC.docx", href: "blob:mock-url" }]));
    expect(stubs.createObjectURL).toHaveBeenCalledWith(blob);
    // The document passed to the exporter is the one shown in the preview.
    expect(toDocx.mock.calls[0][0].signatureRows.find((r) => r.label === "Company")?.values).toEqual(["Acme Inc.", "Globex, LLC"]);
    // The temporary link is removed. There's no accessible role for it, hence the raw DOM check.
    expect(document.querySelector("a[download]")).toBeNull();
    // The object URL is released only after a delay, so the download has time to start.
    expect(stubs.revokeObjectURL).not.toHaveBeenCalled();
    stubs.runDelayed();
    expect(stubs.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("downloads any other document's Word file with its own exporter", async () => {
    const stubs = stubDownloads();
    documentToDocx.mockResolvedValue(new Blob(["docx"]));
    const user = setup();

    await chat(user, "A pilot", pilotDraft);
    await user.click(screen.getByRole("button", { name: "Download Word" }));

    await waitFor(() => expect(stubs.downloads).toEqual([{ name: "Pilot-Agreement-Acme-Inc-Globex-LLC.docx", href: "blob:mock-url" }]));
    expect(documentToDocx.mock.calls[0][0].title).toBe("Pilot Agreement");
    expect(toDocx).not.toHaveBeenCalled();
  });

  it("shows a busy state while the Word file is being prepared", async () => {
    stubDownloads();
    let finish!: (blob: Blob) => void;
    documentToDocx.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = setup();
    await chat(user, "A pilot", pilotDraft);

    await user.click(screen.getByRole("button", { name: "Download Word" }));
    expect(await screen.findByRole("button", { name: "Preparing…" })).toBeDisabled();

    await act(async () => finish(new Blob(["docx"])));
    expect(await screen.findByRole("button", { name: "Download Word" })).toBeEnabled();
  });

  it("shows an error when the Word export fails, and a retry can succeed", async () => {
    const stubs = stubDownloads();
    vi.spyOn(console, "error").mockImplementation(() => {});
    documentToDocx.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(new Blob(["docx"]));
    const user = setup();
    await chat(user, "A pilot", pilotDraft);

    await user.click(screen.getByRole("button", { name: "Download Word" }));
    expect(await screen.findByText("Could not create the Word document. Please try again.")).toBeInTheDocument();
    expect(stubs.downloads).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Download Word" }));
    await waitFor(() => expect(stubs.downloads).toHaveLength(1));
    expect(screen.queryByText("Could not create the Word document. Please try again.")).toBeNull();
  });

  it("saves nothing until the assistant picks a document", async () => {
    const user = setup();
    await chat(user, "Hello", { documentId: null, fields: { party1Company: "Acme Inc." } });
    expect(saved.createDocument).not.toHaveBeenCalled();
    expect(screen.getByTestId("save-status")).toHaveTextContent("Saved automatically once the assistant picks your document.");
  });

  it("saves the document after the first turn, then updates the same one after each turn", async () => {
    const onCreated = vi.fn();
    render(<DraftCreator documents={documents} ndaTemplate={realTemplate} onCreated={onCreated} />);
    const user = userEvent.setup();

    await chat(user, "A pilot", pilotDraft, "Pilot it is.");
    await waitFor(() => expect(screen.getByTestId("save-status")).toHaveTextContent("All changes saved"));
    expect(saved.createDocument).toHaveBeenCalledOnce();
    const [draft, messages] = saved.createDocument.mock.calls[0];
    expect(draft).toEqual(pilotDraft);
    expect(messages.map((m: ChatMessage) => m.content).slice(1)).toEqual(["A pilot", "Pilot it is."]);
    expect(onCreated).toHaveBeenCalledWith(7);

    await chat(user, "Actually an NDA", ndaDraft);
    await waitFor(() => expect(saved.updateDocument).toHaveBeenCalledOnce());
    expect(saved.updateDocument.mock.calls[0].slice(0, 2)).toEqual([7, ndaDraft]);
    expect(saved.createDocument).toHaveBeenCalledOnce();
  });

  it("creates the document only once when a second turn finishes before the first save", async () => {
    let finishCreate!: () => void;
    saved.createDocument.mockImplementationOnce(
      (draft: Draft, messages: ChatMessage[]) => new Promise((resolve) => (finishCreate = () => resolve({ id: 7, draft, messages }))),
    );
    const user = setup();
    await chat(user, "A pilot", pilotDraft);
    await chat(user, "With Globex", pilotDraft, "Noted.");
    await chat(user, "And 90 days", pilotDraft, "Got it.");
    expect(screen.getByTestId("save-status")).toHaveTextContent("Saving…");

    await act(async () => finishCreate());
    await waitFor(() => expect(screen.getByTestId("save-status")).toHaveTextContent("All changes saved"));
    expect(saved.createDocument).toHaveBeenCalledOnce();
    // The two turns that waited are sent as one update with the newest conversation.
    expect(saved.updateDocument).toHaveBeenCalledOnce();
    expect(saved.updateDocument.mock.calls[0][2].at(-1)).toEqual({ role: "assistant", content: "Got it." });
  });

  it("says when saving failed and can try again", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    saved.createDocument.mockRejectedValueOnce(new Error("offline"));
    const user = setup();
    await chat(user, "A pilot", pilotDraft);

    const status = screen.getByTestId("save-status");
    await waitFor(() => expect(status).toHaveTextContent("Couldn't save your latest changes."));
    // The chat carries on regardless.
    expect(screen.getByLabelText("Your message")).toBeEnabled();

    await user.click(within(status).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(status).toHaveTextContent("All changes saved"));
    expect(saved.createDocument).toHaveBeenCalledTimes(2);
  });

  it("resumes a saved document: its preview and conversation, saving to the same document", async () => {
    const messages: ChatMessage[] = [
      { role: "assistant", content: "Hi!" },
      { role: "user", content: "A pilot for Acme and Globex." },
      { role: "assistant", content: "What is the product?" },
    ];
    render(<DraftCreator documents={documents} ndaTemplate={realTemplate} saved={{ id: 3, draft: pilotDraft, messages }} />);
    expect(preview().getByRole("heading", { level: 1, name: "Pilot Agreement" })).toBeInTheDocument();
    expect(screen.getByText("What is the product?")).toBeInTheDocument();

    await chat(userEvent.setup(), "Acme Analytics", pilotDraft);
    await waitFor(() => expect(saved.updateDocument).toHaveBeenCalledOnce());
    expect(saved.updateDocument.mock.calls[0][0]).toBe(3);
    expect(saved.createDocument).not.toHaveBeenCalled();
  });

  it("puts the draft notice on the agreement", async () => {
    const user = setup();
    await chat(user, "A pilot", pilotDraft);
    const notice = preview().getByRole("complementary", { name: "Draft notice" });
    expect(notice).toHaveTextContent("Draft: subject to legal review");
    expect(notice).toHaveTextContent("It is not legal advice.");
  });

  it("does not report a new document's id once the page has been left", async () => {
    let finishCreate!: () => void;
    saved.createDocument.mockImplementationOnce(
      (draft: Draft, messages: ChatMessage[]) => new Promise((resolve) => (finishCreate = () => resolve({ id: 7, draft, messages }))),
    );
    const onCreated = vi.fn();
    const { unmount } = render(<DraftCreator documents={documents} ndaTemplate={realTemplate} onCreated={onCreated} />);
    await chat(userEvent.setup(), "A pilot", pilotDraft);

    unmount();
    await act(async () => finishCreate());
    expect(saved.createDocument).toHaveBeenCalledOnce();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
