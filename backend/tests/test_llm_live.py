"""Calls the real model. Opt in with `uv run pytest -m live` (needs OPENROUTER_API_KEY, e.g. in .env)."""

import os
from datetime import date
from types import SimpleNamespace

import pytest

from app.documents.assistant import Turn, build_messages, compose_reply
from app.documents.drafts import Draft, apply_turn
from app.llm import complete

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY is not set"),
]

TODAY = date(2026, 10, 30)
GREETING = "Hi! I can help you draft a legal agreement. What would you like to create?"


def say(draft: Draft, text: str) -> tuple[Turn, Draft, str]:
    """One turn with the real model: its answer, the new draft, and the reply the user sees."""
    history = [SimpleNamespace(role="assistant", content=GREETING), SimpleNamespace(role="user", content=text)]
    turn = complete(build_messages(draft, history, TODAY), Turn)
    new = apply_turn(draft, turn.document_id, turn.updates, TODAY)
    return turn, new, compose_reply(turn, new)


def test_offers_the_closest_document_for_an_unsupported_request() -> None:
    _, draft, reply = say(Draft(), "I need an employment contract for a new engineer.")
    assert draft.document_id is None
    assert "Professional Services Agreement" in reply
    assert "?" in reply


def test_picks_the_document_from_a_description() -> None:
    _, draft, reply = say(Draft(), "We want a prospective customer to trial our product for 3 months before buying.")
    assert draft.document_id == "pilot"
    assert "?" in reply


def test_fills_in_every_field_a_message_mentions() -> None:
    draft = Draft(document_id="pilot", fields={"effectiveDate": "2026-10-30"})
    _, draft, reply = say(
        draft,
        "Provider is Acme Inc., customer is Globex LLC. A 90 day pilot of Acme Analytics, Delaware law, "
        "courts in Wilmington, liability cap of $50,000.",
    )
    fields = draft.fields
    assert (fields["party1Company"], fields["party2Company"]) == ("Acme Inc.", "Globex LLC")
    assert fields["governingLaw"] == "Delaware"
    assert "90" in fields["pilotPeriod"]
    assert "50,000" in fields["generalCapAmount"]
    assert "Wilmington" in fields["chosenCourts"]
    # Nothing was said about signers, so the model must not invent them, and must ask.
    assert "party1Name" not in fields and "party2Name" not in fields
    assert "?" in reply


def test_switching_documents_keeps_the_parties() -> None:
    nda = Draft(
        document_id="mutual-nda",
        fields={"party1Company": "Acme Inc.", "party2Company": "Globex LLC", "governingLaw": "Delaware"},
    )
    _, draft, _ = say(nda, "Actually we need a Cloud Service Agreement instead: Acme sells its SaaS to Globex.")
    assert draft.document_id == "csa"
    assert draft.fields["party1Company"] == "Acme Inc."
    assert draft.fields["governingLaw"] == "Delaware"
