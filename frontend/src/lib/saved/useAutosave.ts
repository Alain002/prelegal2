import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat/api";
import type { Draft } from "@/lib/documents/types";
import { createDocument, updateDocument } from "./api";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type Snapshot = { draft: Draft; messages: ChatMessage[] };

/**
 * Saves the document after every chat turn: created on the first save once the AI has picked a
 * document, updated after that. Saves run one at a time and only the newest waiting snapshot is
 * sent, so a quick second turn can't create a duplicate or be overwritten by an older one.
 *
 * `id` is the saved document being edited, if any. `onCreated` is told the new id once, unless the
 * component has unmounted by then.
 */
export function useAutosave(id: number | null, onCreated?: (id: number) => void) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const idRef = useRef(id);
  const waiting = useRef<Snapshot | null>(null);
  const latest = useRef<Snapshot | null>(null);
  const running = useRef(false);
  // A save still finishes after the user leaves the page, but must not then act on the page.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function flush() {
    if (running.current) return;
    running.current = true;
    while (waiting.current) {
      const { draft, messages } = waiting.current;
      waiting.current = null;
      setStatus("saving");
      try {
        if (idRef.current === null) {
          idRef.current = (await createDocument(draft, messages)).id;
          if (mounted.current) onCreated?.(idRef.current);
        } else {
          await updateDocument(idRef.current, draft, messages);
        }
        if (!waiting.current) setStatus("saved");
      } catch (e) {
        console.warn("Could not save the document", e);
        // A newer snapshot still waiting gets its own try; otherwise wait for a retry or the next turn.
        if (!waiting.current) setStatus("error");
      }
    }
    running.current = false;
  }

  /** Saves this snapshot, after any save in progress. Nothing is saved before a document is chosen. */
  function save(draft: Draft, messages: ChatMessage[]) {
    if (!draft.documentId) return;
    latest.current = waiting.current = { draft, messages };
    void flush();
  }

  /** Tries the newest snapshot again after a failure. */
  function retry() {
    if (!latest.current) return;
    waiting.current = latest.current;
    void flush();
  }

  return { status, save, retry };
}
