# Prelegal frontend: Mutual NDA Creator

A Next.js app for creating a Common Paper Mutual Non-Disclosure Agreement. Fill in the form, watch the agreement update as you type, then download it as PDF (through the browser's print dialog) or as a Word document.

## Getting started

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

| Script             | What it does                       |
| ------------------ | ---------------------------------- |
| `npm run dev`      | Start the dev server               |
| `npm run build`    | Production build (static page)     |
| `npm test`         | Unit and component tests (Vitest)  |
| `npm run test:e2e` | End-to-end tests (Playwright)      |
| `npm run test:all` | Lint, type-check and all tests     |
| `npm run lint`     | Lint with ESLint                   |

See [TESTING.md](TESTING.md) for what the tests cover and the manual test plan.

## How it works

- The agreement text comes from `../templates/Mutual-NDA.md` and `../templates/Mutual-NDA-coverpage.md`. It is read at build time in `src/lib/nda/loadTemplate.ts`, so commands must run from the `frontend` directory. On Vercel, set the project's Root Directory to `frontend`.
- `src/lib/nda/buildNda.ts` combines the form values and the parsed templates into a single document model.
- That model is rendered two ways:
  - `src/components/NdaPreview.tsx` renders the live preview, which also serves as the PDF print layout.
  - `src/lib/nda/toDocx.ts` renders the Word export.
