import { useState } from "react";
import type { NdaValues } from "@/lib/nda/types";
import { sendChat, type ChatMessage } from "./api";

/**
 * How many recent messages are sent to the AI. The current values already hold everything
 * agreed so far, and the cap keeps long conversations within the backend's limit (60).
 */
export const MAX_HISTORY = 40;

export const GREETING =
  "Hi! I'll help you draft a Mutual Non-Disclosure Agreement. To start, who are the two parties, and what will they be sharing confidential information for?";

/**
 * The conversation with the AI. It lives only in the browser: each turn sends the whole
 * conversation and the current agreement, and applies the values the AI sends back.
 */
export function useChat(values: NdaValues, onValues: (values: NdaValues) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: GREETING }]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(history: ChatMessage[]) {
    setPending(true);
    setError(null);
    try {
      const turn = await sendChat(history.slice(-MAX_HISTORY), values);
      setMessages([...history, { role: "assistant", content: turn.reply }]);
      onValues(turn.values);
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
