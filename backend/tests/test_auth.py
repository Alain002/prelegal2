import sqlite3
from contextlib import closing

from fastapi.testclient import TestClient

from app.auth import COOKIE_NAME, hash_password, verify_password
from app.config import Settings
from app.main import create_app
from tests.factories import PASSWORD, sign_up


def me(client: TestClient) -> dict:
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    return response.json()


def test_nobody_is_signed_in_at_first(client: TestClient) -> None:
    # A 200, not a 401: every page asks, and a signed-out visitor is not an error.
    assert me(client) == {"user": None}


def test_signing_up_signs_the_user_in(client: TestClient) -> None:
    response = sign_up(client, "ada@acme.test")
    assert response.json() == {"user": {"email": "ada@acme.test"}}
    assert me(client) == {"user": {"email": "ada@acme.test"}}


def test_the_session_cookie_is_http_only_and_same_site(client: TestClient) -> None:
    cookie = sign_up(client).headers["set-cookie"]
    assert cookie.startswith(f"{COOKIE_NAME}=")
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Path=/" in cookie
    # Plain http://localhost: a Secure cookie would never be sent back.
    assert "Secure" not in cookie


def test_emails_are_stored_trimmed_and_in_lower_case(client: TestClient) -> None:
    response = client.post("/api/auth/signup", json={"email": "  Ada@ACME.test ", "password": PASSWORD})
    assert response.json() == {"user": {"email": "ada@acme.test"}}


def test_an_email_can_only_sign_up_once(client: TestClient) -> None:
    sign_up(client, "ada@acme.test")
    response = client.post("/api/auth/signup", json={"email": "ADA@acme.test", "password": PASSWORD})
    assert response.status_code == 409
    assert response.json() == {"detail": "An account with this email already exists. Sign in instead."}


def test_sign_up_needs_a_valid_email(client: TestClient) -> None:
    for email in ("", "ada", "ada@acme", "ada @acme.test", "a@b@c.test"):
        response = client.post("/api/auth/signup", json={"email": email, "password": PASSWORD})
        assert response.status_code == 422, email
        assert response.json() == {"detail": "Enter a valid email address."}


def test_sign_up_needs_a_password_of_eight_characters(client: TestClient) -> None:
    response = client.post("/api/auth/signup", json={"email": "ada@acme.test", "password": "1234567"})
    assert response.status_code == 422
    assert response.json() == {"detail": "Use a password of at least 8 characters."}
    assert client.post("/api/auth/signup", json={"email": "ada@acme.test", "password": "12345678"}).status_code == 201


def test_passwords_are_capped(client: TestClient) -> None:
    response = client.post("/api/auth/signup", json={"email": "ada@acme.test", "password": "x" * 129})
    assert response.status_code == 422


def test_signing_in_with_the_right_password(client: TestClient) -> None:
    sign_up(client, "ada@acme.test")
    client.post("/api/auth/signout")

    response = client.post("/api/auth/signin", json={"email": "Ada@Acme.test", "password": PASSWORD})
    assert response.status_code == 200
    assert response.json() == {"user": {"email": "ada@acme.test"}}
    assert me(client) == {"user": {"email": "ada@acme.test"}}


def test_a_wrong_password_and_an_unknown_email_get_the_same_answer(client: TestClient) -> None:
    sign_up(client, "ada@acme.test")
    client.post("/api/auth/signout")

    wrong_password = client.post("/api/auth/signin", json={"email": "ada@acme.test", "password": "wrong password"})
    unknown_email = client.post("/api/auth/signin", json={"email": "bob@acme.test", "password": PASSWORD})
    for response in (wrong_password, unknown_email):
        assert response.status_code == 401
        assert response.json() == {"detail": "Incorrect email or password."}
    assert me(client) == {"user": None}


def test_signing_out_ends_the_session(client: TestClient) -> None:
    sign_up(client)
    token = client.cookies[COOKIE_NAME]

    response = client.post("/api/auth/signout")
    assert response.status_code == 204
    assert me(client) == {"user": None}
    # The old cookie no longer works, even if a browser kept it.
    client.cookies.set(COOKIE_NAME, token)
    assert me(client) == {"user": None}


def test_signing_out_when_signed_out_is_fine(client: TestClient) -> None:
    assert client.post("/api/auth/signout").status_code == 204


def test_a_made_up_token_is_not_a_session(client: TestClient) -> None:
    client.cookies.set(COOKIE_NAME, "made-up")
    assert me(client) == {"user": None}


def test_an_expired_session_is_not_a_session(client: TestClient, settings: Settings) -> None:
    sign_up(client)
    with closing(sqlite3.connect(settings.db_path)) as db, db:
        db.execute("UPDATE sessions SET expires_at = '2000-01-01T00:00:00+00:00'")
    assert me(client) == {"user": None}


def test_the_database_keeps_hashes_not_secrets(client: TestClient, settings: Settings) -> None:
    sign_up(client)
    token = client.cookies[COOKIE_NAME]
    with closing(sqlite3.connect(settings.db_path)) as db:
        [password_hash] = db.execute("SELECT password_hash FROM users").fetchone()
        [token_hash] = db.execute("SELECT token_hash FROM sessions").fetchone()
    assert PASSWORD not in password_hash
    assert token not in token_hash


def test_a_restart_signs_everyone_out(settings: Settings) -> None:
    app = create_app(settings)
    with TestClient(app) as client:
        sign_up(client)
        cookie = client.cookies[COOKIE_NAME]
    with TestClient(app) as client:
        client.cookies.set(COOKIE_NAME, cookie)
        assert me(client) == {"user": None}


def test_password_hashes_are_salted_and_verify() -> None:
    first, second = hash_password("secret pass"), hash_password("secret pass")
    assert first != second
    assert verify_password("secret pass", first)
    assert not verify_password("secret pasS", first)
    assert not verify_password("secret pass", "not a hash")
    assert not verify_password("secret pass", "bcrypt$00$00")
