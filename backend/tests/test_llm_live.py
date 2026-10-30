"""Calls the real model. Opt in with `uv run pytest -m live` (needs OPENROUTER_API_KEY, e.g. in .env)."""

import os
from datetime import date
from types import SimpleNamespace

import pytest

from app.documents.nda import NdaTurn, NdaValues, apply_patch, build_messages
from app.llm import complete
from tests.factories import blank_values

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY is not set"),
]

EMPTY = NdaValues.model_validate(blank_values())


def test_the_real_model_fills_in_fields_from_a_message() -> None:
    history = [
        SimpleNamespace(role="assistant", content="Hi! Who are the two parties, and what is the NDA for?"),
        SimpleNamespace(
            role="user",
            content="Acme Inc. and Globex LLC want to explore a joint venture. Delaware law, and the NDA "
            "should last 2 years.",
        ),
    ]
    turn = complete(build_messages(EMPTY, history, date(2026, 10, 30)), NdaTurn)
    values = apply_patch(EMPTY, turn.patch)

    assert turn.reply.strip()
    assert {p.company for p in values.parties} == {"Acme Inc.", "Globex LLC"}
    assert "Delaware" in values.governing_law
    assert values.mnda_term.model_dump() == {"kind": "expires", "years": 2}
    # Nothing was said about signers, so the model must not invent them.
    assert all(not p.name for p in values.parties)


def test_the_real_model_clears_modifications_only_when_asked() -> None:
    values = EMPTY.model_copy(update={"modifications": "Section 8 does not apply."})
    def say(text: str) -> NdaValues:
        history = [SimpleNamespace(role="user", content=text)]
        return apply_patch(values, complete(build_messages(values, history, date(2026, 10, 30)), NdaTurn).patch)

    unrelated = say("The governing law is Delaware.")
    assert unrelated.modifications == "Section 8 does not apply."

    cleared = say("Actually, remove the modifications. We don't want any.")
    assert cleared.modifications == ""
