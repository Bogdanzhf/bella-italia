"""Проверки безопасности: пароли, сессии, перебор, CSRF, изоляция данных, заголовки."""

import hashlib

import pytest
from sqlalchemy import select

from app import passwords
from app.db import SessionLocal, User, UserSession
from app.security import hash_password, needs_rehash, verify_password
from tests.conftest import GOOD_PASSWORD, make_client


# ---------- политика паролей ----------

@pytest.mark.parametrize("pwd", [
    "test1234", "password", "Password1!", "qwerty123", "12345678", "princess2024", "Amore123!", "11111111",
    "iloveyou", "Ciao1234", "abcdefgh", "qwertyui", "P@ssw0rd", "short",
])
def test_weak_passwords_rejected(pwd):
    assert passwords.problems(pwd), pwd


@pytest.mark.parametrize("pwd", ["Gelato-Nuvola-Stella-42", "rondine azzurra sul balcone", "Xk7#pQ2!mZ9w", "Fragola&Luna2026verde"])
def test_strong_passwords_accepted(pwd):
    assert passwords.problems(pwd) == []
    assert passwords.strength(pwd) >= 2


def test_password_must_not_contain_username():
    assert passwords.problems("alice-rose-garden-9", "alice")


def test_register_rejects_leaked_password():
    with make_client() as c:
        r = c.post("/api/auth/register", json={"username": "weakuser", "password": "test1234"})
        assert r.status_code == 422
        assert "утеч" in r.json()["detail"] or "распространён" in r.json()["detail"]


# ---------- хэширование ----------

def test_scrypt_hash_and_legacy_upgrade():
    h = hash_password("Segreto-Lungo-123")
    assert h.startswith("scrypt$") and "Segreto" not in h
    assert verify_password("Segreto-Lungo-123", h)
    assert not verify_password("segreto-lungo-123", h)
    assert hash_password("x") != hash_password("x")  # соль
    legacy_salt = "00" * 16
    legacy = f"pbkdf2$1000${legacy_salt}$" + hashlib.pbkdf2_hmac("sha256", b"old", bytes.fromhex(legacy_salt), 1000).hex()
    assert verify_password("old", legacy) and needs_rehash(legacy)
    assert not verify_password("x", "garbage")


def test_legacy_hash_is_upgraded_on_login():
    salt = "11" * 16
    legacy = f"pbkdf2$1000${salt}$" + hashlib.pbkdf2_hmac("sha256", GOOD_PASSWORD.encode(), bytes.fromhex(salt), 1000).hex()
    with SessionLocal() as db:
        db.add(User(username="legacyuser", display_name="L", password_hash=legacy))
        db.commit()
    with make_client() as c:
        assert c.post("/api/auth/login", json={"username": "legacyuser", "password": GOOD_PASSWORD}).status_code == 200
    with SessionLocal() as db:
        assert db.scalar(select(User).where(User.username == "legacyuser")).password_hash.startswith("scrypt$")


# ---------- сессии и cookie ----------

def test_session_cookie_flags_and_hashed_storage():
    with make_client() as c:
        r = c.post("/api/auth/register", json={"username": "cookieuser", "password": GOOD_PASSWORD})
        cookie = r.headers["set-cookie"]
        assert "HttpOnly" in cookie and "SameSite=strict" in cookie and "Path=/api" in cookie
        token = c.cookies.get("bi_session")
        assert token and len(token) >= 40
        assert "token" not in r.text  # токен не отдаётся в теле ответа (недоступен JavaScript)
    with SessionLocal() as db:
        stored = [s.token_hash for s in db.scalars(select(UserSession))]
        assert token not in stored
        assert hashlib.sha256(token.encode()).hexdigest() in stored


def test_forged_and_expired_sessions_rejected():
    with make_client() as c:
        c.cookies.set("bi_session", "x" * 43, domain="testserver.local", path="/api")
        assert c.get("/api/auth/me").status_code == 401
        c.cookies.set("bi_session", "y" * 5000)
        assert c.get("/api/auth/me").status_code == 401


def test_password_change_logs_out_other_devices():
    with make_client() as a, make_client() as b:
        a.post("/api/auth/register", json={"username": "multidev", "password": GOOD_PASSWORD})
        b.post("/api/auth/login", json={"username": "multidev", "password": GOOD_PASSWORD})
        assert b.get("/api/auth/me").status_code == 200
        a.post("/api/auth/password", json={"current_password": GOOD_PASSWORD, "new_password": "Tramonto-Rosa-Mare-31"})
        assert b.get("/api/auth/me").status_code == 401
        assert a.get("/api/auth/me").status_code == 200


# ---------- перебор паролей ----------

def test_login_bruteforce_is_throttled():
    with make_client() as c:
        c.post("/api/auth/register", json={"username": "target", "password": GOOD_PASSWORD})
        codes = [c.post("/api/auth/login", json={"username": "target", "password": f"wrong{i}"}).status_code for i in range(7)]
        assert codes[:5] == [401] * 5
        assert codes[5] == 429
        # даже верный пароль не пускает, пока действует блокировка
        assert c.post("/api/auth/login", json={"username": "target", "password": GOOD_PASSWORD}).status_code == 429


def test_unknown_and_known_user_get_same_error():
    with make_client() as c:
        c.post("/api/auth/register", json={"username": "known", "password": GOOD_PASSWORD})
        a = c.post("/api/auth/login", json={"username": "known", "password": "bad-password"}).json()
        b = c.post("/api/auth/login", json={"username": "ghost-user", "password": "bad-password"}).json()
        assert a == b


# ---------- CSRF ----------

def test_csrf_header_required_for_mutations():
    with make_client() as c:
        c.post("/api/auth/register", json={"username": "csrfuser", "password": GOOD_PASSWORD})
        del c.headers["X-Requested-With"]
        assert c.post("/api/progress/lesson", json={"key": "0.alfabeto", "theory_read": True}).status_code == 403
        assert c.post("/api/auth/logout").status_code == 403
        assert c.get("/api/progress").status_code == 200  # чтение без заголовка разрешено


def test_foreign_origin_rejected(user_client):
    r = user_client.post("/api/progress/lesson", json={"key": "0.alfabeto"}, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    r = user_client.post("/api/progress/lesson", json={"key": "0.alfabeto"}, headers={"Origin": "http://testserver"})
    assert r.status_code == 200


# ---------- изоляция данных ----------

def test_users_cannot_see_each_others_progress():
    with make_client() as a, make_client() as b:
        a.post("/api/auth/register", json={"username": "alice", "password": GOOD_PASSWORD})
        b.post("/api/auth/register", json={"username": "bobby", "password": GOOD_PASSWORD})
        a.post("/api/progress/reviews", json={"reviews": [{"id": "0.alfabeto.3", "correct": True}]})
        a.post("/api/progress/result", json={"kind": "final", "scope": "0", "score": 5, "total": 5})
        pb = b.get("/api/progress").json()
        assert pb["words"] == {} and pb["results"] == []


# ---------- ввод ----------

@pytest.mark.parametrize("username", ["a' OR 1=1 --", "<script>", "ab", "x" * 41, "имя"])
def test_invalid_usernames_rejected(username):
    with make_client() as c:
        assert c.post("/api/auth/register", json={"username": username, "password": GOOD_PASSWORD}).status_code == 422


def test_sql_injection_in_login_is_harmless():
    with make_client() as c:
        r = c.post("/api/auth/login", json={"username": "' OR '1'='1", "password": "' OR '1'='1"})
        assert r.status_code == 401


def test_oversized_payloads_rejected(user_client):
    r = user_client.post("/api/progress/reviews", json={"reviews": [{"id": "0.alfabeto.0", "correct": True}] * 500})
    assert r.status_code == 422
    r = user_client.patch("/api/auth/me", json={"display_name": "x" * 500})
    assert r.status_code == 422


# ---------- заголовки ----------

def test_security_headers(client):
    r = client.get("/api/health")
    h = r.headers
    assert h["x-content-type-options"] == "nosniff"
    assert h["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in h["content-security-policy"]
    assert "script-src 'self'" in h["content-security-policy"]
    assert h["cache-control"] == "no-store"
    assert h["referrer-policy"] == "same-origin"


def test_path_traversal_blocked(client):
    for path in ["/../pyproject.toml", "/..%2F..%2Fpyproject.toml", "/%2e%2e/%2e%2e/backend/app/main.py"]:
        r = client.get(path)
        assert "poetry" not in r.text and "FastAPI" not in r.text, path
