import type { AgreementDocument, TermNode } from "@/lib/documents/types";
import { AgreementPage, InlineText } from "./DocumentParts";

function Clause({ node, depth }: { node: TermNode; depth: number }) {
  return (
    <li className={depth === 0 ? "mt-5" : "mt-2"}>
      {depth === 0 ? (
        <>
          <h3 className="mb-1 font-bold">
            {node.label} <InlineText inlines={node.heading} />
          </h3>
          {node.body.length > 0 && (
            <p className="text-justify">
              <InlineText inlines={node.body} />
            </p>
          )}
        </>
      ) : (
        <p className="text-justify">
          <span className="font-semibold">{node.label}</span>{" "}
          {node.heading.length > 0 && (
            <strong>
              <InlineText inlines={node.heading} />
            </strong>
          )}{" "}
          <InlineText inlines={node.body} />
        </p>
      )}
      {node.children.length > 0 && <Clauses nodes={node.children} depth={depth + 1} />}
    </li>
  );
}

function Clauses({ nodes, depth }: { nodes: TermNode[]; depth: number }) {
  // The numbers are part of the text, so the list markers are hidden.
  return (
    <ol className={`list-none ${depth > 0 ? "pl-6" : ""}`}>
      {nodes.map((node) => (
        <Clause key={node.label} node={node} depth={depth} />
      ))}
    </ol>
  );
}

/** A completed agreement other than the NDA: its generated cover page and nested Standard Terms. */
export function DocumentPreview({ doc }: { doc: AgreementDocument }) {
  return (
    <AgreementPage doc={doc}>
      <Clauses nodes={doc.terms} depth={0} />
    </AgreementPage>
  );
}
