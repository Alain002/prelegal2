# Prelegal frontend

A Next.js app, exported as static files and served by the FastAPI backend in `../backend`. Users create an account and sign in, then draft one of 11 Common Paper agreements by chatting with an AI assistant. The assistant works out which document they need, asks about the details and fills it in. The agreement updates beside the chat. Users then download it as PDF (through the browser's print dialog) or as a Word document. Each draft is saved to the user's account after every message, and **My documents** lists them to reopen.

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
| `npm run build`    | Static export into `out/` (then `scripts/flatten-segments.mjs`, below) |
| `npm start`        | Serve `out/` with the FastAPI backend at :8000 (needs uv)     |
| `npm test`         | Unit and component tests (Vitest)                             |
| `npm run test:e2e` | End-to-end tests against the FastAPI backend (Playwright)     |
| `npm run test:all` | Lint, type-check and all tests                                |
| `npm run lint`     | Lint with ESLint                                              |

See [TESTING.md](TESTING.md) for what the tests cover and the manual test plan.

## How it works

- **Static export:** `next.config.ts` sets `output: "export"` and `trailingSlash: true`, so each page becomes `out/<page>/index.html`. Pages can't use server-only features at request time (route handlers, cookies, headers); everything dynamic goes through the backend's `/api`.
- **Windows build fix:** on Windows, `next build` writes the files that link prefetching asks for (`__next.<segments>.txt`) into nested folders, so every prefetch 404s. `scripts/flatten-segments.mjs` runs after the build and moves them to the names the browser requests. On Linux, including the Docker build, it finds nothing to do.
- **Pages:**
  - `/` (`src/app/page.tsx`) signs in and `/signup/` creates an account. Both use `AuthForm` inside `AuthShell`, which adds the product pitch and the disclaimer.
  - `src/app/(app)/`: pages for signed-in users. Its layout wraps them in `AuthGuard` and adds `AppHeader` (New document, My documents, Sign out) and a footer with the disclaimer. The `(app)` folder doesn't appear in URLs, so `(app)/draft/page.tsx` is `/draft/`.
  - `/draft/` drafts a new document and `/draft/?id=N` reopens a saved one (`DraftWorkspace`). The id is a query parameter because the site is a static export. When a new draft is first saved, the address becomes `/draft/?id=N` without reloading, so a reload reopens it.
  - `/documents/` (`DocumentList`) lists the user's documents, newest first, to open or delete.
- **Sessions:** the backend keeps the session in an httpOnly cookie that scripts can't read. `src/lib/session.ts` asks `GET /api/auth/me` who is signed in and does sign in, sign up and sign out. `src/lib/useSession.ts` exposes it to components. `src/lib/api.ts` makes every API call; a 401 from any endpoint but sign-in means the session ended (the server restarted, say), which signs the user out. The guard runs in the browser only: the API is the security boundary.
- **Saving:** `src/lib/saved/useAutosave.ts` saves after every chat turn, once the AI has picked a document: created the first time, updated after that. Saves run one at a time and only the newest waiting one is sent, so quick turns can't create duplicates. `src/lib/saved/api.ts` is the `/api/documents` client.
- **UI kit:** `src/components/ui.tsx` has the shared pieces: `Button`, `ButtonLink`, `TextField`, `Alert`, `Card`, `EmptyState`, `Loading`, `Logo` and `Disclaimer`.
- **Disclaimer:** `src/lib/disclaimer.ts` holds the wording. It appears on the sign-in and sign-up pages, in the app's footer, and in every document: a notice under the title of the preview, the PDF and the Word file, and a footer on every PDF page (`@page` in `globals.css`) and Word page.
- **Documents:** `../documents.json` lists the documents Prelegal can draft, with their parties and fields. The backend reads the same file. At build time:
  - `src/lib/documents/loadDocuments.ts` reads it and parses each document's Standard Terms from `../templates` with `parseTerms.ts`. The terms are nested and numbered 1., 1.1, (a), (i).
  - `src/lib/nda/loadTemplate.ts` reads the Mutual NDA's two templates.
  - Both run in Node only, so commands must run from the `frontend` directory.
- **AI chat:**
  - `src/components/Chat.tsx` with `src/lib/chat/useChat.ts`, which holds the conversation in the browser. It can start from a saved conversation, and hands each turn's draft and conversation to `DraftCreator` to apply and save.
  - `src/lib/chat/api.ts` sends each turn to the backend's `POST /api/chat`: the whole conversation, the current draft (`{documentId, fields}`) and the user's date. The backend returns the reply and the updated draft.
  - The chat needs the backend. `npm run dev` alone shows the chat, but messages fail; use `npm start` or Docker to talk to the AI.
- **`DraftCreator`** owns the draft (new, or a saved one to carry on with) and passes it to the chat and the preview. It saves after every turn and shows the save status. Until the AI picks a document, the preview lists what Prelegal can draft.
- **Rendering:** each document is built into a model, then rendered as the live preview (also the PDF print layout) and as the Word export.
  - The Mutual NDA keeps its own cover page. `toNdaValues` (in `src/lib/documents/buildDocument.ts`) turns the draft into `NdaValues`, `src/lib/nda/buildNda.ts` builds the model, and `NdaPreview.tsx` and `src/lib/nda/toDocx.ts` render it.
  - The other documents get a generated cover page: `buildDocument` builds the model, and `DocumentPreview.tsx` and `src/lib/documents/toDocx.ts` render it.
  - The outline both share (title, cover page, signature table, Standard Terms, attribution) is `AgreementPage` in `DocumentParts.tsx` and `agreementDocx` in `src/lib/docx.ts`.
  - The attribution credits Common Paper and says what Prelegal changed, as the CC BY 4.0 licence asks.
- **Brand colors** are Tailwind theme colors in `src/app/globals.css` (`bg-brand-purple`, `text-brand-navy` and so on).
