import { afterEach, describe, expect, it, vi } from "vitest";
import { pilotDraft } from "@/test/fixtures";
import { GENERIC_ERROR, sendChat, type ChatMessage } from "./api";

const messages: ChatMessage[] = [
  { role: "assistant", content: "Hi!" },
  { role: "user", content: "Acme and Globex." },
];

function stubFetch(response: Response | Error) {
  const fetch = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("sendChat", () => {
  it("posts the conversation, the draft and the user's date, and returns the AI's turn", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 23:30 local (Los Angeles) is already October 29 in UTC.
    vi.setSystemTime(new Date(2026, 9, 28, 23, 30));
    const turn = { reply: "Who signs for Acme?", draft: pilotDraft };
    const fetch = stubFetch(json(turn));

    await expect(sendChat(messages, pilotDraft)).resolves.toEqual(turn);

    expect(fetch).toHaveBeenCalledWith("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, draft: pilotDraft, today: "2026-10-28" }),
    });
  });

  it("accepts a draft with no document chosen yet", async () => {
    const turn = { reply: "Which document?", draft: { documentId: null, fields: {} } };
    stubFetch(json(turn));
    await expect(sendChat(messages, turn.draft)).resolves.toEqual(turn);
  });

  it("shows the backend's message when the AI is unavailable", async () => {
    stubFetch(json({ detail: "The AI assistant is unavailable right now. Please try again." }, 502));
    await expect(sendChat(messages, pilotDraft)).rejects.toThrow("The AI assistant is unavailable right now.");
  });

  it.each([
    ["a validation error", json({ detail: [{ msg: "field required" }] }, 422)],
    ["a server error without JSON", new Response("Internal Server Error", { status: 500 })],
    ["a 502 without a message", new Response("Bad Gateway", { status: 502 })],
    ["a malformed answer", json({ reply: "Hi" })],
    ["an answer without fields", json({ reply: "Hi", draft: { documentId: "pilot" } })],
    ["an answer with a bad document id", json({ reply: "Hi", draft: { documentId: 3, fields: {} } })],
  ])("shows a generic message for %s", async (_, response) => {
    stubFetch(response);
    await expect(sendChat(messages, pilotDraft)).rejects.toThrow(GENERIC_ERROR);
  });

  it("explains when the server can't be reached", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    await expect(sendChat(messages, pilotDraft)).rejects.toThrow("Could not reach Prelegal");
  });
});
