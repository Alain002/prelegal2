# Prelegal frontend

A Next.js app, exported as static files and served by the FastAPI backend in `../backend`. Users sign in (a fake sign-in for now: any email and password work), then draft one of 11 Common Paper agreements by chatting with an AI assistant. The assistant works out which document they need, asks about the details and fills it in. The agreement updates beside the chat. Users then download it as PDF (through the browser's print dialog) or as a Word document.

## Getting started

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000, with hot reload
```

To run the full app as it's deployed, see the [root README](../README.md).

| Script             | What it does                                                  |
| ------------------ | ------------------------------------------------------------- |
| `npm run dev`      | Start the dev server                                          |
| `npm run build`    | Static export into `out/`                                     |
| `npm start`        | Serve `out/` with the FastAPI backend at :8000 (needs uv)     |
| `npm test`         | Unit and component tests (Vitest)                             |
| `npm run test:e2e` | End-to-end tests against the FastAPI backend (Playwright)     |
| `npm run test:all` | Lint, type-check and all tests                                |
| `npm run lint`     | Lint with ESLint                                              |

See [TESTING.md](TESTING.md) for what the tests cover and the manual test plan.

## How it works

- **Static export:** `next.config.ts` sets `output: "export"` and `trailingSlash: true`, so each page becomes `out/<page>/index.html`. Pages can't use server-only features at request time (route handlers, cookies, headers); everything dynamic goes through the backend's `/api`.
- **Pages:**
  - `/` (`src/app/page.tsx`): the sign-in page.
  - `src/app/(app)/`: pages for signed-in users. Its layout wraps them in `AuthGuard` and adds `AppHeader`. The `(app)` folder doesn't appear in URLs, so `(app)/draft/page.tsx` is `/draft/`.
- **Fake sign-in:** `src/lib/session.ts` keeps the signed-in email in localStorage. It's the only code that knows how the session is stored, and `src/lib/useSession.ts` exposes it to components. Real authentication can replace both without changing the pages. The guard runs in the browser only, so it isn't a security boundary.
- **Documents:** `../documents.json` lists the documents Prelegal can draft, with their parties and fields. The backend reads the same file. At build time:
  - `src/lib/documents/loadDocuments.ts` reads it and parses each document's Standard Terms from `../templates` with `parseTerms.ts`. The terms are nested and numbered 1., 1.1, (a), (i).
  - `src/lib/nda/loadTemplate.ts` reads the Mutual NDA's two templates.
  - Both run in Node only, so commands must run from the `frontend` directory.
- **AI chat:**
  - `src/components/Chat.tsx` with `src/lib/chat/useChat.ts`, which holds the conversation in the browser only.
  - `src/lib/chat/api.ts` sends each turn to the backend's `POST /api/chat`: the whole conversation, the current draft (`{documentId, fields}`) and the user's date. The backend returns the reply and the updated draft.
  - The chat needs the backend. `npm run dev` alone shows the chat, but messages fail; use `npm start` or Docker to talk to the AI.
- **`DraftCreator`** owns the draft and passes it to the chat and the preview. Until the AI picks a document, the preview lists what Prelegal can draft.
- **Rendering:** each document is built into a model, then rendered as the live preview (also the PDF print layout) and as the Word export.
  - The Mutual NDA keeps its own cover page. `toNdaValues` (in `src/lib/documents/buildDocument.ts`) turns the draft into `NdaValues`, `src/lib/nda/buildNda.ts` builds the model, and `NdaPreview.tsx` and `src/lib/nda/toDocx.ts` render it.
  - The other documents get a generated cover page: `buildDocument` builds the model, and `DocumentPreview.tsx` and `src/lib/documents/toDocx.ts` render it.
  - The outline both share (title, cover page, signature table, Standard Terms, attribution) is `AgreementPage` in `DocumentParts.tsx` and `agreementDocx` in `src/lib/docx.ts`.
  - The attribution credits Common Paper and says what Prelegal changed, as the CC BY 4.0 licence asks.
- **Brand colors** are Tailwind theme colors in `src/app/globals.css` (`bg-brand-purple`, `text-brand-navy` and so on).
