import { api, ApiError, GENERIC_ERROR } from "@/lib/api";
import type { Draft } from "@/lib/documents/types";
import { todayIso } from "@/lib/today";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatTurn = { reply: string; draft: Draft };

// Errors whose message is written for users: the backend's 502 (the AI is unavailable), no
// connection, and an ended session. Anything else is a bug the user can't fix.
const SHOWN = new Set([0, 401, 502]);

/** Sends the conversation and the draft so far; returns the AI's reply and the updated draft. */
export async function sendChat(messages: ChatMessage[], draft: Draft): Promise<ChatTurn> {
  let body: unknown;
  try {
    // The user's own date, so "today" is right in their timezone.
    body = await api("/api/chat", { method: "POST", body: { messages, draft, today: todayIso() } });
  } catch (e) {
    throw new Error(e instanceof ApiError && SHOWN.has(e.status) ? e.message : GENERIC_ERROR);
  }
  if (!isChatTurn(body)) throw new Error(GENERIC_ERROR);
  return body;
}

function isChatTurn(body: unknown): body is ChatTurn {
  if (!body || typeof body !== "object" || !("reply" in body) || !("draft" in body)) return false;
  const { reply, draft } = body as { reply: unknown; draft: { documentId?: unknown; fields?: unknown } | null };
  return (
    typeof reply === "string" &&
    (typeof draft?.documentId === "string" || draft?.documentId === null) &&
    typeof draft.fields === "object" &&
    draft.fields !== null
  );
}
