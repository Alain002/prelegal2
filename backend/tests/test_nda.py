from datetime import date
from types import SimpleNamespace

import pytest

from app.documents.nda import NdaValues, apply_patch, build_messages
from tests.factories import blank_values, patch

ADA = {"name": "Ada Lovelace", "title": "CEO", "company": "Acme Inc.", "noticeAddress": "ada@acme.test"}
VALUES = NdaValues.model_validate(
    blank_values(purpose="Evaluating a partnership.", parties=[ADA, blank_values()["parties"][1]])
)


def test_an_empty_patch_changes_nothing() -> None:
    assert apply_patch(VALUES, patch()) == VALUES


def test_applies_text_fields_trimmed() -> None:
    result = apply_patch(
        VALUES,
        patch(governing_law="  Delaware ", jurisdiction="courts located in New Castle, DE", modifications="None."),
    )
    assert result.governing_law == "Delaware"
    assert result.jurisdiction == "courts located in New Castle, DE"
    assert result.modifications == "None."
    assert result.purpose == VALUES.purpose


def test_applies_party_fields_without_touching_the_other_party() -> None:
    result = apply_patch(VALUES, patch(party2_company="Globex LLC", party2_notice_address="1 Main St\nWilmington"))
    assert result.parties[1].company == "Globex LLC"
    assert result.parties[1].notice_address == "1 Main St\nWilmington"
    assert result.parties[0] == VALUES.parties[0]


@pytest.mark.parametrize("blank", ["", "   "])
def test_blank_text_keeps_the_current_value(blank: str) -> None:
    result = apply_patch(VALUES, patch(purpose=blank, party1_company=blank))
    assert result.purpose == VALUES.purpose
    assert result.parties[0].company == "Acme Inc."


@pytest.mark.parametrize("blank", ["", "  "])
def test_modifications_can_be_cleared(blank: str) -> None:
    with_changes = apply_patch(VALUES, patch(modifications="Section 8 does not apply."))
    assert with_changes.modifications == "Section 8 does not apply."
    assert apply_patch(with_changes, patch(modifications=blank)).modifications == ""
    assert apply_patch(with_changes, patch()).modifications == "Section 8 does not apply."


def test_caps_very_long_text() -> None:
    assert len(apply_patch(VALUES, patch(purpose="x" * 5000)).purpose) == 2000


@pytest.mark.parametrize(
    ("new", "expected"),
    [("2026-11-15", "2026-11-15"), (" 2027-01-01 ", "2027-01-01"), ("2026-02-30", "2026-10-30"), ("next week", "2026-10-30")],
)
def test_accepts_only_real_iso_dates(new: str, expected: str) -> None:
    assert apply_patch(VALUES, patch(effective_date=new)).effective_date == expected


def test_switches_the_mnda_term_to_until_terminated_and_back() -> None:
    open_ended = apply_patch(VALUES, patch(mnda_term_kind="untilTerminated", mnda_term_years=3))
    assert open_ended.mnda_term.kind == "untilTerminated"

    back = apply_patch(open_ended, patch(mnda_term_kind="expires"))
    assert back.mnda_term.model_dump() == {"kind": "expires", "years": 1}


def test_years_on_their_own_mean_the_term_expires() -> None:
    open_ended = apply_patch(VALUES, patch(mnda_term_kind="untilTerminated"))
    result = apply_patch(open_ended, patch(mnda_term_years=2))
    assert result.mnda_term.model_dump() == {"kind": "expires", "years": 2}


def test_keeps_the_years_when_only_the_kind_is_repeated() -> None:
    two_years = apply_patch(VALUES, patch(confidentiality_term_years=2))
    assert apply_patch(two_years, patch(confidentiality_term_kind="years")).confidentiality_term.years == 2


@pytest.mark.parametrize(("years", "expected"), [(0, 1), (-5, 1), (150, 99), (5, 5)])
def test_clamps_years_to_1_through_99(years: int, expected: int) -> None:
    result = apply_patch(VALUES, patch(mnda_term_years=years, confidentiality_term_years=years))
    assert result.mnda_term.years == expected
    assert result.confidentiality_term.years == expected


def test_confidentiality_in_perpetuity() -> None:
    result = apply_patch(VALUES, patch(confidentiality_term_kind="perpetual"))
    assert result.confidentiality_term.kind == "perpetual"


def test_does_not_modify_the_given_values() -> None:
    before = VALUES.model_copy(deep=True)
    apply_patch(VALUES, patch(purpose="Something else", party1_company="Other"))
    assert VALUES == before


def test_build_messages_puts_instructions_and_current_values_first() -> None:
    history = [
        SimpleNamespace(role="assistant", content="Hi! Who are the parties?"),
        SimpleNamespace(role="user", content="Acme and Globex."),
    ]
    messages = build_messages(VALUES, history, date(2026, 10, 30))

    assert [m["role"] for m in messages] == ["system", "assistant", "user"]
    system = messages[0]["content"]
    assert "Today's date is 2026-10-30" in system
    assert '"party1_company": "Acme Inc."' in system
    assert '"mnda_term_years": 1' in system
    assert messages[2] == {"role": "user", "content": "Acme and Globex."}


def test_values_use_camel_case_json() -> None:
    dumped = VALUES.model_dump(by_alias=True)
    assert {"effectiveDate", "mndaTerm", "confidentialityTerm", "governingLaw"} <= dumped.keys()
    assert "noticeAddress" in dumped["parties"][0]
