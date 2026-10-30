from types import SimpleNamespace
from typing import Any

import litellm
import pytest
from pydantic import BaseModel

from app import llm


class Answer(BaseModel):
    text: str


def fake_completion(content: str | None, calls: list[dict[str, Any]]):
    def completion(**kwargs: Any) -> SimpleNamespace:
        calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    return completion


@pytest.fixture(autouse=True)
def api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")


def test_calls_gpt_oss_on_cerebras_with_structured_outputs(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr(litellm, "completion", fake_completion('{"text": "hello"}', calls))
    messages = [{"role": "user", "content": "Hi"}]

    assert llm.complete(messages, Answer) == Answer(text="hello")

    [call] = calls
    assert call["model"] == "openrouter/openai/gpt-oss-120b"
    assert call["extra_body"] == {"provider": {"order": ["cerebras"]}}
    assert call["response_format"] is Answer
    assert call["reasoning_effort"] == "low"
    assert call["messages"] == messages


@pytest.mark.parametrize("content", ["not json", '{"other": 1}', None])
def test_unusable_answers_raise_llm_error(monkeypatch: pytest.MonkeyPatch, content: str | None) -> None:
    monkeypatch.setattr(litellm, "completion", fake_completion(content, []))
    with pytest.raises(llm.LlmError):
        llm.complete([{"role": "user", "content": "Hi"}], Answer)


def test_provider_errors_raise_llm_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def failing(**kwargs: Any) -> None:
        raise litellm.exceptions.APIConnectionError("down", llm_provider="openrouter", model=llm.MODEL)

    monkeypatch.setattr(litellm, "completion", failing)
    with pytest.raises(llm.LlmError):
        llm.complete([{"role": "user", "content": "Hi"}], Answer)


def test_a_missing_api_key_raises_llm_error_without_calling(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr(litellm, "completion", fake_completion('{"text": "hello"}', calls))
    monkeypatch.delenv("OPENROUTER_API_KEY")

    with pytest.raises(llm.LlmError, match="OPENROUTER_API_KEY"):
        llm.complete([{"role": "user", "content": "Hi"}], Answer)
    assert calls == []
