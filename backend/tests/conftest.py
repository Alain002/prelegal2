from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.factories import sign_up


@pytest.fixture
def static_dir(tmp_path: Path) -> Path:
    """A tiny stand-in for the exported frontend (`next build` with trailingSlash)."""
    out = tmp_path / "out"
    (out / "draft").mkdir(parents=True)
    (out / "_next").mkdir()
    (out / "index.html").write_text("<h1>login</h1>")
    (out / "draft" / "index.html").write_text("<h1>draft</h1>")
    (out / "404.html").write_text("<h1>not found</h1>")
    (out / "_next" / "app.js").write_text("console.log('hi')")
    return out


@pytest.fixture
def settings(tmp_path: Path, static_dir: Path) -> Settings:
    return Settings(db_path=tmp_path / "data" / "prelegal.db", static_dir=static_dir)


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    # Entering the client runs the app's startup, which creates the database.
    with TestClient(create_app(settings)) as c:
        yield c


@pytest.fixture
def signed_in(client: TestClient) -> TestClient:
    """`client`, signed in as a new user (ada@acme.test)."""
    sign_up(client)
    return client
