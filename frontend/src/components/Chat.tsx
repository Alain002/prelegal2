"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ChatMessage } from "@/lib/chat/api";
import { useChat } from "@/lib/chat/useChat";
import type { Draft } from "@/lib/documents/types";
import { Alert, Button, cx, inputClass } from "./ui";

// Matches the backend's limit on one message (MAX_MESSAGE_LENGTH in backend/app/routers/chat.py).
const MAX_LENGTH = 4000;

/** The AI chat that chooses the document and fills it in. `initialMessages` resumes a saved chat. */
export function Chat({
  draft,
  onTurn,
  initialMessages,
}: {
  draft: Draft;
  onTurn: (draft: Draft, messages: ChatMessage[]) => void;
  initialMessages?: ChatMessage[];
}) {
  const { messages, pending, error, send, retry } = useChat(draft, onTurn, initialMessages);
  const [text, setText] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending, error]);

  function submit() {
    if (send(text)) setText("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  // Enter sends; Shift+Enter starts a new line.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <section
      aria-label="AI assistant"
      className="flex h-[32rem] min-h-0 flex-col rounded-lg bg-white shadow-sm ring-1 ring-neutral-200 lg:h-auto lg:flex-1"
    >
      <div ref={logRef} role="log" aria-label="Conversation" className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message, i) => (
          <div key={i} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <p
              className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm ${
                message.role === "user" ? "bg-brand-navy text-white" : "bg-neutral-100 text-neutral-900"
              }`}
            >
              <span className="sr-only">{message.role === "user" ? "You: " : "Assistant: "}</span>
              {message.content}
            </p>
          </div>
        ))}
      </div>

      {/* Outside the conversation log, so screen readers don't announce it twice. */}
      {pending && (
        <p role="status" className="px-4 pb-2 text-sm text-neutral-600">
          Assistant is typing…
        </p>
      )}

      {error && (
        <Alert action={{ label: "Try again", onClick: retry }} className="mx-4 mb-2">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-neutral-200 p-3">
        <label htmlFor="chat-message" className="sr-only">
          Your message
        </label>
        <textarea
          id="chat-message"
          rows={2}
          maxLength={MAX_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer…"
          className={cx("min-h-[2.75rem] flex-1 resize-none text-sm", inputClass)}
        />
        <Button type="submit" disabled={pending || !text.trim()}>
          Send
        </Button>
      </form>
    </section>
  );
}
