from tests.conftest import GOOD_PASSWORD, make_client


def test_register_login_logout_flow():
    with make_client() as c:
        r = c.post("/api/auth/register", json={"username": "Sofia", "password": GOOD_PASSWORD, "avatar": "🦄"})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["username"] == "sofia"
        assert r.json()["user"]["avatar"] == "🦄"
        assert c.get("/api/auth/me").json()["display_name"] == "sofia"

        assert c.post("/api/auth/logout").status_code == 200
        assert c.get("/api/auth/me").status_code == 401

        assert c.post("/api/auth/login", json={"username": "sofia", "password": "nope-nope"}).status_code == 401
        assert c.post("/api/auth/login", json={"username": "SOFIA", "password": GOOD_PASSWORD}).status_code == 200
        assert c.get("/api/auth/me").status_code == 200

    with make_client() as other:
        r = other.post("/api/auth/register", json={"username": "sofia", "password": GOOD_PASSWORD})
        assert r.status_code == 409


def test_progress_requires_auth(client):
    client.cookies.clear()
    assert client.get("/api/progress").status_code == 401


def test_lesson_progress_and_results(user_client):
    c = user_client
    assert c.post("/api/progress/lesson", json={"key": "0.alfabeto", "theory_read": True}).status_code == 200
    assert c.post("/api/progress/lesson", json={"key": "0.nope"}).status_code == 400

    r = c.post("/api/progress/result", json={"kind": "lesson", "scope": "0.alfabeto", "title": "Алфавит",
                                             "level": 1, "score": 6, "total": 10})
    assert r.json() == {"percent": 60, "passed": False, "lesson_completed": False}
    r = c.post("/api/progress/result", json={"kind": "lesson", "scope": "0.alfabeto", "level": 1, "score": 9,
                                             "total": 10, "words": [{"id": "0.alfabeto.0", "correct": True}]})
    assert r.json()["lesson_completed"] is True

    p = c.get("/api/progress").json()
    assert p["lessons"]["0.alfabeto"] == {"theory_read": True, "best_score": 90, "completed": True}
    assert p["words"]["0.alfabeto.0"]["box"] == 1
    assert len(p["results"]) == 2
    assert sum(p["activity"].values()) > 0


def test_result_validation(user_client):
    c = user_client
    bad = [
        {"kind": "lesson", "scope": "0.alfabeto", "score": 11, "total": 10},
        {"kind": "hack", "scope": "x", "score": 1, "total": 1},
        {"kind": "final", "scope": "x", "score": 1, "total": 1, "words": [{"id": "nope", "correct": True}]},
        {"kind": "final", "scope": "x", "score": 1, "total": 0},
    ]
    for body in bad:
        assert c.post("/api/progress/result", json=body).status_code in (400, 422), body


def test_reviews_and_favorites(user_client):
    c = user_client
    for _ in range(3):
        c.post("/api/progress/reviews", json={"reviews": [{"id": "1.presente-regolare.0", "correct": True}]})
    c.post("/api/progress/favorite", json={"id": "1.presente-regolare.0", "favorite": True})
    w = c.get("/api/progress").json()["words"]["1.presente-regolare.0"]
    assert w["box"] == 3 and w["favorite"] is True and w["correct"] == 3
    assert c.post("/api/progress/favorite", json={"id": "x.y.z", "favorite": True}).status_code == 400


def test_profile_and_password_change(user_client):
    c = user_client
    assert c.patch("/api/auth/me", json={"display_name": "Маша", "avatar": "🦋"}).json()["avatar"] == "🦋"
    assert c.patch("/api/auth/me", json={"avatar": "<script>"}).json()["avatar"] == "🦋"  # недопустимый аватар игнорируется

    r = c.post("/api/auth/password", json={"current_password": "wrong", "new_password": "Nuovo-Cielo-Blu-77"})
    assert r.status_code == 400
    r = c.post("/api/auth/password", json={"current_password": GOOD_PASSWORD, "new_password": "password123"})
    assert r.status_code == 422
    r = c.post("/api/auth/password", json={"current_password": GOOD_PASSWORD, "new_password": "Nuovo-Cielo-Blu-77"})
    assert r.status_code == 200
    assert c.get("/api/auth/me").status_code == 200  # текущая сессия продолжается


def test_delete_account(user_client):
    c = user_client
    c.post("/api/progress/reviews", json={"reviews": [{"id": "0.alfabeto.1", "correct": True}]})
    assert c.post("/api/auth/delete", json={"password": "wrong"}).status_code == 400
    assert c.post("/api/auth/delete", json={"password": GOOD_PASSWORD}).status_code == 200
    assert c.get("/api/auth/me").status_code == 401
    assert c.post("/api/auth/login", json={"username": c.username, "password": GOOD_PASSWORD}).status_code == 401


def test_health_and_spa(client):
    assert client.get("/api/health").json()["ok"] is True
    assert client.get("/api/nope").status_code == 404
