"""A user's saved documents (/api/documents): each is a draft and the conversation that produced it.

The browser saves after every chat turn, so a user can come back to a document and keep going.
Every query is scoped to the signed-in user, and someone else's document is simply not found.
"""

import json
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, model_validator

from ..auth import User, require_user
from ..db import Db, now_iso
from ..documents.drafts import Draft
from ..documents.registry import DOCUMENTS
from ..models import CamelModel
from .chat import ChatMessage

router = APIRouter(prefix="/api/documents")

NOT_FOUND = "Document not found."
# More than the chat sends the AI (MAX_MESSAGES): a saved conversation keeps its whole history.
# Mirrored by MAX_SAVED_MESSAGES in frontend/src/lib/saved/api.ts.
MAX_SAVED_MESSAGES = 200


class SaveRequest(CamelModel):
    draft: Draft
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_SAVED_MESSAGES)

    @model_validator(mode="after")
    def has_a_document(self) -> "SaveRequest":
        # Nothing is saved until the AI has picked a document.
        if self.draft.document_id is None:
            raise ValueError("the draft has no document yet")
        return self


class Summary(CamelModel):
    id: int
    document_id: str
    document_name: str
    # "Acme Inc. / Globex LLC", or null until a party is known.
    title: str | None
    created_at: str
    updated_at: str


class SavedDocument(Summary):
    draft: Draft
    messages: list[ChatMessage]


class SummaryList(CamelModel):
    documents: list[Summary]


def _title(fields: dict[str, str]) -> str | None:
    parties = [name for key in ("party1Company", "party2Company") if (name := fields.get(key, "").strip())]
    return " / ".join(parties) or None


def _summary(row: sqlite3.Row, draft: Draft) -> Summary:
    return Summary(
        id=row["id"],
        document_id=row["document_id"],
        document_name=DOCUMENTS[row["document_id"]].name,
        title=_title(draft.fields),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _get(conn: sqlite3.Connection, user: User, document_id: int) -> SavedDocument:
    row = conn.execute("SELECT * FROM documents WHERE id = ? AND user_id = ?", (document_id, user.id)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    draft = Draft.model_validate_json(row["draft"])
    return SavedDocument(
        **_summary(row, draft).model_dump(),
        draft=draft,
        messages=[ChatMessage.model_validate(m) for m in json.loads(row["messages"])],
    )


def _columns(body: SaveRequest) -> tuple[str, str, str]:
    """The request as the documents table stores it: document_id, draft and messages."""
    draft = body.draft.model_dump_json(by_alias=True)
    messages = json.dumps([m.model_dump() for m in body.messages])
    return body.draft.document_id, draft, messages


@router.get("")
def list_documents(conn: Db, user: User = Depends(require_user)) -> SummaryList:
    rows = conn.execute(
        "SELECT * FROM documents WHERE user_id = ? ORDER BY updated_at DESC, id DESC", (user.id,)
    ).fetchall()
    return SummaryList(documents=[_summary(row, Draft.model_validate_json(row["draft"])) for row in rows])


@router.post("", status_code=201)
def create_document(body: SaveRequest, conn: Db, user: User = Depends(require_user)) -> SavedDocument:
    now = now_iso()
    cursor = conn.execute(
        "INSERT INTO documents (user_id, document_id, draft, messages, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (user.id, *_columns(body), now, now),
    )
    return _get(conn, user, cursor.lastrowid)


@router.get("/{document_id}")
def get_document(document_id: int, conn: Db, user: User = Depends(require_user)) -> SavedDocument:
    return _get(conn, user, document_id)


@router.put("/{document_id}")
def update_document(
    document_id: int, body: SaveRequest, conn: Db, user: User = Depends(require_user)
) -> SavedDocument:
    cursor = conn.execute(
        "UPDATE documents SET document_id = ?, draft = ?, messages = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        (*_columns(body), now_iso(), document_id, user.id),
    )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return _get(conn, user, document_id)


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, conn: Db, user: User = Depends(require_user)) -> None:
    cursor = conn.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (document_id, user.id))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
