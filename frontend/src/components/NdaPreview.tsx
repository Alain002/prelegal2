import type { Inline, NdaDocument } from "@/lib/nda/types";

function InlineText({ inlines }: { inlines: Inline[] }) {
  return inlines.map((inline, i) => {
    switch (inline.kind) {
      case "bold":
        return <strong key={i}>{inline.text}</strong>;
      case "term":
        return (
          <span key={i} className="font-semibold underline decoration-dotted underline-offset-2">
            {inline.text}
          </span>
        );
      case "link":
        return (
          <a key={i} href={inline.href} className="text-blue-700 underline" target="_blank" rel="noreferrer">
            {inline.text}
          </a>
        );
      default:
        return <span key={i}>{inline.text}</span>;
    }
  });
}

/** A paper-style rendering of the completed agreement; also used for printing to PDF. */
export function NdaPreview({ nda }: { nda: NdaDocument }) {
  return (
    <article className="mx-auto max-w-[8.5in] bg-white px-10 py-12 font-serif text-[15px] leading-relaxed text-neutral-900 shadow-sm ring-1 ring-neutral-200 print:max-w-none print:p-0 print:shadow-none print:ring-0">
      <h1 className="mb-6 text-center text-2xl font-bold">{nda.title}</h1>

      <section>
        <h2 className="mb-3 text-lg font-bold uppercase tracking-wide">Cover Page</h2>
        <p className="mb-6">
          <InlineText inlines={nda.coverIntro} />
        </p>

        {nda.coverFields.map((field) => (
          <div key={field.heading} className="mb-4 break-inside-avoid">
            <h3 className="font-bold">{field.heading}</h3>
            {field.hint && <p className="text-xs italic text-neutral-500">{field.hint}</p>}
            {field.lines.map((line, i) => (
              // Lines can repeat (e.g. identical values), so key by position.
              <p key={i} className="whitespace-pre-line">
                {line}
              </p>
            ))}
          </div>
        ))}

        <p className="mt-6 mb-3">{nda.signingStatement}</p>
        <table className="w-full break-inside-avoid border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-1/3 border border-neutral-400 p-2" />
              {nda.signatureRows[0].values.map((_, i) => (
                <th key={i} className="w-1/3 border border-neutral-400 p-2">
                  PARTY {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nda.signatureRows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="border border-neutral-400 p-2 text-left align-top font-semibold">
                  {row.label}
                  {row.hint && <span className="block text-xs font-normal italic text-neutral-500">{row.hint}</span>}
                </th>
                {row.values.map((value, i) => (
                  <td key={i} className="h-10 whitespace-pre-line border border-neutral-400 p-2 align-top">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-12 print:break-before-page">
        <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">Standard Terms</h2>
        <ol className="space-y-3 text-justify">
          {nda.clauses.map((clause) => (
            <li key={clause.number}>
              <strong>
                {clause.number}. {clause.title}.
              </strong>{" "}
              <InlineText inlines={clause.body} />
            </li>
          ))}
        </ol>
        <p className="mt-8 text-xs text-neutral-600">
          <InlineText inlines={nda.attribution} />
        </p>
      </section>
    </article>
  );
}
