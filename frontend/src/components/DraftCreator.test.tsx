// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
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
});
