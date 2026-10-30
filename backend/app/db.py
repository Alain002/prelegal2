"""SQLite database. It is temporary: deleted and recreated every time the app starts."""

import sqlite3
from collections.abc import Iterator
from contextlib import closing, contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import Depends, Request

SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One row per signed-in browser. Only a hash of the cookie's token is stored.
CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);

-- The documents users have drafted: the draft and the conversation that produced it.
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL,
    draft TEXT NOT NULL,
    messages TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX documents_by_user ON documents (user_id, updated_at DESC);
"""


def now_iso() -> str:
    """The current time as stored in the database: ISO 8601 in UTC, so text order is time order."""
    return datetime.now(UTC).isoformat()


def init_db(db_path: Path) -> None:
    """Deletes any existing database at `db_path` and creates a fresh one with the schema."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    # Also remove a journal left behind if the app was stopped mid-write.
    for suffix in ("", "-journal"):
        Path(f"{db_path}{suffix}").unlink(missing_ok=True)
    with closing(sqlite3.connect(db_path)) as conn:
        conn.executescript(SCHEMA)


@contextmanager
def connect(db_path: Path) -> Iterator[sqlite3.Connection]:
    """A connection that commits when the block succeeds, rolls back when it raises, and closes."""
    # FastAPI may open the connection in one worker thread and run the endpoint in another.
    # Each request still uses its connection one step at a time, so sharing it is safe.
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def get_db(request: Request) -> Iterator[sqlite3.Connection]:
    """FastAPI dependency: one connection per request, to the app's own database."""
    with connect(request.app.state.settings.db_path) as conn:
        yield conn


# Scoped to the endpoint call, so the transaction commits before the response is sent. (By default
# FastAPI would finish it after sending, and the browser's next request could miss the change.)
Db = Annotated[sqlite3.Connection, Depends(get_db, scope="function")]
