import sqlite3
from contextlib import closing

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import init_db
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
