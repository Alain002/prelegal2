import sqlite3
from contextlib import closing

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import connect, init_db
from app.main import create_app


def columns(db: sqlite3.Connection, table: str) -> list[str]:
    return [row[1] for row in db.execute(f"PRAGMA table_info({table})")]


def test_startup_creates_the_users_table(client: TestClient, settings: Settings) -> None:
    with closing(sqlite3.connect(settings.db_path)) as db:
        assert columns(db, "users") == ["id", "email", "password_hash", "created_at"]
        assert db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_each_startup_starts_from_an_empty_database(settings: Settings) -> None:
    app = create_app(settings)
    with TestClient(app):
        with closing(sqlite3.connect(settings.db_path)) as db, db:
            db.execute("INSERT INTO users (email, password_hash) VALUES ('a@b.test', 'x')")

    with TestClient(app):
        with closing(sqlite3.connect(settings.db_path)) as db:
            assert db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_init_db_replaces_an_unrelated_file(tmp_path) -> None:
    db_path = tmp_path / "prelegal.db"
    db_path.write_text("not a database")
    init_db(db_path)
    with closing(sqlite3.connect(db_path)) as db:
        assert columns(db, "users")


def test_users_emails_are_unique(tmp_path) -> None:
    db_path = tmp_path / "prelegal.db"
    init_db(db_path)
    with closing(sqlite3.connect(db_path)) as db:
        db.execute("INSERT INTO users (email, password_hash) VALUES ('a@b.test', 'x')")
        with pytest.raises(sqlite3.IntegrityError):
            db.execute("INSERT INTO users (email, password_hash) VALUES ('a@b.test', 'y')")


def test_startup_creates_the_sessions_and_documents_tables(client: TestClient, settings: Settings) -> None:
    with closing(sqlite3.connect(settings.db_path)) as db:
        assert columns(db, "sessions") == ["token_hash", "user_id", "expires_at"]
        assert columns(db, "documents") == [
            "id", "user_id", "document_id", "draft", "messages", "created_at", "updated_at"
        ]


def test_connect_enforces_foreign_keys_and_rolls_back_on_error(tmp_path) -> None:
    db_path = tmp_path / "prelegal.db"
    init_db(db_path)
    with pytest.raises(sqlite3.IntegrityError), connect(db_path) as db:
        db.execute("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('t', 42, 'x')")

    with pytest.raises(RuntimeError), connect(db_path) as db:
        db.execute("INSERT INTO users (email, password_hash) VALUES ('a@b.test', 'x')")
        raise RuntimeError
    with connect(db_path) as db:
        assert db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_deleting_a_user_deletes_their_sessions_and_documents(tmp_path) -> None:
    db_path = tmp_path / "prelegal.db"
    init_db(db_path)
    with connect(db_path) as db:
        db.execute("INSERT INTO users (id, email, password_hash) VALUES (1, 'a@b.test', 'x')")
        db.execute("INSERT INTO sessions VALUES ('t', 1, 'x')")
        db.execute("INSERT INTO documents (user_id, document_id, draft, messages, created_at, updated_at)"
                   " VALUES (1, 'pilot', '{}', '[]', 'x', 'x')")
    with connect(db_path) as db:
        db.execute("DELETE FROM users")
        assert db.execute("SELECT (SELECT COUNT(*) FROM sessions) + (SELECT COUNT(*) FROM documents)").fetchone()[0] == 0
