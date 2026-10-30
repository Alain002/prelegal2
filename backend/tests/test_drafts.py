from datetime import date

import pytest
from pydantic import ValidationError

from app.documents.drafts import Draft, apply_turn, missing
from tests.factories import PILOT, turn

TODAY = date(2026, 10, 30)


def apply(draft: Draft, document_id: str | None = None, **updates: str) -> Draft:
    return apply_turn(draft, document_id, turn(**updates).updates, TODAY)


def pilot(**fields: str) -> Draft:
    return Draft(document_id="pilot", fields=PILOT | fields)


def test_choosing_a_document_starts_it_with_its_defaults() -> None:
    draft = apply(Draft(), "mutual-nda")
    assert draft.document_id == "mutual-nda"
    assert draft.fields == {
        "purpose": "Evaluating whether to enter into a business relationship with the other party.",
        "effectiveDate": "2026-10-30",
        "mndaTerm": "1",
        "confidentialityTerm": "1",
    }


def test_answers_given_before_choosing_carry_over() -> None:
    draft = apply(Draft(), party1Company="Acme Inc.", governingLaw="Delaware", product="ignored for now")
    assert draft.fields == {"party1Company": "Acme Inc.", "governingLaw": "Delaware"}

    chosen = apply(draft, "csa", product="Acme Cloud")
    assert chosen.fields == {
        "party1Company": "Acme Inc.",
        "governingLaw": "Delaware",
        "effectiveDate": "2026-10-30",
        "product": "Acme Cloud",
    }


def test_switching_keeps_shared_answers_and_drops_the_rest() -> None:
    switched = apply(pilot(fees="$1,000"), "mutual-nda")

    assert switched.document_id == "mutual-nda"
    kept = {"party1Company", "party2Company", "effectiveDate", "governingLaw", "chosenCourts", "party1Name", "party2Name"}
    assert {key: switched.fields[key] for key in kept} == {key: PILOT[key] for key in kept}
    # Pilot-only answers are gone, and the NDA's own fields start at their defaults.
    assert {"product", "pilotPeriod", "generalCapAmount", "fees"}.isdisjoint(switched.fields)
    assert switched.fields["mndaTerm"] == "1"


def test_choosing_the_same_document_again_changes_nothing() -> None:
    assert apply(pilot(), "pilot") == pilot()


def test_updates_are_trimmed_and_unknown_keys_ignored() -> None:
    draft = apply(pilot(), product="  Acme Insights  ", purpose="not a pilot field", nonsense="x")
    assert draft.fields == PILOT | {"product": "Acme Insights"}


def test_text_is_capped() -> None:
    assert len(apply(pilot(), product="x" * 5000).fields["product"]) == 2000


def test_a_blank_answer_never_erases_an_essential_field() -> None:
    assert apply(pilot(), governingLaw="  ").fields["governingLaw"] == "Delaware"


def test_a_blank_answer_clears_an_optional_field() -> None:
    assert "fees" not in apply(pilot(fees="$1,000"), fees="").fields


@pytest.mark.parametrize(("value", "stored"), [("2026-12-01", "2026-12-01"), ("next Tuesday", "2026-11-01"), ("2026-02-30", "2026-11-01")])
def test_dates_must_be_real_iso_dates(value: str, stored: str) -> None:
    assert apply(pilot(), effectiveDate=value).fields["effectiveDate"] == stored


@pytest.mark.parametrize(
    ("value", "stored"),
    [("3", "3"), ("2 years", "2"), ("0", "1"), ("250", "99"), ("perpetual", "perpetual"), ("in perpetuity", "perpetual"), ("forever-ish", "1")],
)
def test_terms_are_years_or_the_open_ended_choice(value: str, stored: str) -> None:
    nda = apply(Draft(), "mutual-nda")
    assert apply(nda, confidentialityTerm=value).fields["confidentialityTerm"] == stored


def test_the_mnda_term_can_continue_until_terminated() -> None:
    nda = apply(Draft(), "mutual-nda")
    assert apply(nda, mndaTerm="Continues until terminated").fields["mndaTerm"] == "until terminated"


def test_missing_lists_blank_essential_fields_in_order() -> None:
    draft = Draft(document_id="pilot", fields={"party1Company": "Acme Inc.", "fees": "$1"})
    assert [f.key for f in missing(draft)] == [
        "party2Company",
        "effectiveDate",
        "product",
        "pilotPeriod",
        "generalCapAmount",
        "governingLaw",
        "chosenCourts",
        "party1Name",
        "party2Name",
    ]
    assert missing(pilot()) == []
    assert missing(Draft()) == []


def test_rejects_unknown_documents() -> None:
    with pytest.raises(ValidationError):
        Draft(document_id="employment-contract")
