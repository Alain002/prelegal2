"""Settings read from environment variables, with defaults for local development."""

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    db_path: Path
    static_dir: Path


def get_settings() -> Settings:
    return Settings(
        db_path=Path(os.environ.get("PRELEGAL_DB_PATH", BACKEND_DIR / "data" / "prelegal.db")),
        static_dir=Path(os.environ.get("PRELEGAL_STATIC_DIR", BACKEND_DIR.parent / "frontend" / "out")),
    )
