"""HTTP API платформы Bella Italia.

Учебный контент отдаётся фронтенду статическим файлом data/course.json, вопросы
генерируются и проверяются в браузере. Сервер отвечает за аккаунты и хранение
прогресса: уроки, интервальное повторение слов, результаты тестов, активность.
"""

from __future__ import annotations

import re
from contextlib import asynccontextmanager
from datetime import date, timedelta
from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware

from . import passwords
from .config import settings
from .content import get_library
from .db import Activity, LessonProgress, TestResult, User, WordProgress, aware, get_session, init_db, utcnow
from .security import (
    LOGIN_IP_LIMIT,
    LOGIN_USER_LIMIT,
    REGISTER_IP_LIMIT,
    SESSION_COOKIE,
    burn_time,
    check_limit,
    client_ip,
    csrf_guard,
    current_user,
    end_all_sessions,
    end_session,
    hash_password,
    limiter,
    needs_rehash,
    start_session,
    verify_password,
)

PASS_PERCENT = 70
BOX_DAYS = [0, 1, 2, 4, 8, 16]
LEARNED_BOX = 3
AVATARS = ["👸", "🧚", "🦄", "🐦", "🌸", "🦋", "🌷", "🐰", "🦢", "🍓"]
USERNAME_RE = re.compile(r"^[a-z0-9._-]{3,40}$")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    get_library()  # проверяем контент при старте
    yield


app = FastAPI(
    title="Bella Italia API",
    lifespan=lifespan,
    dependencies=[Depends(csrf_guard)],
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)


# ---------- заголовки безопасности и кэширование ----------

CSP = (
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; "
    "font-src 'self'; script-src 'self'; connect-src 'self'; media-src 'self' blob:; "
    "manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; "
    "form-action 'self'; object-src 'none'"
)


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "same-origin")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
        h.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if settings.https:
            h.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        if path.startswith("/api/docs"):
            return response  # Swagger UI грузит скрипты с CDN
        h.setdefault("Content-Security-Policy", CSP)
        if path.startswith("/api/"):
            h["Cache-Control"] = "no-store"
        elif path.startswith("/assets/") or path.startswith("/img/"):
            h["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            h["Cache-Control"] = "no-cache"
        return response


app.add_middleware(SecurityHeaders)


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers)


# ---------- схемы ----------


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=1, max_length=passwords.MAX_LENGTH)
    display_name: str = Field(default="", max_length=60)
    avatar: str = Field(default="👸", max_length=16)

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        v = v.strip().lower()
        if not USERNAME_RE.fullmatch(v):
            raise ValueError("Логин: 3–40 символов — латинские буквы, цифры, точка, дефис, подчёркивание")
        return v


class LoginIn(BaseModel):
    username: str = Field(max_length=40)
    password: str = Field(max_length=passwords.MAX_LENGTH)


class ProfileIn(BaseModel):
    display_name: str | None = Field(default=None, max_length=60)
    avatar: str | None = Field(default=None, max_length=16)


class PasswordChangeIn(BaseModel):
    current_password: str = Field(max_length=passwords.MAX_LENGTH)
    new_password: str = Field(max_length=passwords.MAX_LENGTH)


class DeleteAccountIn(BaseModel):
    password: str = Field(max_length=passwords.MAX_LENGTH)


class PasswordCheckIn(BaseModel):
    password: str = Field(max_length=passwords.MAX_LENGTH)
    username: str = Field(default="", max_length=40)


class LessonIn(BaseModel):
    key: str = Field(max_length=80)
    theory_read: bool | None = None


class WordAnswer(BaseModel):
    id: str = Field(max_length=80)
    correct: bool


class ReviewsIn(BaseModel):
    reviews: list[WordAnswer] = Field(max_length=200)


class FavoriteIn(BaseModel):
    id: str = Field(max_length=80)
    favorite: bool


class ResultIn(BaseModel):
    kind: str = Field(pattern="^(lesson|unit|final|words|verbs|progress|game)$")
    scope: str = Field(max_length=120)
    title: str = Field(default="", max_length=160)
    level: int = Field(default=1, ge=0, le=3)
    score: int = Field(ge=0, le=500)
    total: int = Field(ge=1, le=500)
    words: list[WordAnswer] = Field(default_factory=list, max_length=200)

    @model_validator(mode="after")
    def _score(self):
        if self.score > self.total:
            raise ValueError("score больше total")
        return self


# ---------- вспомогательное ----------


def user_out(user: User) -> dict:
    return {"id": user.id, "username": user.username, "display_name": user.display_name, "avatar": user.avatar}


def _lesson_row(db: Session, user: User, key: str) -> LessonProgress:
    row = db.scalar(select(LessonProgress).where(LessonProgress.user_id == user.id, LessonProgress.lesson_key == key))
    if row is None:
        row = LessonProgress(user_id=user.id, lesson_key=key, theory_read=False, best_score=0, completed=False)
        db.add(row)
    return row


def _word_row(db: Session, user: User, word_id: str) -> WordProgress:
    row = db.scalar(select(WordProgress).where(WordProgress.user_id == user.id, WordProgress.word_id == word_id))
    if row is None:
        row = WordProgress(user_id=user.id, word_id=word_id, box=0, favorite=False, correct=0, wrong=0, due_at=utcnow())
        db.add(row)
    return row


def _review(row: WordProgress, known: bool) -> None:
    if known:
        row.correct += 1
        row.box = min(row.box + 1, len(BOX_DAYS) - 1)
    else:
        row.wrong += 1
        row.box = 0
    row.due_at = utcnow() + timedelta(days=BOX_DAYS[row.box])


def _activity(db: Session, user: User, points: int) -> None:
    today = date.today().isoformat()
    row = db.scalar(select(Activity).where(Activity.user_id == user.id, Activity.day == today))
    if row is None:
        row = Activity(user_id=user.id, day=today, points=0)
        db.add(row)
    row.points += max(0, points)


def _known_word(word_id: str) -> None:
    if word_id not in get_library().words:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Неизвестное слово {word_id}")


def _check_password_policy(password: str, username: str) -> None:
    errors = passwords.problems(password, username)
    if errors:
        raise HTTPException(422, errors[0])


# ---------- служебное ----------


@app.get("/api/health")
def health():
    return {"ok": True, "registration": settings.allow_registration}


# ---------- авторизация ----------


@app.post("/api/auth/register")
def register(data: RegisterIn, request: Request, response: Response, db: Session = Depends(get_session)):
    if not settings.allow_registration:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Регистрация новых пользователей отключена")
    ip_key = f"reg:{client_ip(request)}"
    check_limit(ip_key, REGISTER_IP_LIMIT)
    _check_password_policy(data.password, data.username)
    limiter.hit(ip_key)
    if db.scalar(select(User).where(User.username == data.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Такой логин уже занят")
    user = User(
        username=data.username,
        display_name=data.display_name.strip() or data.username,
        avatar=data.avatar if data.avatar in AVATARS else "👸",
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    start_session(db, user, request, response)
    return {"user": user_out(user)}


@app.post("/api/auth/login")
def login(data: LoginIn, request: Request, response: Response, db: Session = Depends(get_session)):
    username = data.username.strip().lower()
    ip_key, user_key = f"login-ip:{client_ip(request)}", f"login-user:{username}"
    check_limit(ip_key, LOGIN_IP_LIMIT)
    check_limit(user_key, LOGIN_USER_LIMIT)
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        burn_time(data.password)
    if user is None or not verify_password(data.password, user.password_hash):
        limiter.hit(ip_key)
        limiter.hit(user_key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный логин или пароль")
    limiter.reset(user_key)
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(data.password)
        db.commit()
    start_session(db, user, request, response)
    return {"user": user_out(user)}


@app.post("/api/auth/logout")
def logout(response: Response, bi_session: str | None = Cookie(default=None), db: Session = Depends(get_session)):
    end_session(db, bi_session, response)
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: User = Depends(current_user)):
    return user_out(user)


@app.patch("/api/auth/me")
def update_me(data: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    if data.display_name is not None and data.display_name.strip():
        user.display_name = data.display_name.strip()
    if data.avatar is not None and data.avatar in AVATARS:
        user.avatar = data.avatar
    db.add(user)
    db.commit()
    return user_out(user)


@app.post("/api/auth/password")
def change_password(data: PasswordChangeIn, request: Request, response: Response,
                    user: User = Depends(current_user), db: Session = Depends(get_session)):
    key = f"pwd:{user.id}"
    check_limit(key, LOGIN_USER_LIMIT)
    if not verify_password(data.current_password, user.password_hash):
        limiter.hit(key)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Текущий пароль указан неверно")
    _check_password_policy(data.new_password, user.username)
    user.password_hash = hash_password(data.new_password)
    db.commit()
    end_all_sessions(db, user)  # выходим на всех устройствах и открываем новую сессию здесь
    start_session(db, user, request, response)
    return {"ok": True}


@app.post("/api/auth/delete")
def delete_account(data: DeleteAccountIn, response: Response, user: User = Depends(current_user),
                   db: Session = Depends(get_session)):
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Пароль указан неверно")
    db.delete(user)
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/api")
    return {"ok": True}


@app.post("/api/auth/check-password")
def check_password(data: PasswordCheckIn):
    """Подсказка при вводе пароля (ничего не сохраняет)."""
    return {"problems": passwords.problems(data.password, data.username), "strength": passwords.strength(data.password)}


@app.get("/api/avatars")
def avatars():
    return AVATARS


# ---------- прогресс ----------


@app.get("/api/progress")
def progress(user: User = Depends(current_user), db: Session = Depends(get_session)):
    lessons = db.scalars(select(LessonProgress).where(LessonProgress.user_id == user.id))
    words = db.scalars(select(WordProgress).where(WordProgress.user_id == user.id))
    results = db.scalars(
        select(TestResult).where(TestResult.user_id == user.id).order_by(TestResult.created_at.desc()).limit(200)
    )
    activity = db.scalars(select(Activity).where(Activity.user_id == user.id))
    return {
        "lessons": {r.lesson_key: {"theory_read": r.theory_read, "best_score": r.best_score, "completed": r.completed}
                    for r in lessons},
        "words": {r.word_id: {"box": r.box, "favorite": r.favorite, "correct": r.correct, "wrong": r.wrong,
                              "due_at": aware(r.due_at).isoformat()} for r in words},
        "results": [{"id": r.id, "kind": r.kind, "scope": r.scope, "title": r.title, "level": r.level,
                     "score": r.score, "total": r.total, "created_at": aware(r.created_at).isoformat()}
                    for r in results],
        "activity": {a.day: a.points for a in activity},
    }


@app.post("/api/progress/lesson")
def lesson_progress(data: LessonIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    if data.key not in get_library().lesson_keys:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Неизвестный урок")
    row = _lesson_row(db, user, data.key)
    if data.theory_read and not row.theory_read:
        row.theory_read = True
        _activity(db, user, 5)
    db.commit()
    return {"ok": True}


@app.post("/api/progress/reviews")
def word_reviews(data: ReviewsIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    for r in data.reviews:
        _known_word(r.id)
    for r in data.reviews:
        _review(_word_row(db, user, r.id), r.correct)
    _activity(db, user, len(data.reviews))
    db.commit()
    return {"ok": True}


@app.post("/api/progress/favorite")
def favorite(data: FavoriteIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    _known_word(data.id)
    _word_row(db, user, data.id).favorite = data.favorite
    db.commit()
    return {"ok": True}


@app.post("/api/progress/result")
def save_result(data: ResultIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    for w in data.words:
        _known_word(w.id)
    percent = round(data.score * 100 / data.total)
    completed = False
    if data.kind == "lesson":
        if data.scope not in get_library().lesson_keys:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Неизвестный урок")
        row = _lesson_row(db, user, data.scope)
        row.best_score = max(row.best_score or 0, percent)
        if percent >= PASS_PERCENT:
            row.completed = completed = True
    for w in data.words:
        _review(_word_row(db, user, w.id), w.correct)
    db.add(TestResult(user_id=user.id, kind=data.kind, scope=data.scope, title=data.title or data.scope,
                      level=data.level, score=data.score, total=data.total))
    _activity(db, user, 10 + data.score)
    db.commit()
    return {"percent": percent, "passed": percent >= PASS_PERCENT, "lesson_completed": completed}


# ---------- фронтенд ----------

dist = settings.frontend_dist


@app.get("/{path:path}", include_in_schema=False)
def spa(path: str):
    if path.startswith("api/") or path == "api":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Не найдено")
    if not dist.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Фронтенд не собран: выполните npm run build в папке frontend")
    root = dist.resolve()
    file = (root / path).resolve()
    if path and file.is_file() and root in file.parents:
        return FileResponse(file)
    if Path(path).suffix:  # отсутствующий файл, а не маршрут приложения
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Не найдено")
    return FileResponse(root / "index.html")
