# Prelegal: one image with the statically built frontend served by the FastAPI backend.
# Build from the repository root: docker build -t prelegal .

# --- Frontend: build the static export into /app/frontend/out ---
FROM node:24-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# The build reads the templates from ../templates, as in the repository.
COPY templates/ /app/templates/
RUN npm run build

# --- Backend: FastAPI app, serving the frontend ---
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/app ./app
COPY --from=frontend /app/frontend/out ./static

RUN useradd --system --no-create-home prelegal
USER prelegal

# The database lives in /tmp and is recreated from scratch every time the container starts.
ENV PATH="/app/.venv/bin:$PATH" \
    PRELEGAL_STATIC_DIR=/app/static \
    PRELEGAL_DB_PATH=/tmp/prelegal.db
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
