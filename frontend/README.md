# Prelegal frontend

A Next.js app, exported as static files and served by the FastAPI backend in `../backend`. Users sign in (a fake sign-in for now: any email and password work), then create a Common Paper Mutual Non-Disclosure Agreement by chatting with an AI assistant. The assistant asks about the details and fills in the agreement, which updates beside the chat. Users then download it as PDF (through the browser's print dialog) or as a Word document.

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
  - `src/app/(app)/`: pages for signed-in users. Its layout wraps them in `AuthGuard` and adds `AppHeader`. The `(app)` folder doesn't appear in URLs, so `(app)/nda/page.tsx` is `/nda/`.
- **Fake sign-in:** `src/lib/session.ts` keeps the signed-in email in localStorage. It's the only code that knows how the session is stored, and `src/lib/useSession.ts` exposes it to components. Real authentication can replace both without changing the pages. The guard runs in the browser only, so it isn't a security boundary.
- **Agreement text:** comes from `../templates/Mutual-NDA.md` and `../templates/Mutual-NDA-coverpage.md`. It's read at build time in `src/lib/nda/loadTemplate.ts`, so commands must run from the `frontend` directory.
- **AI chat:**
  - `src/components/Chat.tsx` replaced the old form. `src/lib/chat/useChat.ts` holds the conversation in the browser only. `src/lib/chat/api.ts` sends each turn to the backend's `POST /api/chat`: the whole conversation plus the current values. The backend returns the reply and the updated values.
  - `NdaCreator` owns the values. It sets the Effective Date to today on load and passes the values to both the chat and the preview.
  - The chat needs the backend. `npm run dev` alone shows the chat, but messages fail; use `npm start` or Docker to talk to the AI.
- `src/lib/nda/buildNda.ts` combines the values and the parsed templates into a single document model.
- That model is rendered two ways:
  - `src/components/NdaPreview.tsx` renders the live preview, which also serves as the PDF print layout.
  - `src/lib/nda/toDocx.ts` renders the Word export.
- **Brand colors** are Tailwind theme colors in `src/app/globals.css` (`bg-brand-purple`, `text-brand-navy` and so on).
