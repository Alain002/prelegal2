import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/chat/api";
import { sentBody, stubApi } from "@/test/api";
import { pilotDraft } from "@/test/fixtures";
import { createDocument, deleteDocument, getDocument, listDocuments, MAX_SAVED_MESSAGES, updateDocument } from "./api";

const message = (n: number): ChatMessage => ({ role: n % 2 ? "user" : "assistant", content: `Message ${n}` });

describe("saved documents API", () => {
  it("lists, reads, creates, updates and deletes", async () => {
    const doc = { id: 4, draft: pilotDraft, messages: [message(0)] };
    const fetch = stubApi({
      "GET /api/documents": { body: { documents: [{ id: 4 }] } },
      "GET /api/documents/4": { body: doc },
      "POST /api/documents": { status: 201, body: doc },
      "PUT /api/documents/4": { body: doc },
      "DELETE /api/documents/4": { status: 204 },
    });
    await expect(listDocuments()).resolves.toEqual([{ id: 4 }]);
    await expect(getDocument(4)).resolves.toEqual(doc);
    await expect(createDocument(pilotDraft, [message(0)])).resolves.toEqual(doc);
    expect(sentBody(fetch, 2)).toEqual({ draft: pilotDraft, messages: [message(0)] });
    await expect(updateDocument(4, pilotDraft, [message(0)])).resolves.toEqual(doc);
    expect(sentBody(fetch, 3)).toEqual({ draft: pilotDraft, messages: [message(0)] });
    await expect(deleteDocument(4)).resolves.toBeUndefined();
  });

  it("saves only the latest messages of a very long conversation", async () => {
    const fetch = stubApi({ "POST /api/documents": { status: 201, body: {} } });
    const long = Array.from({ length: MAX_SAVED_MESSAGES + 5 }, (_, n) => message(n));
    await createDocument(pilotDraft, long);
    const sent = sentBody(fetch).messages;
    expect(sent).toHaveLength(MAX_SAVED_MESSAGES);
    expect(sent[0]).toEqual(message(5));
  });
});
