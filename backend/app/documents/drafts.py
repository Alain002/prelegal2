"""A draft agreement: which document it is and the fields filled in so far, plus merging the AI's changes."""

import re
from collections.abc import Iterable
from datetime import date
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..models import CamelModel
from .registry import DOCUMENTS, TODAY, FieldDef, fields_for

MAX_TEXT = 2000
MAX_YEARS = 99
MAX_FIELDS = 100


class Draft(CamelModel):
    """Mirrors Draft in frontend/src/lib/documents/types.ts. Field values are plain strings keyed by
    field key; a missing key means blank."""

    document_id: str | None = None
    fields: Annotated[dict[str, Annotated[str, Field(max_length=MAX_TEXT)]], Field(max_length=MAX_FIELDS)] = {}

    @field_validator("document_id")
    @classmethod
    def known_document(cls, document_id: str | None) -> str | None:
        if document_id is not None and document_id not in DOCUMENTS:
            raise ValueError(f"unknown document {document_id!r}")
        return document_id


class FieldUpdate(BaseModel):
    """One field the AI fills in. Part of the AI's answer, so the schema stays strict."""

    model_config = ConfigDict(extra="forbid")

    key: str
    value: str


def _default(field: FieldDef, today: date) -> str:
    return today.isoformat() if field.default == TODAY else field.default


def _term(field: FieldDef, value: str) -> str | None:
    """A number of years (1-99), or the open-ended choice. None when the value is neither."""
    if match := re.match(r"\d+", value):
        return str(min(max(int(match[0]), 1), MAX_YEARS))
    # Compare the start of the choice, so "in perpetuity" matches "perpetual" and
    # "continues until terminated" matches "until terminated".
    if field.open_ended and field.open_ended[:7].lower() in value.lower():
        return field.open_ended
    return None


def clean(field: FieldDef, value: str, old: str) -> str:
    """The value to store for an update, keeping the field valid. Falls back to the old value."""
    value = value.strip()
    if not value:
        # Only optional fields can be cleared, so a slip can't erase an essential answer.
        return old if field.essential else ""
    match field.kind:
        case "date":
            try:
                return date.fromisoformat(value).isoformat()
            except ValueError:
                return old
        case "term":
            return _term(field, value) or old
        case _:
            return value[:MAX_TEXT]


def start(document_id: str, carried: dict[str, str], today: date) -> dict[str, str]:
    """A new draft of a document: answers that apply to it carry over, everything else starts at its default."""
    fields = {f.key: carried.get(f.key) or _default(f, today) for f in DOCUMENTS[document_id].all_fields}
    return {key: value for key, value in fields.items() if value}


def apply_turn(
    draft: Draft, document_id: str | None, updates: Iterable[FieldUpdate], today: date
) -> Draft:
    """The draft after the AI's turn: switch document if it chose one, then apply its updates.
    Only the document's own fields are kept, and blank ones are left out."""
    if document_id and document_id != draft.document_id:
        fields = start(document_id, draft.fields, today)
    else:
        document_id, fields = draft.document_id, dict(draft.fields)

    allowed = {f.key: f for f in fields_for(document_id)}
    for update in updates:
        if field := allowed.get(update.key):
            fields[field.key] = clean(field, update.value, fields.get(field.key, ""))
    return Draft(document_id=document_id, fields={k: v for k, v in fields.items() if v and k in allowed})


def missing(draft: Draft) -> list[FieldDef]:
    """The essential fields still blank, in the order to ask about them."""
    if draft.document_id is None:
        return []
    return [f for f in DOCUMENTS[draft.document_id].all_fields if f.essential and not draft.fields.get(f.key)]
