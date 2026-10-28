import { NdaCreator } from "@/components/NdaCreator";
import { loadNdaTemplate } from "@/lib/nda/loadTemplate";

// Read once at module scope: the templates are static files, so the page prerenders.
const template = loadNdaTemplate();

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 print:p-0">
      <header className="mb-8 print:hidden">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Prelegal</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Mutual NDA Creator</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          Fill in the details below to create a Mutual Non-Disclosure Agreement based on the Common Paper
          standard. The preview updates as you type.
        </p>
      </header>
      <NdaCreator template={template} />
    </main>
  );
}
