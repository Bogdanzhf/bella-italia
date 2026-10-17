"""Личный словарь: разделы «Изучаю» / «Выучено», свои слова, правила перехода и изоляция данных."""

import uuid

from app.content import get_library
from app.db import SessionLocal, WordProgress, init_db
from tests.conftest import GOOD_PASSWORD, make_client

WORDS = list(get_library().words)


def words(c):
    return c.get("/api/progress").json()["words"]


def test_move_between_sections(user_client):
    a, b = WORDS[:2]
    assert user_client.post("/api/dict", json={"ids": [a, b], "status": "learning"}).status_code == 200
    w = words(user_client)
    assert w[a]["dict"] == w[b]["dict"] == "learning"
    assert w[a]["streak"] == 0 and "dict_added_at" in w[a]

    user_client.post("/api/dict", json={"ids": [a], "status": "learned"})
    user_client.post("/api/dict", json={"ids": [b], "status": None})
    w = words(user_client)
    assert w[a]["dict"] == "learned"
    assert w[b]["dict"] is None and "dict_added_at" not in w[b]


def test_three_correct_in_a_row_learns_and_mistake_returns(user_client):
    a = WORDS[5]
    user_client.post("/api/dict", json={"ids": [a], "status": "learning"})
    for i in range(2):
        user_client.post("/api/progress/reviews", json={"reviews": [{"id": a, "correct": True}]})
        assert words(user_client)[a]["dict"] == "learning"
    user_client.post("/api/progress/reviews", json={"reviews": [{"id": a, "correct": True}]})
    assert words(user_client)[a]["dict"] == "learned"

    # ошибка в любом упражнении (здесь — в результате теста) возвращает слово в «Изучаю»
    r = user_client.post("/api/progress/result", json={"kind": "unit", "scope": "1", "score": 0, "total": 1,
                                                       "words": [{"id": a, "correct": False}]})
    assert r.status_code == 200
    row = words(user_client)[a]
    assert row["dict"] == "learning" and row["streak"] == 0


def test_words_outside_dictionary_are_not_added(user_client):
    a = WORDS[7]
    user_client.post("/api/progress/reviews", json={"reviews": [{"id": a, "correct": False}]})
    assert words(user_client)[a]["dict"] is None


def test_custom_words_crud(user_client):
    r = user_client.post("/api/custom-words", json={"it": "  la   farfalla ", "ru": "бабочка", "note": "ж. р.",
                                                     "example": "Una farfalla gialla."})
    assert r.status_code == 200, r.text
    cw = r.json()
    assert cw["id"].startswith("c:") and cw["it"] == "la farfalla"
    p = user_client.get("/api/progress").json()
    assert p["custom"][0]["ru"] == "бабочка"
    assert p["words"][cw["id"]]["dict"] == "learning"

    # своё слово тренируется так же, как слово курса
    assert user_client.post("/api/progress/reviews", json={"reviews": [{"id": cw["id"], "correct": True}]}).status_code == 200
    r = user_client.put(f"/api/custom-words/{cw['id']}", json={"it": "la farfalla", "ru": "бабочка (насекомое)"})
    assert r.status_code == 200 and r.json()["ru"] == "бабочка (насекомое)"

    assert user_client.delete(f"/api/custom-words/{cw['id']}").status_code == 200
    p = user_client.get("/api/progress").json()
    assert p["custom"] == [] and cw["id"] not in p["words"]


def test_custom_word_validation(user_client):
    assert user_client.post("/api/custom-words", json={"it": "", "ru": "x"}).status_code == 422
    assert user_client.post("/api/custom-words", json={"it": "a" * 121, "ru": "x"}).status_code == 422
    assert user_client.post("/api/dict", json={"ids": ["нет-такого"], "status": "learning"}).status_code == 400
    assert user_client.post("/api/dict", json={"ids": [WORDS[0]], "status": "hacked"}).status_code == 422


def test_custom_words_are_isolated(user_client):
    cw = user_client.post("/api/custom-words", json={"it": "segreto", "ru": "секрет"}).json()
    with make_client() as other:
        name = f"user_{uuid.uuid4().hex[:8]}"
        other.post("/api/auth/register", json={"username": name, "password": GOOD_PASSWORD, "display_name": "Ева"})
        assert other.get("/api/progress").json()["custom"] == []
        assert other.put(f"/api/custom-words/{cw['id']}", json={"it": "x", "ru": "y"}).status_code == 404
        assert other.delete(f"/api/custom-words/{cw['id']}").status_code == 404
        assert other.post("/api/dict", json={"ids": [cw["id"]], "status": "learned"}).status_code == 400
        assert other.post("/api/progress/reviews", json={"reviews": [{"id": cw["id"], "correct": True}]}).status_code == 400
    assert user_client.get("/api/progress").json()["custom"][0]["it"] == "segreto"


def test_dictionary_requires_auth_and_csrf(client):
    with make_client() as anon:
        anon.cookies.clear()
        assert anon.post("/api/dict", json={"ids": [WORDS[0]], "status": "learning"}).status_code == 401
    with make_client() as c:
        c.headers.pop("X-Requested-With")
        assert c.post("/api/custom-words", json={"it": "a", "ru": "b"}).status_code == 403


def test_old_favorites_become_learning(user_client):
    a = WORDS[9]
    user_client.post("/api/progress/favorite", json={"id": a, "favorite": True})
    init_db()  # миграция при старте сервера переносит «избранное» в «Изучаю»
    with SessionLocal() as db:
        row = db.query(WordProgress).filter(WordProgress.word_id == a, WordProgress.favorite.is_(False)).first()
        assert row is not None and row.dict_status == "learning"
