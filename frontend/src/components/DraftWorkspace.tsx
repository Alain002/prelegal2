"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, errorMessage } from "@/lib/api";
import type { DocumentInfo } from "@/lib/documents/types";
import type { NdaTemplate } from "@/lib/nda/types";
import { getDocument } from "@/lib/saved/api";
import { DraftCreator, type SavedStart } from "./DraftCreator";
import { Alert, ButtonLink, Loading } from "./ui";

type Props = { documents: DocumentInfo[]; ndaTemplate: NdaTemplate };

/**
 * The drafting page's content: a new draft at /draft/, or a saved one at /draft/?id=N. (The site is
 * statically exported, so the id is a query parameter rather than part of the path.)
 *
 * When a new draft is first saved, the address becomes /draft/?id=N so a reload reopens it. That
 * is not a navigation: the draft on screen, and its conversation, stay as they are.
 */
export function DraftWorkspace(props: Props) {
  const param = useSearchParams().get("id");
  const [view, setView] = useState({ param, key: 0 });
  const [created, setCreated] = useState<string | null>(null);

  // A different document, or a new one: start afresh. Recorded during render (React's pattern for
  // state derived from a changing value) so the old draft is never shown with the new address.
  // The one exception is the address a new draft gave itself on its first save. That only counts
  // once, straight from /draft/: coming back to it later (e.g. with Back) reopens it from the server.
  if (param !== view.param) {
    const ownSave = view.param === null && param !== null && param === created;
    setCreated(null);
    setView({ param, key: ownSave ? view.key : view.key + 1 });
  }

  function handleCreated(id: number) {
    setCreated(String(id));
    window.history.replaceState(null, "", `/draft/?id=${id}`);
  }

  // The key decides when to start afresh; the id is read only when a source first mounts.
  return <DraftSource key={view.key} id={view.param} onCreated={handleCreated} {...props} />;
}

type Source = { kind: "new" } | { kind: "loading" } | { kind: "ready"; saved: SavedStart } | { kind: "missing" } | { kind: "error"; message: string };

const parseId = (param: string) => (/^[1-9]\d{0,15}$/.test(param) ? Number(param) : null);

function initialSource(id: string | null): Source {
  if (id === null) return { kind: "new" };
  return parseId(id) === null ? { kind: "missing" } : { kind: "loading" };
}

function DraftSource({ id, onCreated, documents, ndaTemplate }: Props & { id: string | null; onCreated: (id: number) => void }) {
  // Only the id this source started with counts: after a first save the address gains the new id,
  // which must not reload what is already on screen.
  const [startId] = useState(id);
  const [source, setSource] = useState<Source>(() => initialSource(startId));

  useEffect(() => {
    const documentId = startId === null ? null : parseId(startId);
    if (documentId === null) return;
    let current = true;
    getDocument(documentId).then(
      (doc) => current && setSource({ kind: "ready", saved: { id: doc.id, draft: doc.draft, messages: doc.messages } }),
      (e: unknown) => {
        if (!current) return;
        if (e instanceof ApiError && e.status === 404) setSource({ kind: "missing" });
        else setSource({ kind: "error", message: errorMessage(e) });
      },
    );
    return () => {
      current = false;
    };
  }, [startId]);

  switch (source.kind) {
    case "new":
      return <DraftCreator documents={documents} ndaTemplate={ndaTemplate} onCreated={onCreated} />;
    case "ready":
      return <DraftCreator documents={documents} ndaTemplate={ndaTemplate} saved={source.saved} />;
    case "loading":
      return <Loading label="Opening your document…" />;
    case "missing":
    case "error":
      return (
        <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
          <Alert>{source.kind === "missing" ? "We couldn't find that document. It may have been deleted." : source.message}</Alert>
          <div className="flex justify-center gap-2">
            <ButtonLink href="/documents/" variant="secondary">
              My documents
            </ButtonLink>
            <ButtonLink href="/draft/">Start a new document</ButtonLink>
          </div>
        </div>
      );
  }
}
