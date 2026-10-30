# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory. The user chats with an AI chat in order to establish what document they want and how to fill in the fields. The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

Current state: the V1 product (frontend, backend, temporary database, Docker, scripts) with real sign up and sign in. Users draft any of the 11 catalog documents by chatting with the AI, which picks the document and fills it in. Each draft is saved to the user's account after every turn and can be reopened from My documents. Every document is marked as a draft subject to legal review. `documents.json` (not `catalog.json`) is what the app reads: each document's parties and fields. See "Implementation status" below.

## Development process

When instructed to build a feature:

1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b model` with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in .env file

## Technical design

The entire project should be packaged into a Docker container. The backend should be in backend/ and be a uv project, using FastAPI. The frontend should be in frontend/
The database should use SQLLite and be created from scratch each time the docker container is brought up, allowing for a users table with sign up and sign in.
The frontend is statically exported (Next.js `output: "export"`) and served by FastAPI. There are scripts in scripts/ for:

```
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```

Backend available at http://localhost:8000

## Color Scheme

- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

Available as Tailwind classes such as `bg-brand-purple` and `text-brand-navy` (defined in `frontend/src/app/globals.css`). Yellow, blue and gray fail WCAG AA contrast as small text on white, so use them on navy, for large text or for decoration only. The e2e tests run axe checks.

## Implementation status

Everything up to KAN-8 is merged into `main` (KAN-5 PR #4, KAN-6 PR #5, KAN-7 PR #6, KAN-8 PR #7). KAN-9 is on branch `KAN-9-multi-user`, in review. Each ticket is built on a branch named after it, e.g. `KAN-8-all-documents`, and merged locally with `--no-ff`.

- **KAN-4:** Common Paper templates in `templates/` plus `catalog.json`.
- **KAN-5:** Mutual NDA creator (Next.js 16, React 19, Tailwind 4). It had a form (replaced by the AI chat in KAN-7), a live preview, and PDF (print) and Word (`docx`) downloads. Templates are read from `../templates` at build time (`frontend/src/lib/nda/loadTemplate.ts`).
- **KAN-6:** V1 foundation.
  - **Backend** (`backend/`, uv, Python 3.12 pinned):
    - `app/main.py` has a `create_app()` factory. It adds routers from `app/routers/` (`GET /api/health`, plus `POST /api/chat` from KAN-7), returns a JSON 404 for unknown `/api/*` paths, then mounts `frontend/out` with `StaticFiles(html=True)`.
    - Settings come from env vars `PRELEGAL_DB_PATH`, `PRELEGAL_STATIC_DIR` and (KAN-8) `PRELEGAL_DOCUMENTS_PATH` (`app/config.py`).
    - SQLite through stdlib `sqlite3` (`app/db.py`). It is deleted and recreated on every startup with a `users` table (id, email unique, password_hash, created_at), plus `sessions` and `documents` since KAN-9. So a restart deletes every account and saved document.
  - **Frontend:**
    - Static export with `trailingSlash: true`, so pages are `out/<page>/index.html`. Don't use server-only request features.
    - `/` was a fake sign-in page until KAN-9 made it real (see below). `useSession()` still gives components the three states loading, authenticated and unauthenticated.
    - Signed-in pages live in the `src/app/(app)/` route group, whose layout adds `AuthGuard` and `AppHeader`. The drafting page is at `/draft/` (it was `/nda/` before KAN-8).
  - **Docker:** a multi-stage root `Dockerfile` (node build, then python:3.12-slim, non-root, port 8000). The DB is at `/tmp/prelegal.db`. `.env` is passed at run time with `--env-file`, never baked into the image.
  - **Scripts:** the mac and linux scripts wrap the shared `scripts/start.sh` and `scripts/stop.sh`. The container is named `prelegal`.
- **KAN-7:** an AI chat replaced the NDA form.
  - **Backend:**
    - `POST /api/chat` is in `app/routers/chat.py`. It is stateless: the browser sends the whole conversation (the static greeting included) and the draft each turn.
    - `app/llm.py` calls LiteLLM with Structured Outputs. `get_llm` is a dependency that tests override.
    - LLM failures, including a missing key, return 502 with a user-facing message.
    - Limits: at most 60 messages of 4000 characters each. The browser sends only the latest 40 (`MAX_HISTORY` in `useChat.ts`), and the server cuts replies to 4000 characters. Without these caps a long chat would get stuck on 422s.
  - **Frontend:** `src/lib/chat/api.ts`, `useChat.ts` (holds `GREETING`) and `src/components/Chat.tsx`. The chat column is sized to fit below the headers, `lg:h-[calc(100vh-13.5rem)]`, so keep the page header short. It also holds the downloads and (KAN-9) the save status; the footer sits below the page and doesn't count.
- **KAN-8:** all 11 catalog documents.
  - **`documents.json`** (repository root) is the single source of truth for what can be drafted: each document's id, name, template, two party roles (party 1 plays the first) and fields (key, label, kind `text`/`date`/`term`, essential, hint for the AI, default). Each document also gets `party{1,2}{Company,Name,Title,NoticeAddress}`. The same key means the same thing in every document, which is how answers carry over on a switch. `backend/tests/test_registry.py` checks it against `catalog.json` and against every defined-term span in the templates.
  - **Backend** (`app/documents/`):
    - `registry.py` loads it. `drafts.py` has `Draft` (`documentId` plus a flat string map of fields) and `apply_turn`: a switch keeps shared keys and applies defaults (`"today"` for dates), then updates are cleaned (real dates, 1-99 years or the open-ended choice, capped text). Essential fields ignore blanks; optional ones can be cleared.
    - `assistant.py` has the prompt and the AI's answer, `Turn` (`reply`, `question`, `document_id` as an enum of ids, `updates` as a list of `{key, value}`). One shallow schema serves every document.
    - `compose_reply` guarantees a follow-on question: while no document is chosen or an essential field is missing, the reply must end with a question, the AI's own or `fallback_question` about the next missing field.
    - The request also carries the browser's `today`, so dates are right in the user's timezone.
  - **Frontend:**
    - `(app)/draft/page.tsx` loads the documents at build time (`lib/documents/loadDocuments.ts`, which parses the Standard Terms with `parseTerms.ts`) and renders `DraftCreator`, which owns the draft. Before a document is chosen the preview lists them all.
    - The Mutual NDA (`NDA_ID`) keeps its own cover page: `toNdaValues` turns the draft into `NdaValues` for `buildNda`, `NdaPreview` and `lib/nda/toDocx.ts`. The other documents get a generated cover page: `buildDocument`, `DocumentPreview` and `lib/documents/toDocx.ts`. Both share the outline in `AgreementPage` (`DocumentParts.tsx`) and `agreementDocx` (`lib/docx.ts`).
    - CC BY 4.0: every generated document credits Common Paper and says what Prelegal changed (`templates/LICENSE.txt`). Keep that in the attribution.
  - **Prompt tuning:** tuned against the real model. It must say to fill EVERY field a message mentions, to offer the closest document for unsupported requests, to ask the document's own terms before the signers, to confirm defaults rather than ask for them, and not to ask users for date formats. Field guidance lives in the `documents.json` hints (e.g. the MNDA term is separate from the confidentiality term). Recheck with `uv run pytest -m live` after prompt or hint changes.
- **KAN-9:** real accounts, saved documents, SaaS polish and the legal disclaimer.
  - **Backend:**
    - `app/auth.py`: passwords hashed with stdlib `hashlib.scrypt`. Signing in stores a random token, as its SHA-256 hash, in the `sessions` table (14 days) and sets it in the httpOnly, SameSite=Lax, non-Secure cookie `prelegal_session` (plain http://localhost). `current_user` / `require_user` are the dependencies. An unknown email still runs scrypt, so it takes as long as a wrong password.
    - `app/routers/auth.py`: `POST /api/auth/signup` (201, signs in; 409 for a taken email, 422 with a user-facing message for a bad email or a password under 8), `/signin` (401 with one message for any wrong credentials), `/signout` (204) and `GET /api/auth/me`, which always answers 200 with `{user: null}` when signed out, because the e2e tests fail on any console error.
    - `app/routers/documents.py`: `GET`/`POST /api/documents`, `GET`/`PUT`/`DELETE /api/documents/{id}`. A saved document is a `Draft` plus its conversation (at most 200 messages, mirrored in `lib/saved/api.ts`), and needs a chosen document. Every query is scoped to the user; someone else's document is a 404. The list derives a title from the party companies.
    - `POST /api/chat` now needs sign-in.
    - `app/db.py`: `sessions` and `documents` tables; `Db` is the connection dependency with `scope="function"`, so the transaction commits before the response is sent (by default FastAPI 0.162 finishes yield dependencies after sending). `now_iso()` for timestamps. `create_app` puts its settings on `app.state`, which `get_db` reads.
    - `app/models.py`: `CamelModel`, the camelCase base for `Draft`, the registry and the API models.
  - **Frontend:**
    - `/` sign in and `/signup/` sign up (`AuthForm` in `AuthShell`). `src/lib/session.ts` asks `GET /api/auth/me` and does sign in/up/out; a version counter stops an older answer undoing a newer change. `src/lib/api.ts` makes every API call: a 401 from any endpoint but sign-in signs the user out.
    - `AppHeader` has New document and My documents; the `(app)` layout adds a footer with the short disclaimer and the Common Paper credit.
    - `/draft/?id=N` reopens a saved document (`DraftWorkspace`, inside a `Suspense` boundary as static export requires). When a new draft is first saved, `history.replaceState` makes the address `/draft/?id=N` without remounting; only that first transition, straight from `/draft/`, counts as the draft's own.
    - `src/lib/saved/useAutosave.ts` saves after every chat turn once a document is chosen: one save at a time, newest waiting snapshot wins, so there are no duplicate creates. `useChat` now takes saved messages and reports each turn's draft and conversation (`onTurn`).
    - `/documents/` (`DocumentList`): newest first, open or delete (with an inline confirm).
    - `src/components/ui.tsx` is the UI kit: `Button`, `ButtonLink`, `TextField`, `inputClass`, `Alert` (with an optional action), `Card`, `EmptyState`, `Loading`, `Logo`, `Disclaimer`.
    - `src/lib/disclaimer.ts` has the wording: on the auth pages and app footer, a notice under the title of the preview, PDF and Word file, and a footer on every PDF page (`@page @bottom-center` in `globals.css`, kept in sync by hand) and Word page.
    - `scripts/flatten-segments.mjs` runs after `next build`: on Windows, Next 16's export writes the link-prefetch segment files into folders, so every prefetch 404s. It does nothing on Linux (Docker).
    - Next adds a route announcer with `role="alert"`, so e2e tests look for alerts inside `main`.
- **Tests:**
  - Backend: `cd backend && uv run pytest`. It uses a fake LLM. The real-model tests are opt-in with `-m live`.
  - Frontend test drafts live in `src/test/drafts.ts`, shared by Vitest and Playwright.
  - Backend tests sign up through the real endpoint (`sign_up` in `tests/factories.py`, the `signed_in` fixture).
  - Frontend e2e fakes the AI with Playwright route interception (`fakeAi` in `e2e/helpers.ts`). Auth and saving are real: each test signs up a fresh user (`openApp`, `uniqueEmail`). There is no test-only code in the backend.
  - Vitest fakes the backend with `stubApi` (`src/test/api.ts`).
  - Frontend: `cd frontend && npm run test:all` (lint, tsc, Vitest, Playwright).
  - Playwright runs against the FastAPI-served build. To test the container, run `PW_REUSE=1 E2E_PORT=8000 npm run test:e2e`.
  - Details are in `frontend/TESTING.md`.
- **Open items:**
  - The manual test plan in `frontend/TESTING.md` (M0 to M23) hasn't been run for KAN-8 or KAN-9, especially opening the Word files in Microsoft Word.
  - Accounts and documents are lost whenever the server restarts (the database is temporary, as the brief allows).
  - The disclaimer wording hasn't been reviewed by a lawyer.
  - No password reset, rate limiting on sign-in, or account deletion.
- **Next:** a persistent database, then password reset.
