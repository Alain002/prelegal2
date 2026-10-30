"""POST /api/chat: one turn of the drafting conversation, for signed-in users."""

import logging
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from ..auth import require_user
from ..documents.assistant import Turn, build_messages, compose_reply
from ..documents.drafts import Draft, apply_turn
from ..llm import Llm, LlmError, get_llm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

UNAVAILABLE = "The AI assistant is unavailable right now. Please try again."
NO_REPLY = "Sorry, I didn't catch that. Could you say it another way?"
# The browser sends at most the latest 40 messages (frontend/src/lib/chat/useChat.ts), so a
# long conversation never reaches this limit.
MAX_MESSAGES = 60
MAX_MESSAGE_LENGTH = 4000


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class ChatRequest(BaseModel):
    """The whole conversation so far (the browser keeps it) and the draft as it stands."""

    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    draft: Draft
    # The user's date, so "today" is right in their timezone.
    today: date | None = None

    @model_validator(mode="after")
    def ends_with_the_user(self) -> "ChatRequest":
        if self.messages[-1].role != "user":
            raise ValueError("the last message must be from the user")
        return self


class ChatResponse(BaseModel):
    reply: str
    draft: Draft


@router.post("/chat", dependencies=[Depends(require_user)])
def chat(request: ChatRequest, llm: Llm = Depends(get_llm)) -> ChatResponse:
    # A plain (sync) function: FastAPI runs it in a worker thread, so the blocking LLM call
    # doesn't hold up other requests.
    today = request.today or date.today()
    messages = build_messages(request.draft, request.messages, today)
    try:
        turn = llm(messages, Turn)
    except LlmError:
        logger.exception("Chat turn failed")
        raise HTTPException(status_code=502, detail=UNAVAILABLE)
    draft = apply_turn(request.draft, turn.document_id, turn.updates, today)
    # The reply comes back in the next request, so it must fit the message length limit.
    reply = (compose_reply(turn, draft) or NO_REPLY)[:MAX_MESSAGE_LENGTH]
    return ChatResponse(reply=reply, draft=draft)
