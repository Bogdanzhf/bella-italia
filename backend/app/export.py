"""Выгрузка курса в JSON для фронтенда.

    poetry run python -m app.export            (из папки backend)

Файл кладётся в frontend/public/data/course.json и попадает в сборку Vite.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from .content import ContentError, export_course, load_library

OUT = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "data" / "course.json"


def build(out: Path = OUT) -> dict:
    data = export_course(load_library())
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    data["hash"] = hashlib.sha256(body.encode()).hexdigest()[:12]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return data


def main() -> None:
    try:
        data = build()
    except ContentError as exc:
        print(f"Ошибка в контенте: {exc}", file=sys.stderr)
        sys.exit(1)
    lessons = sum(len(u["lessons"]) for u in data["units"])
    words = sum(len(les.get("words", [])) for u in data["units"] for les in u["lessons"])
    exercises = sum(len(les.get("exercises", [])) for u in data["units"] for les in u["lessons"])
    exercises += sum(len(s["exercises"]) for t in data["tests"] for s in t["sections"])
    size = OUT.stat().st_size // 1024
    print(f"course.json: {len(data['units'])} юнитов, {lessons} уроков, {words} слов, "
          f"{exercises} заданий, {len(data['tests'])} тестов, {len(data['images'])} картинок — {size} КБ")


if __name__ == "__main__":
    main()
