from datetime import date
from types import SimpleNamespace

from app.documents.assistant import Turn, build_messages, compose_reply, fallback_question
from app.documents.drafts import Draft
from tests.factories import PILOT, turn

TODAY = date(2026, 10, 30)
INCOMPLETE = Draft(document_id="pilot", fields={"party1Company": "Acme Inc."})
COMPLETE = Draft(document_id="pilot", fields=PILOT)


def system_prompt(draft: Draft) -> str:
    return build_messages(draft, [], TODAY)[0]["content"]


def test_lists_every_document_with_its_parties() -> None:
    prompt = system_prompt(Draft())
    assert "- csa: Cloud Service Agreement, Provider / Customer:" in prompt
    assert "- partnership: Partnership Agreement, Company / Partner:" in prompt
    assert "Today's date is 2026-10-30." in prompt


def test_before_a_document_is_chosen_offers_only_the_common_fields() -> None:
    prompt = system_prompt(Draft(fields={"governingLaw": "Delaware"}))
    assert "No document has been chosen yet" in prompt
    assert '- governingLaw: Governing Law, optional. Now: "Delaware"' in prompt
    assert "pilotPeriod" not in prompt


def test_describes_the_current_document_and_what_is_missing() -> None:
    prompt = system_prompt(INCOMPLETE)
    assert "The document being drafted: Pilot Agreement (pilot). Party 1 is the Provider" in prompt
    assert '- party1Company: Provider\'s company name, essential. Now: "Acme Inc."' in prompt
    assert '- effectiveDate: Effective Date [yyyy-mm-dd], essential, starts with a default. Now: ""' in prompt
    assert "Essential fields still missing, in the order to ask about them: Customer's company name, Effective Date," in prompt

    assert "Essential fields still missing, in the order to ask about them: nothing" in system_prompt(COMPLETE)


def test_sends_the_conversation_after_the_instructions() -> None:
    history = [SimpleNamespace(role="assistant", content="Hi!"), SimpleNamespace(role="user", content="An NDA")]
    messages = build_messages(Draft(), history, TODAY)
    assert messages[0]["role"] == "system"
    assert messages[1:] == [{"role": "assistant", "content": "Hi!"}, {"role": "user", "content": "An NDA"}]


def test_the_answer_schema_is_strict() -> None:
    schema = Turn.model_json_schema()
    assert schema["additionalProperties"] is False
    assert set(schema["required"]) == {"reply", "question", "document_id", "updates"}
    assert schema["$defs"]["FieldUpdate"]["additionalProperties"] is False


# --- Always asking what is still needed ---


def test_adds_the_ai_question_to_its_reply() -> None:
    reply = compose_reply(turn("Got it.", "What is the pilot period?"), INCOMPLETE)
    assert reply == "Got it.\n\nWhat is the pilot period?"


def test_does_not_ask_twice_when_the_reply_already_asks() -> None:
    reply = compose_reply(turn("Got it. How long is the pilot?", "What is the pilot period?"), INCOMPLETE)
    assert reply == "Got it. How long is the pilot?"


def test_a_question_mark_mid_reply_still_gets_a_closing_question() -> None:
    reply = compose_reply(turn("Is Delaware right? Great, noted."), INCOMPLETE)
    assert reply == "Is Delaware right? Great, noted.\n\nCould you tell me the Customer's company name?"


def test_a_reply_ending_in_a_quoted_question_counts_as_asking() -> None:
    reply = compose_reply(turn('Shall I call it "the pilot?"', "What is the pilot period?"), INCOMPLETE)
    assert reply == 'Shall I call it "the pilot?"'


def test_marks_fields_that_start_with_a_default() -> None:
    prompt = system_prompt(Draft(document_id="mutual-nda", fields={"mndaTerm": "1"}))
    assert '- mndaTerm: MNDA Term [number of years], essential, starts with a default (' in prompt


def test_asks_about_the_next_missing_field_when_the_ai_forgets() -> None:
    reply = compose_reply(turn("Got it."), INCOMPLETE)
    assert reply == "Got it.\n\nCould you tell me the Customer's company name?"


def test_includes_the_field_guidance_in_the_fallback_question() -> None:
    draft = Draft(document_id="pilot", fields={"party1Company": "Acme", "party2Company": "Globex", "effectiveDate": "2026-11-01"})
    assert fallback_question(draft) == "Could you tell me the Product (the product being trialled)?"


def test_asks_which_document_until_one_is_chosen() -> None:
    reply = compose_reply(turn("Prelegal can't draft employment contracts."), Draft())
    assert reply.startswith("Prelegal can't draft employment contracts.\n\nWhich document would you like to draft?")
    assert "Cloud Service Agreement" in reply


def test_a_complete_draft_needs_no_question() -> None:
    assert compose_reply(turn("All set! You can download it now."), COMPLETE) == "All set! You can download it now."
    assert fallback_question(COMPLETE) is None


def test_a_blank_answer_still_asks() -> None:
    assert compose_reply(turn("  "), INCOMPLETE) == "Could you tell me the Customer's company name?"
    assert compose_reply(turn("  "), COMPLETE) == ""
