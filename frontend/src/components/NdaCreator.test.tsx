// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage, ChatTurn } from "@/lib/chat/api";
import type { NdaDocument, NdaValues } from "@/lib/nda/types";
import { filledValues, realTemplate } from "@/test/fixtures";
import { preview } from "@/test/queries";
import { NdaCreator } from "./NdaCreator";

// The real Word export is covered by toDocx.test.ts and the end-to-end tests.
const toDocx = vi.hoisted(() => vi.fn<(nda: NdaDocument) => Promise<Blob>>());
vi.mock("@/lib/nda/toDocx", () => ({ toDocx }));

// The AI is faked: each test scripts what it answers.
const sendChat = vi.hoisted(() => vi.fn<(messages: ChatMessage[], values: NdaValues) => Promise<ChatTurn>>());
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
      <NdaCreator template={realTemplate} />
    </StrictMode>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  toDocx.mockReset();
  sendChat.mockReset();
});

/** Sends a chat message and waits for the AI's scripted reply to appear. */
async function chat(user: ReturnType<typeof userEvent.setup>, text: string, turn: ChatTurn) {
  sendChat.mockResolvedValueOnce(turn);
  await user.type(screen.getByLabelText("Your message"), text);
  await user.keyboard("{Enter}");
  await screen.findByText(turn.reply);
}

afterEach(() => {
  Object.assign(URL, { createObjectURL, revokeObjectURL });
});

describe("NdaCreator", () => {
  it("defaults the effective date to today in the user's timezone and sends it to the AI", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 23:30 local (Los Angeles) is already October 29 in UTC.
    vi.setSystemTime(new Date(2026, 9, 28, 23, 30));
    const user = setup();
    expect(await preview().findByText("October 28, 2026")).toBeInTheDocument();

    await chat(user, "Hello", { reply: "Hi there!", values: filledValues });
    expect(sendChat.mock.calls[0][1].effectiveDate).toBe("2026-10-28");
  });

  it("fills in the preview from the AI's answers", async () => {
    const user = setup();
    expect(preview().getByText("Governing Law: [Governing Law]")).toBeInTheDocument();

    await chat(user, "Acme and Globex, Delaware law, 2 years.", { reply: "Noted! Who signs?", values: filledValues });

    expect(preview().getByText("Governing Law: Delaware")).toBeInTheDocument();
    expect(preview().getByText("Expires 2 years from Effective Date.")).toBeInTheDocument();
    expect(preview().getByRole("cell", { name: "Acme Inc." })).toBeInTheDocument();
    expect(preview().getByText("November 1, 2026")).toBeInTheDocument();
  });

  it("sends the latest values with each message", async () => {
    const user = setup();
    await chat(user, "First", { reply: "One", values: filledValues });
    await chat(user, "Second", { reply: "Two", values: { ...filledValues, governingLaw: "Texas" } });

    expect(sendChat.mock.calls[1][1]).toEqual(filledValues);
    expect(preview().getByText("Governing Law: Texas")).toBeInTheDocument();
  });

  it("opens the print dialog for Download PDF", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(print).toHaveBeenCalledOnce();
  });

  it("downloads the Word file the exporter produced, named after the companies", async () => {
    const stubs = stubDownloads();
    const blob = new Blob(["docx"]);
    toDocx.mockResolvedValue(blob);
    const user = setup();

    const [one, two] = filledValues.parties;
    const parties: NdaValues["parties"] = [{ ...one, company: "Acme" }, { ...two, company: "Globex" }];
    await chat(user, "Acme and Globex", { reply: "Great.", values: { ...filledValues, parties } });
    await user.click(screen.getByRole("button", { name: "Download Word" }));

    await waitFor(() => expect(stubs.downloads).toEqual([{ name: "Mutual-NDA-Acme-Globex.docx", href: "blob:mock-url" }]));
    expect(stubs.createObjectURL).toHaveBeenCalledWith(blob);
    // The document passed to the exporter is the one shown in the preview.
    const nda = toDocx.mock.calls[0][0];
    expect(nda.signatureRows.find((r) => r.label === "Company")?.values).toEqual(["Acme", "Globex"]);
    // The temporary link is removed. There's no accessible role for it, hence the raw DOM check.
    expect(document.querySelector("a[download]")).toBeNull();
    // The object URL is released only after a delay, so the download has time to start.
    expect(stubs.revokeObjectURL).not.toHaveBeenCalled();
    stubs.runDelayed();
    expect(stubs.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("shows a busy state while the Word file is being prepared", async () => {
    stubDownloads();
    let finish!: (blob: Blob) => void;
    toDocx.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = setup();

    await user.click(screen.getByRole("button", { name: "Download Word" }));
    expect(await screen.findByRole("button", { name: "Preparing…" })).toBeDisabled();

    await act(async () => finish(new Blob(["docx"])));
    expect(await screen.findByRole("button", { name: "Download Word" })).toBeEnabled();
  });

  it("shows an error when the Word export fails, and a retry can succeed", async () => {
    const stubs = stubDownloads();
    vi.spyOn(console, "error").mockImplementation(() => {});
    toDocx.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(new Blob(["docx"]));
    const user = setup();

    await user.click(screen.getByRole("button", { name: "Download Word" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not create the Word document");
    expect(screen.getByRole("button", { name: "Download Word" })).toBeEnabled();
    expect(stubs.downloads).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Download Word" }));
    await waitFor(() => expect(stubs.downloads).toHaveLength(1));
    expect(toDocx).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
