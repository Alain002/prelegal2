# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory. The user chats with an AI chat in order to establish what document they want and how to fill in the fields. The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

Current state: the V1 foundation (frontend, backend, temporary database, Docker, scripts) is in place with a fake sign-in. Users fill in the Mutual NDA (the only supported document so far) by chatting with the AI. See "Implementation status" below.

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

- **KAN-4:** Common Paper templates in `templates/` plus `catalog.json`.
- **KAN-5:** Mutual NDA creator (Next.js 16, React 19, Tailwind 4). It had a form (replaced by the AI chat in KAN-7), a live preview, and PDF (print) and Word (`docx`) downloads. Templates are read from `../templates` at build time (`frontend/src/lib/nda/loadTemplate.ts`).
- **KAN-6:** V1 foundation.
  - **Backend** (`backend/`, uv, Python 3.12 pinned):
    - `app/main.py` has a `create_app()` factory. It adds routers from `app/routers/` (`GET /api/health`, plus `POST /api/chat` from KAN-7), returns a JSON 404 for unknown `/api/*` paths, then mounts `frontend/out` with `StaticFiles(html=True)`.
    - Settings come from env vars `PRELEGAL_DB_PATH` and `PRELEGAL_STATIC_DIR` (`app/config.py`).
    - SQLite through stdlib `sqlite3` (`app/db.py`). It is deleted and recreated on every startup with a `users` table (id, email unique, password_hash, created_at). No auth endpoints use it yet.
  - **Frontend:**
    - Static export with `trailingSlash: true`, so pages are `out/<page>/index.html`. Don't use server-only request features.
    - `/` is a fake sign-in page (any email and password). The email is stored in localStorage via `src/lib/session.ts` and read through `useSession()`. Replace these with real auth.
    - Signed-in pages live in the `src/app/(app)/` route group, whose layout adds `AuthGuard` and `AppHeader` (Sign out). The NDA creator is at `/nda/`.
  - **Docker:** a multi-stage root `Dockerfile` (node build, then python:3.12-slim, non-root, port 8000). The DB is at `/tmp/prelegal.db`. `.env` is passed at run time with `--env-file`, never baked into the image.
  - **Scripts:** the mac and linux scripts wrap the shared `scripts/start.sh` and `scripts/stop.sh`. The container is named `prelegal`.
- **KAN-7:** an AI chat replaced the NDA form. It is still only the Mutual NDA.
  - **Backend:**
    - `POST /api/chat` is in `app/routers/chat.py`. It is stateless: the browser sends the whole conversation (the static greeting included) and the current `NdaValues`, and gets back `{reply, values}`.
    - `app/llm.py` calls LiteLLM with Structured Outputs. `get_llm` is a dependency that tests override.
    - `app/documents/nda.py` holds the camelCase `NdaValues` models, the system prompt, and the flat nullable `NdaPatch` the AI returns (null means unchanged). Strict schemas handle flat, nullable fields reliably.
    - `apply_patch` merges the patch and keeps values valid. Years alone imply "expires"/"years".
    - LLM failures, including a missing key, return 502 with a user-facing message.
    - Limits: at most 60 messages of 4000 characters each. The browser sends only the latest 40 (`MAX_HISTORY` in `useChat.ts`), and the server cuts replies to 4000 characters. Without these caps a long chat would get stuck on 422s.
    - Only `modifications` can be cleared, by sending a blank value. Every other field ignores blank values, so a slip can't erase filled-in data.
  - **Frontend:**
    - The pieces are `src/lib/chat/api.ts`, `useChat.ts` (holds `GREETING`) and `src/components/Chat.tsx`. `NdaForm` was removed.
    - The `(app)/nda` chat column is sized to fit below the headers, `lg:h-[calc(100vh-13.5rem)]`.
  - **Prompt tuning:** the prompt was tuned against the real model. It must say to fill EVERY field a message mentions, and to keep the MNDA term separate from the confidentiality term. Recheck with `uv run pytest -m live` after prompt changes.
- **Tests:**
  - Backend: `cd backend && uv run pytest`. It uses a fake LLM. The real-model test is opt-in with `-m live`.
  - Frontend e2e fakes the AI with Playwright route interception (`fakeAi` in `e2e/helpers.ts`). There is no test-only code in the backend.
  - Frontend: `cd frontend && npm run test:all` (lint, tsc, Vitest, Playwright).
  - Playwright runs against the FastAPI-served build. To test the container, run `PW_REUSE=1 E2E_PORT=8000 npm run test:e2e`.
  - Details are in `frontend/TESTING.md`.
- **Next:** real sign up and sign in using the `users` table, then more document types from the catalog. Add a document registry when the second type arrives, and consider saving conversations per user.