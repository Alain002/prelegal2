from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unknown_api_path_is_a_json_404(client: TestClient) -> None:
    for method in ("get", "post"):
        response = getattr(client, method)("/api/nope")
        assert response.status_code == 404
        assert response.json() == {"detail": "Not Found"}


def test_api_runs_without_a_built_frontend(tmp_path: Path) -> None:
    settings = Settings(db_path=tmp_path / "prelegal.db", static_dir=tmp_path / "missing")
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404
