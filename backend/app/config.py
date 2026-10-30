"""Settings read from environment variables, with defaults for local development."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent

# Local development reads secrets such as OPENROUTER_API_KEY from the repository's .env.
# In Docker they arrive as real environment variables, which take precedence.
load_dotenv(BACKEND_DIR.parent / ".env", override=False)


@dataclass(frozen=True)
class Settings:
    db_path: Path
    static_dir: Path
    # The documents Prelegal can draft, shared with the frontend. Read once, when the app loads.
    documents_path: Path = BACKEND_DIR.parent / "documents.json"


def get_settings() -> Settings:
    return Settings(
        db_path=Path(os.environ.get("PRELEGAL_DB_PATH", BACKEND_DIR / "data" / "prelegal.db")),
        static_dir=Path(os.environ.get("PRELEGAL_STATIC_DIR", BACKEND_DIR.parent / "frontend" / "out")),
        documents_path=Path(os.environ.get("PRELEGAL_DOCUMENTS_PATH", BACKEND_DIR.parent / "documents.json")),
    )
