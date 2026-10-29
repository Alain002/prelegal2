from fastapi.testclient import TestClient


def test_root_serves_the_login_page(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.text == "<h1>login</h1>"
    assert response.headers["content-type"].startswith("text/html")


def test_page_routes_serve_their_index_html(client: TestClient) -> None:
    response = client.get("/nda/")
    assert response.status_code == 200
    assert response.text == "<h1>nda</h1>"


def test_page_without_trailing_slash_redirects(client: TestClient) -> None:
    response = client.get("/nda", follow_redirects=False)
    assert response.status_code in (307, 308)
    assert response.headers["location"].endswith("/nda/")


def test_serves_assets(client: TestClient) -> None:
    response = client.get("/_next/app.js")
    assert response.status_code == 200
    assert "console.log" in response.text


def test_unknown_page_serves_the_404_page(client: TestClient) -> None:
    response = client.get("/does-not-exist/")
    assert response.status_code == 404
    assert response.text == "<h1>not found</h1>"


def test_does_not_serve_files_outside_the_frontend(client: TestClient) -> None:
    # The database sits next to the static folder in the test layout.
    for path in ("/../data/prelegal.db", "/%2e%2e/data/prelegal.db"):
        response = client.get(path)
        assert response.status_code == 404
        assert "SQLite" not in response.text
