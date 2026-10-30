"""Test data shared by the chat and document tests."""

from app.documents.assistant import Turn
from app.documents.drafts import FieldUpdate


def turn(reply: str = "Got it.", question: str | None = None, document_id: str | None = None, **updates: str) -> Turn:
    """An AI answer that sets `updates` (field key to value)."""
    return Turn(
        reply=reply,
        question=question,
        document_id=document_id,
        updates=[FieldUpdate(key=key, value=value) for key, value in updates.items()],
    )


# Every essential field of the Pilot Agreement, filled in.
PILOT = {
    "party1Company": "Acme Inc.",
    "party2Company": "Globex LLC",
    "effectiveDate": "2026-11-01",
    "product": "Acme Analytics",
    "pilotPeriod": "90 days",
    "generalCapAmount": "$50,000",
    "governingLaw": "Delaware",
    "chosenCourts": "courts located in Wilmington, Delaware",
    "party1Name": "Ada Lovelace",
    "party2Name": "Alan Turing",
}
