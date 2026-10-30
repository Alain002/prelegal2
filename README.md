# prelegal2
A platform for drafting common legal agreements

## Status

> **Work in progress:** This project is under active development and is expected to be complete in 1 week (by November 1, 2026).

Today the app has a fake sign-in (any email and password work) and a drafting page. You tell an AI assistant what you need; it picks one of 11 Common Paper agreements, asks about the details and fills it in. If you ask for something Prelegal can't draft, it says so and offers the closest document it can.

## Run it

You need [Docker](https://www.docker.com/). The start script builds one image and starts it at **http://localhost:8000**:

| OS      | Start                           | Stop                           |
| ------- | ------------------------------- | ------------------------------ |
| Mac     | `scripts/start-mac.sh`          | `scripts/stop-mac.sh`          |
| Linux   | `scripts/start-linux.sh`        | `scripts/stop-linux.sh`        |
| Windows | `scripts\start-windows.ps1`     | `scripts\stop-windows.ps1`     |

The AI chat needs an [OpenRouter](https://openrouter.ai/) API key. Put it in a `.env` file at the repository root:

```
OPENROUTER_API_KEY=your-key
```

`.env` is passed to the container at run time and never copied into the image. Without a key the app still runs, but the chat shows "The AI assistant is unavailable right now."

The database starts empty every time the container starts.

## Layout

| Path         | What it is                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------- |
| `frontend/`  | Next.js app, exported as static files. See [frontend/README.md](frontend/README.md).         |
| `backend/`   | FastAPI app (a [uv](https://docs.astral.sh/uv/) project). Serves the API under `/api` and the exported frontend everywhere else. |
| `templates/` | Common Paper agreement templates, listed in `catalog.json`.                                 |
| `documents.json` | The documents Prelegal can draft: their parties and the fields to fill in, with guidance for the AI. The backend and frontend both read it. |
| `scripts/`   | Start and stop scripts.                                                                     |
| `Dockerfile` | Builds the frontend, then the backend image that serves it.                                 |

### Backend

- `app/main.py`: `create_app()` registers the API routers, then mounts the exported frontend.
- `app/config.py`: settings from environment variables:
  - `PRELEGAL_DB_PATH` defaults to `backend/data/prelegal.db`.
  - `PRELEGAL_STATIC_DIR` defaults to `frontend/out`.
  - `PRELEGAL_DOCUMENTS_PATH` defaults to `documents.json` at the repository root.
- `app/db.py`: SQLite through the standard library. On every startup the database file is deleted and recreated with the schema (currently a `users` table, for sign up and sign in later).
- `app/routers/`: one module per area of the API. Unknown `/api` paths return a JSON 404.
  - `health.py`: `GET /api/health`.
  - `chat.py`: `POST /api/chat`, one turn of the drafting conversation. The browser sends the whole conversation, the draft so far (`{documentId, fields}`) and its date, and gets back the assistant's reply and the updated draft. Nothing is stored on the server. If the AI fails, it returns a 502 with a message for the user.
- `app/llm.py`: calls `openrouter/openai/gpt-oss-120b` (served by Cerebras) through LiteLLM, with Structured Outputs. `get_llm` is a FastAPI dependency, so tests can swap in a fake.
- `app/documents/`: what the AI needs to know about the documents.
  - `registry.py` loads `documents.json`. Every document also gets each party's company, signer's name and title, and notice address.
  - `drafts.py`: the `Draft` (which document, and its fields as strings) and `apply_turn`, which merges the AI's answer and keeps every value valid: real dates, 1-99 years, trimmed and length-capped text. A blank answer never erases an essential field. Switching document keeps the answers both documents share.
  - `assistant.py`: the instructions (system prompt), the shape of the AI's answer (`Turn`: reply, question, document, field updates), and `compose_reply`, which makes sure the reply always ends with a question while a document or an essential field is still missing.
- `.env` at the repository root is loaded for local development (`app/config.py`). In Docker, the variables come from `--env-file`.

## Develop without Docker

You need Node.js and uv.

```bash
cd frontend && npm install && npm run build   # static export into frontend/out
cd ../backend && uv run uvicorn app.main:app --reload --port 8000
```

For hot reload on the frontend, run `npm run dev` in `frontend/` instead (http://localhost:3000).

## Tests

```bash
cd backend && uv run pytest        # API, chat (with a fake AI), documents, static serving, database reset
cd backend && uv run pytest -m live  # four conversations with the real AI (needs OPENROUTER_API_KEY)
cd frontend && npm run test:all    # lint, type-check, Vitest, Playwright end to end
```

The end-to-end tests run the real stack: the static export served by the FastAPI backend. See [frontend/TESTING.md](frontend/TESTING.md).
