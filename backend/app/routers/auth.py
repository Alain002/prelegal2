"""Sign up, sign in, sign out, and who is signed in: /api/auth/*."""

import re
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from ..auth import User, authenticate, create_user, current_user, end_session, normalize_email, start_session
from ..db import Db

router = APIRouter(prefix="/api/auth")

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128

EMAIL_TAKEN = "An account with this email already exists. Sign in instead."
BAD_CREDENTIALS = "Incorrect email or password."
INVALID_EMAIL = "Enter a valid email address."
SHORT_PASSWORD = f"Use a password of at least {MIN_PASSWORD_LENGTH} characters."

# Deliberately loose: something@something.something, with no spaces.
_EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


class Credentials(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class UserOut(BaseModel):
    email: str


class SessionOut(BaseModel):
    """`user` is null when nobody is signed in."""

    user: UserOut | None


def _out(user: User | None) -> SessionOut:
    return SessionOut(user=UserOut(email=user.email) if user else None)


@router.post("/signup", status_code=201)
def sign_up(credentials: Credentials, response: Response, conn: Db) -> SessionOut:
    email = normalize_email(credentials.email)
    if not _EMAIL.fullmatch(email):
        raise HTTPException(status_code=422, detail=INVALID_EMAIL)
    if len(credentials.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=422, detail=SHORT_PASSWORD)
    try:
        user = create_user(conn, email, credentials.password)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail=EMAIL_TAKEN)
    start_session(conn, response, user)
    return _out(user)


@router.post("/signin")
def sign_in(credentials: Credentials, response: Response, conn: Db) -> SessionOut:
    user = authenticate(conn, normalize_email(credentials.email), credentials.password)
    if user is None:
        raise HTTPException(status_code=401, detail=BAD_CREDENTIALS)
    start_session(conn, response, user)
    return _out(user)


@router.post("/signout", status_code=204)
def sign_out(request: Request, response: Response, conn: Db) -> None:
    end_session(conn, request, response)


@router.get("/me")
def me(user: User | None = Depends(current_user)) -> SessionOut:
    # Never a 401: the page asks on every load, and a signed-out visitor is not an error.
    return _out(user)
