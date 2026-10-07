"""Настройки через переменные окружения (значения по умолчанию — для домашнего запуска)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


def _bool(name: str, default: bool) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    database_url: str = os.environ.get("ITALY_STUDY_DB", f"sqlite:///{(ROOT / 'data' / 'italy_study.db').as_posix()}")
    # Secure-cookie передаются только по HTTPS. Дома по Wi-Fi сайт открывается по http,
    # поэтому по умолчанию выключено; на сервере с HTTPS включите ITALY_STUDY_HTTPS=1.
    https: bool = _bool("ITALY_STUDY_HTTPS", False)
    session_days: int = int(os.environ.get("ITALY_STUDY_SESSION_DAYS", "30"))
    allow_registration: bool = _bool("ITALY_STUDY_ALLOW_REGISTRATION", True)
    frontend_dist: Path = field(default_factory=lambda: ROOT / "frontend" / "dist")


settings = Settings()
