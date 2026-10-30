"""The documents Prelegal can draft, read from documents.json at the repository root.

The frontend reads the same file at build time, so both sides agree on each document's fields.
"""

from functools import cached_property
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from ..config import get_settings

# A field default that means "today's date".
TODAY = "today"


class _Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True, extra="forbid")


class FieldDef(_Model):
    key: str
    label: str
    # "term" is a number of years, or the open-ended choice (e.g. "perpetual").
    kind: Literal["text", "date", "term"] = "text"
    essential: bool = False
    hint: str = ""
    default: str = ""
    open_ended: str | None = None


class DocumentDef(_Model):
    id: str
    name: str
    file_name: str
    description: str
    template: str
    # Party 1 plays the first role, party 2 the second.
    parties: tuple[str, str]
    fields: tuple[FieldDef, ...]

    @cached_property
    def all_fields(self) -> tuple[FieldDef, ...]:
        """Every field, in the order to ask about them: who the parties are, the document's own
        fields, then who signs for each party."""
        companies, signers = party_fields(self.parties)
        return (*companies, *self.fields, *signers)


class Registry(_Model):
    documents: tuple[DocumentDef, ...]


def party_fields(roles: tuple[str, str]) -> tuple[list[FieldDef], list[FieldDef]]:
    """The details every document has for each party (keys party1Company, party2Name and so on):
    the company names, and the signers' details."""
    companies, signers = [], []
    for n, role in enumerate(roles, start=1):
        companies.append(FieldDef(key=f"party{n}Company", label=f"{role}'s company name", essential=True))
        signers += [
            FieldDef(key=f"party{n}Name", label=f"{role}'s signer's name", essential=True),
            FieldDef(key=f"party{n}Title", label=f"{role}'s signer's title"),
            FieldDef(
                key=f"party{n}NoticeAddress", label=f"{role}'s notice address", hint="an email or postal address"
            ),
        ]
    return companies, signers


def load(path: Path | None = None) -> dict[str, DocumentDef]:
    path = path or get_settings().documents_path
    registry = Registry.model_validate_json(path.read_text(encoding="utf-8"))
    return {document.id: document for document in registry.documents}


DOCUMENTS = load()

# Fields the AI may record before a document is chosen; they carry over to whichever one is.
_companies, _signers = party_fields(("First party", "Second party"))
COMMON_FIELDS: tuple[FieldDef, ...] = (
    *_companies,
    FieldDef(key="effectiveDate", label="Effective Date", kind="date"),
    FieldDef(key="governingLaw", label="Governing Law"),
    FieldDef(key="chosenCourts", label="Chosen Courts"),
    *_signers,
)


def fields_for(document_id: str | None) -> tuple[FieldDef, ...]:
    return DOCUMENTS[document_id].all_fields if document_id else COMMON_FIELDS
