import type { Draft } from "@/lib/documents/types";
import { todayIso } from "@/lib/today";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatTurn = { reply: string; draft: Draft };

export const GENERIC_ERROR = "Something went wrong. Please try again.";

/** Sends the conversation and the draft so far; returns the AI's reply and the updated draft. */
export async function sendChat(messages: ChatMessage[], draft: Draft): Promise<ChatTurn> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The user's own date, so "today" is right in their timezone.
      body: JSON.stringify({ messages, draft, today: todayIso() }),
    });
  } catch {
    throw new Error("Could not reach Prelegal. Check your connection and try again.");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // The backend's 502 carries a message written for users; anything else gets a generic one.
    const detail = response.status === 502 && body && typeof body === "object" && "detail" in body ? body.detail : null;
    throw new Error(typeof detail === "string" ? detail : GENERIC_ERROR);
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
