"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useChat } from "@/lib/chat/useChat";
import type { NdaValues } from "@/lib/nda/types";

// Matches the backend's limit on one message (MAX_MESSAGE_LENGTH in backend/app/routers/chat.py).
const MAX_LENGTH = 4000;

/** The AI chat that fills in the agreement. */
export function Chat({ values, onValues }: { values: NdaValues; onValues: (values: NdaValues) => void }) {
  const { messages, pending, error, send, retry } = useChat(values, onValues);
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending, error]);

  function submit() {
    if (send(draft)) setDraft("");
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
        <div role="alert" className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={retry} className="shrink-0 font-semibold underline">
            Try again
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-neutral-200 p-3">
        <label htmlFor="chat-message" className="sr-only">
          Your message
        </label>
        <textarea
          id="chat-message"
          rows={2}
          maxLength={MAX_LENGTH}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer…"
          className="min-h-[2.75rem] flex-1 resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="rounded-md bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-purple/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </section>
  );
}
