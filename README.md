# prelegal2
A platform for drafting common legal agreements

## Status

> **Work in progress:** This project is under active development and is expected to be complete in 1 week (by November 1, 2026).

Today the app has a fake sign-in (any email and password work) and the Mutual NDA creator.

## Run it

You need [Docker](https://www.docker.com/). The start script builds one image and starts it at **http://localhost:8000**:

| OS      | Start                           | Stop                           |
| ------- | ------------------------------- | ------------------------------ |
| Mac     | `scripts/start-mac.sh`          | `scripts/stop-mac.sh`          |
| Linux   | `scripts/start-linux.sh`        | `scripts/stop-linux.sh`        |
| Windows | `scripts\start-windows.ps1`     | `scripts\stop-windows.ps1`     |

If a `.env` file exists at the repository root, it's passed to the container at run time (it's never copied into the image). The database starts empty every time the container starts.

## Layout

| Path         | What it is                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------- |
| `frontend/`  | Next.js app, exported as static files. See [frontend/README.md](frontend/README.md).         |
| `backend/`   | FastAPI app (a [uv](https://docs.astral.sh/uv/) project). Serves the API under `/api` and the exported frontend everywhere else. |
| `templates/` | Common Paper agreement templates, listed in `catalog.json`.                                 |
| `scripts/`   | Start and stop scripts.                                                                     |
| `Dockerfile` | Builds the frontend, then the backend image that serves it.                                 |

### Backend

- `app/main.py`: `create_app()` registers the API routers, then mounts the exported frontend.
- `app/config.py`: settings from environment variables:
  - `PRELEGAL_DB_PATH` defaults to `backend/data/prelegal.db`.
  - `PRELEGAL_STATIC_DIR` defaults to `frontend/out`.
- `app/db.py`: SQLite through the standard library. On every startup the database file is deleted and recreated with the schema (currently a `users` table, for sign up and sign in later).
- `app/routers/`: one module per area of the API. So far there is `GET /api/health`. Unknown `/api` paths return a JSON 404.

## Develop without Docker

You need Node.js and uv.

```bash
cd frontend && npm install && npm run build   # static export into frontend/out
cd ../backend && uv run uvicorn app.main:app --reload --port 8000
```

For hot reload on the frontend, run `npm run dev` in `frontend/` instead (http://localhost:3000).

## Tests

```bash
cd backend && uv run pytest        # API, static serving, database reset
cd frontend && npm run test:all    # lint, type-check, Vitest, Playwright end to end
```

The end-to-end tests run the real stack: the static export served by the FastAPI backend. See [frontend/TESTING.md](frontend/TESTING.md).
