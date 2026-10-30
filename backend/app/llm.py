"""Calls the LLM: gpt-oss-120b through OpenRouter, served by Cerebras, with Structured Outputs."""

import os
from typing import Protocol, TypeVar

from pydantic import BaseModel

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
TIMEOUT_SECONDS = 60

# Use LiteLLM's bundled model price list instead of downloading it on import.
os.environ.setdefault("LITELLM_LOCAL_MODEL_COST_MAP", "True")

T = TypeVar("T", bound=BaseModel)


class LlmError(Exception):
    """The LLM could not produce a usable answer. The message is for logs, not for users."""


class Llm(Protocol):
    def __call__(self, messages: list[dict[str, str]], response_format: type[T]) -> T: ...


def complete(messages: list[dict[str, str]], response_format: type[T]) -> T:
    """Sends `messages` and returns the model's answer parsed as `response_format`."""
    if not os.environ.get("OPENROUTER_API_KEY"):
        raise LlmError("OPENROUTER_API_KEY is not set")

    from litellm import completion  # Imported here because it is slow to import: keeps startup fast.

    try:
        response = completion(
            model=MODEL,
            messages=messages,
            response_format=response_format,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
            timeout=TIMEOUT_SECONDS,
        )
        return response_format.model_validate_json(response.choices[0].message.content)
    except Exception as error:
        raise LlmError(f"LLM call failed: {error}") from error


def get_llm() -> Llm:
    """FastAPI dependency, so tests can swap in a fake LLM."""
    return complete
