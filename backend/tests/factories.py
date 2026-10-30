"""Test data shared by the chat and NDA tests."""

from typing import Any

from app.documents.nda import NdaPatch


def blank_values(**overrides: Any) -> dict[str, Any]:
    """NDA values as the browser sends them at the start: defaults, today's date, no parties yet."""
    values: dict[str, Any] = {
        "purpose": "Evaluating whether to enter into a business relationship with the other party.",
        "effectiveDate": "2026-10-30",
        "mndaTerm": {"kind": "expires", "years": 1},
        "confidentialityTerm": {"kind": "years", "years": 1},
        "governingLaw": "",
        "jurisdiction": "",
        "modifications": "",
        "parties": [{"name": "", "title": "", "company": "", "noticeAddress": ""} for _ in range(2)],
    }
    return values | overrides


def patch(**changes: object) -> NdaPatch:
    """An AI patch that changes only `changes` (every other field is null)."""
    return NdaPatch(**{field: None for field in NdaPatch.model_fields} | changes)
