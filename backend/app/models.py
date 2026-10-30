"""Shared base for API and file models."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """camelCase in JSON (documentId), snake_case in Python (document_id). Accepts either on input."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
