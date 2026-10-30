"""Accounts and sign-in sessions: password hashing, session tokens and the current-user dependencies.

A session is a random token in an httpOnly cookie. The database keeps only its SHA-256 hash, so a
copy of the database can't be used to sign in.
"""

import hashlib
import hmac
import os
import secrets
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, Request, Response

from .db import Db, now_iso

COOKIE_NAME = "prelegal_session"
SESSION_LIFETIME = timedelta(days=14)
NOT_SIGNED_IN = "Please sign in."

# scrypt with the cost OWASP recommends (about 16 MB of memory per hash).
_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


@dataclass(frozen=True)
class User:
    id: int
    email: str


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), **_SCRYPT)
        return hmac.compare_digest(actual, bytes.fromhex(digest))
    except ValueError:
        return False


# Checked against when the email is unknown, so a wrong email takes as long as a wrong password.
_DUMMY_HASH = hash_password(secrets.token_hex(8))


def normalize_email(email: str) -> str:
    return email.strip().lower()


def create_user(conn: sqlite3.Connection, email: str, password: str) -> User:
    """Raises sqlite3.IntegrityError when the email is taken."""
    cursor = conn.execute(
        "INSERT INTO users (email, password_hash) VALUES (?, ?)", (email, hash_password(password))
    )
    return User(id=cursor.lastrowid, email=email)


def authenticate(conn: sqlite3.Connection, email: str, password: str) -> User | None:
    row = conn.execute("SELECT id, email, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    if row is None:
        verify_password(password, _DUMMY_HASH)
        return None
    return User(id=row["id"], email=row["email"]) if verify_password(password, row["password_hash"]) else None


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start_session(conn: sqlite3.Connection, response: Response, user: User) -> None:
    """Signs `user` in: stores a new session and sets its cookie on `response`."""
    now = datetime.now(UTC)
    conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now.isoformat(),))
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        (_hash_token(token), user.id, (now + SESSION_LIFETIME).isoformat()),
    )
    # Not `secure`: the app is served over plain http://localhost.
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        httponly=True,
        samesite="lax",
        path="/",
    )


def end_session(conn: sqlite3.Connection, request: Request, response: Response) -> None:
    if token := request.cookies.get(COOKIE_NAME):
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(token),))
    response.delete_cookie(COOKIE_NAME, path="/", httponly=True, samesite="lax")


def current_user(request: Request, conn: Db) -> User | None:
    """The signed-in user, or None."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    row = conn.execute(
        "SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id"
        " WHERE sessions.token_hash = ? AND sessions.expires_at > ?",
        (_hash_token(token), now_iso()),
    ).fetchone()
    return User(id=row["id"], email=row["email"]) if row else None


def require_user(user: User | None = Depends(current_user)) -> User:
    """FastAPI dependency for endpoints that need a signed-in user."""
    if user is None:
        raise HTTPException(status_code=401, detail=NOT_SIGNED_IN)
    return user
