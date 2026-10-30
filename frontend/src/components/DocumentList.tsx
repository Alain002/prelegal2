"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/api";
import { deleteDocument, listDocuments, type SavedSummary } from "@/lib/saved/api";
import { Alert, Button, ButtonLink, Card, EmptyState, Loading } from "./ui";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; documents: SavedSummary[] };

/** The signed-in user's saved documents, newest first, to reopen or delete. */
export function DocumentList() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    listDocuments().then(
      (documents) => current && setState({ kind: "ready", documents }),
      (e: unknown) => current && setState({ kind: "error", message: errorMessage(e) }),
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  function reload() {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }

  function removed(id: number) {
    setState((s) => (s.kind === "ready" ? { kind: "ready", documents: s.documents.filter((d) => d.id !== id) } : s));
  }

  if (state.kind === "loading") return <Loading label="Loading your documents…" />;

  if (state.kind === "error") {
    return <Alert action={{ label: "Try again", onClick: reload }}>{state.message}</Alert>;
  }

  if (state.documents.length === 0) {
    return (
      <EmptyState title="No documents yet" className="py-14 text-center">
        <p className="mx-auto mt-2 max-w-md text-neutral-600">
          Everything you draft with the assistant is saved here automatically, so you can come back to it later.
        </p>
        <ButtonLink href="/draft/" className="mt-6">
          Draft your first agreement
        </ButtonLink>
      </EmptyState>
    );
  }

  return (
    <Card>
      <ul aria-label="Saved documents" className="divide-y divide-neutral-200">
        {state.documents.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} onDeleted={() => removed(doc.id)} />
        ))}
      </ul>
    </Card>
  );
}

function DocumentRow({ doc, onDeleted }: { doc: SavedSummary; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const href = `/draft/?id=${doc.id}`;
  const name = doc.title ?? doc.documentName;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteDocument(doc.id);
      onDeleted();
    } catch (e) {
      setError(errorMessage(e));
      setDeleting(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link href={href} className="block truncate font-semibold text-brand-navy hover:underline">
          {name}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">{doc.documentName}</span>
          <span>Last edited {dateFormat.format(new Date(doc.updatedAt))}</span>
        </p>
        {error && <Alert className="mt-2">{error}</Alert>}
      </div>
      <div className="flex shrink-0 gap-2">
        {confirming ? (
          <>
            <Button variant="danger" busy={deleting} onClick={handleDelete} aria-label={`Confirm delete ${name}`}>
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <ButtonLink href={href} variant="secondary" aria-label={`Open ${name}`}>
              Open
            </ButtonLink>
            <Button variant="ghost" onClick={() => setConfirming(true)} aria-label={`Delete ${name}`}>
              Delete
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
