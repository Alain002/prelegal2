import type { NdaValues } from "@/lib/nda/types";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatTurn = { reply: string; values: NdaValues };

export const GENERIC_ERROR = "Something went wrong. Please try again.";

/** Sends the conversation and the agreement so far; returns the AI's reply and updated values. */
export async function sendChat(messages: ChatMessage[], values: NdaValues): Promise<ChatTurn> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, values }),
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
  if (!body || typeof body !== "object" || !("reply" in body) || !("values" in body)) return false;
  const { reply, values } = body as { reply: unknown; values: { parties?: unknown } | null };
  return typeof reply === "string" && Array.isArray(values?.parties) && values.parties.length === 2;
}
