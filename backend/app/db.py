"""SQLite database. It is temporary: deleted and recreated every time the app starts."""

import sqlite3
from contextlib import closing
from pathlib import Path

SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def init_db(db_path: Path) -> None:
    """Deletes any existing database at `db_path` and creates a fresh one with the schema."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    # Also remove a journal left behind if the app was stopped mid-write.
    for suffix in ("", "-journal"):
        Path(f"{db_path}{suffix}").unlink(missing_ok=True)
    with closing(sqlite3.connect(db_path)) as conn:
        conn.executescript(SCHEMA)
