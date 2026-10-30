/** The user's saved documents (/api/documents): each a draft and the conversation that produced it. */

import { api } from "@/lib/api";
import type { ChatMessage } from "@/lib/chat/api";
import type { Draft } from "@/lib/documents/types";

/**
 * How many messages a saved conversation keeps (the latest ones). Matches MAX_SAVED_MESSAGES in
 * backend/app/routers/documents.py.
 */
export const MAX_SAVED_MESSAGES = 200;

export type SavedSummary = {
  id: number;
  documentId: string;
  documentName: string;
  /** "Acme Inc. / Globex LLC", or null until a party is known. */
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavedDocument = SavedSummary & { draft: Draft; messages: ChatMessage[] };

export async function listDocuments(): Promise<SavedSummary[]> {
  return (await api<{ documents: SavedSummary[] }>("/api/documents")).documents;
}

export function getDocument(id: number): Promise<SavedDocument> {
  return api(`/api/documents/${id}`);
}

const body = (draft: Draft, messages: ChatMessage[]) => ({ draft, messages: messages.slice(-MAX_SAVED_MESSAGES) });

export function createDocument(draft: Draft, messages: ChatMessage[]): Promise<SavedDocument> {
  return api("/api/documents", { method: "POST", body: body(draft, messages) });
}

export function updateDocument(id: number, draft: Draft, messages: ChatMessage[]): Promise<SavedDocument> {
  return api(`/api/documents/${id}`, { method: "PUT", body: body(draft, messages) });
}

export function deleteDocument(id: number): Promise<void> {
  return api(`/api/documents/${id}`, { method: "DELETE" });
}
