import { useState } from "react";
import type { Draft } from "@/lib/documents/types";
import { sendChat, type ChatMessage } from "./api";

/**
 * How many recent messages are sent to the AI. The current draft already holds everything
 * agreed so far, and the cap keeps long conversations within the backend's limit (60).
 */
export const MAX_HISTORY = 40;

export const GREETING =
  "Hi! I can help you draft a legal agreement, such as a Mutual NDA, a Cloud Service Agreement or a Pilot Agreement. What would you like to create, and who is it between?";

/**
 * The conversation with the AI. It lives only in the browser: each turn sends the whole
 * conversation and the current draft, and applies the draft the AI sends back.
 */
export function useChat(draft: Draft, onDraft: (draft: Draft) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: GREETING }]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(history: ChatMessage[]) {
    setPending(true);
    setError(null);
    try {
      const turn = await sendChat(history.slice(-MAX_HISTORY), draft);
      setMessages([...history, { role: "assistant", content: turn.reply }]);
      onDraft(turn.draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  /** Sends a message. Returns false when there was nothing to send or a reply is still on its way. */
  function send(text: string): boolean {
    const content = text.trim();
    if (!content || pending) return false;
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    void request(history);
    return true;
  }

  /** Asks again after an error, without repeating the user's message. */
  function retry() {
    if (!pending) void request(messages);
  }

  return { messages, pending, error, send, retry };
}
