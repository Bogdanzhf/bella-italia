"""Загрузка, проверка и экспорт учебного контента.

Источник — YAML-файлы в backend/content/ (формат описан в backend/content/README.md).
Контент проверяется целиком при загрузке: ошибка в любом файле — понятное сообщение
с указанием юнита, урока и упражнения. Для фронтенда весь курс выгружается в один
JSON (см. export_course): проверка ответов выполняется в браузере, поэтому платформа
работает и с сервером, и как статический сайт.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

from .transcription import clean, stress_lexicon, transcribe

CONTENT_ROOT = Path(__file__).resolve().parent.parent / "content"
CONTENT_DIR = CONTENT_ROOT / "units"

EXERCISE_TYPES = {"choice", "input", "match", "order", "odd", "tf", "dialog", "cloze", "error"}
LEVEL_NAMES = {1: "Лёгкий", 2: "Средний", 3: "Сложный"}
PERSONS = ["io", "tu", "lui / lei", "noi", "voi", "loro"]
LESSON_KINDS = {"lesson", "grammar", "dialogue", "culture", "review"}

# [[ответ]] / [[ответ|вариант]] — ввод; [[а/*б/в]] — выбор, * отмечает правильный
CLOZE_GAP = re.compile(r"\[\[(.+?)\]\]")
# {{неверно=>верно}} — ошибка в предложении
ERROR_MARK = re.compile(r"\{\{(.+?)=>(.+?)\}\}")


class ContentError(ValueError):
    pass


@dataclass
class Word:
    id: str
    it: str
    ru: str
    ipa: str
    cyr: str
    unit_id: int
    lesson_slug: str
    gender: str = ""
    note: str = ""
    img: str = ""


@dataclass
class Phrase:
    it: str
    ru: str
    ipa: str
    cyr: str
    img: str = ""


@dataclass
class DialogueLine:
    speaker: str
    it: str
    ru: str


@dataclass
class Dialogue:
    title: str
    scene: str
    lines: list[DialogueLine]


@dataclass
class Reading:
    title: str
    text: str
    ru: str
    glossary: list[list[str]]
    photo: str = ""


@dataclass
class Exercise:
    id: str
    type: str
    level: int
    q: str
    unit_id: int
    lesson_slug: str
    options: list[str] = field(default_factory=list)
    answer: object = None
    pairs: list[list[str]] = field(default_factory=list)
    items: list[list] = field(default_factory=list)  # tf: [[утверждение, True/False]]
    lines: list[str] = field(default_factory=list)  # dialog: реплики в правильном порядке
    text: str = ""  # cloze / error
    gaps: list[dict] = field(default_factory=list)  # cloze: [{"answers": [...], "options": [...]}]
    audio: str = ""  # текст для озвучки (аудирование)
    img: str = ""
    ref: str = ""  # dialogue / reading — показать текст урока рядом с вопросом
    explain: str = ""


@dataclass
class Lesson:
    unit_id: int
    slug: str
    title_it: str
    title_ru: str
    theory: str
    kind: str
    words: list[Word]
    phrases: list[Phrase]
    exercises: list[Exercise]
    dialogue: Dialogue | None = None
    reading: Reading | None = None
    photos: list[str] = field(default_factory=list)

    @property
    def key(self) -> str:
        return f"{self.unit_id}.{self.slug}"


@dataclass
class Verb:
    id: str
    inf: str
    ru: str
    tense: str
    forms: list[list[str]]
    unit_id: int


@dataclass
class Unit:
    id: int
    title_it: str
    title_ru: str
    level: str
    icon: str
    description: str
    goals: list[str]
    lessons: list[Lesson]
    verbs: list[Verb]


@dataclass
class TestSection:
    title: str
    intro: str
    reading: Reading | None
    audio: str
    exercises: list[Exercise]


@dataclass
class ProgressTest:
    id: str
    title: str
    units: list[int]
    description: str
    sections: list[TestSection]
    writing: list[dict]


@dataclass
class Library:
    units: list[Unit]
    words: dict[str, Word]
    exercises: dict[str, Exercise]
    verbs: dict[str, Verb]
    tests: list[ProgressTest] = field(default_factory=list)
    images: dict[str, dict] = field(default_factory=dict)

    def unit(self, unit_id: int) -> Unit | None:
        return next((u for u in self.units if u.id == unit_id), None)

    def lesson(self, unit_id: int, slug: str) -> Lesson | None:
        unit = self.unit(unit_id)
        if unit is None:
            return None
        return next((les for les in unit.lessons if les.slug == slug), None)

    @property
    def lesson_keys(self) -> set[str]:
        return {les.key for u in self.units for les in u.lessons}


# ---------- разбор ----------


def _split_entry(raw: str, where: str) -> list[str]:
    parts = [p.strip() for p in str(raw).split("|")]
    if len(parts) < 2 or not parts[0] or not parts[1]:
        raise ContentError(f"{where}: ожидается «итальянский | русский», получено {raw!r}")
    return parts


def _bare(it: str) -> str:
    """Слово без артикля — ключ для поиска картинки."""
    low = clean(it).lower().strip()
    low = re.sub(r"^(il|lo|la|i|gli|le|un|uno|una)\s+", "", low)
    low = re.sub(r"^(l'|un')", "", low)
    return low.strip(" !?.")


class _Ctx:
    def __init__(self, lexicon: dict[str, str], images: dict[str, dict], word_images: dict[str, str],
                 phrase_images: dict[str, str] | None = None):
        self.lexicon = lexicon
        self.images = images
        self.word_images = word_images
        self.phrase_images = phrase_images or {}

    def check_img(self, key: str, where: str) -> str:
        if key and key not in self.images:
            raise ContentError(f"{where}: неизвестная картинка {key!r} (добавьте её в images.yaml)")
        return key

    def img_for(self, it: str, explicit: str = "") -> str:
        if explicit:
            return explicit if explicit in self.images else ""
        key = self.word_images.get(_bare(it)) or self.word_images.get(clean(it).lower().strip(" !?."))
        return key if key in self.images else ""

    def phrase_img(self, it: str) -> str:
        key = self.phrase_images.get(phrase_key(clean(it)), "")
        return key if key in self.images else ""


def phrase_key(text: str) -> str:
    """Ключ фразы в images.yaml: нижний регистр, без пробелов и знаков в конце."""
    return re.sub(r"[\s!?.…]+$", "", text.strip().lower())


def _parse_word(raw: str, unit_id: int, slug: str, idx: int, ctx: _Ctx) -> Word:
    parts = _split_entry(raw, f"юнит {unit_id}, урок {slug}, слово {idx}")
    it_marked, ru = parts[0], parts[1]
    extra = parts[2] if len(parts) > 2 else ""
    gender, note = "", ""
    for chunk in (c.strip() for c in extra.split(";") if c.strip()):
        if chunk in ("m", "f"):
            gender = chunk
        else:
            note = chunk
    ipa, cyr = transcribe(it_marked, ctx.lexicon)
    return Word(
        id=f"{unit_id}.{slug}.{idx}", it=clean(it_marked), ru=ru, ipa=ipa, cyr=cyr,
        unit_id=unit_id, lesson_slug=slug, gender=gender, note=note, img=ctx.img_for(it_marked),
    )


def _parse_phrase(raw: str, where: str, ctx: _Ctx) -> Phrase:
    parts = _split_entry(raw, where)
    it_marked, ru = parts[0], parts[1]
    explicit = parts[2] if len(parts) > 2 else ""
    if explicit:
        ctx.check_img(explicit, where)
    ipa, cyr = transcribe(it_marked, ctx.lexicon)
    return Phrase(it=clean(it_marked), ru=ru, ipa=ipa, cyr=cyr, img=explicit or ctx.phrase_img(it_marked))


def _parse_dialogue(raw: dict | None, where: str) -> Dialogue | None:
    if not raw:
        return None
    lines = []
    for i, line in enumerate(raw.get("lines", [])):
        m = re.match(r"^\s*([^:|]+?)\s*:\s*(.+?)\s*\|\s*(.+?)\s*$", str(line))
        if not m:
            raise ContentError(f"{where}: реплика {i + 1} — ожидается «Имя: итальянский | русский»")
        lines.append(DialogueLine(speaker=m.group(1), it=clean(m.group(2)), ru=m.group(3)))
    if len(lines) < 2:
        raise ContentError(f"{where}: в диалоге нужно минимум две реплики")
    return Dialogue(title=str(raw.get("title", "")), scene=str(raw.get("scene", "")).strip(), lines=lines)


def _parse_reading(raw: dict | None, where: str, ctx: _Ctx) -> Reading | None:
    if not raw:
        return None
    text = str(raw.get("text", "")).strip()
    if not text:
        raise ContentError(f"{where}: пустой текст для чтения")
    glossary = [_split_entry(g, f"{where}, глоссарий")[:2] for g in raw.get("glossary", [])]
    photo = ctx.check_img(str(raw.get("photo", "")), where)
    return Reading(title=str(raw.get("title", "")), text=clean(text), ru=str(raw.get("ru", "")).strip(),
                   glossary=glossary, photo=photo)


def _parse_cloze(text: str, where: str) -> tuple[str, list[dict]]:
    gaps = []
    for m in CLOZE_GAP.finditer(text):
        body = m.group(1)
        if "/" in body and "*" in body:
            opts = [o.strip() for o in body.split("/")]
            correct = [o[1:].strip() for o in opts if o.startswith("*")]
            if len(correct) != 1:
                raise ContentError(f"{where}: в пропуске {body!r} должен быть ровно один вариант со *")
            gaps.append({"answers": correct, "options": [o.lstrip("*").strip() for o in opts]})
        else:
            gaps.append({"answers": [a.strip() for a in body.split("|") if a.strip()], "options": []})
    if not gaps:
        raise ContentError(f"{where}: в тексте нет пропусков [[...]]")
    return text, gaps


def _parse_exercise(raw: dict, unit_id: int, slug: str, idx: int, ctx: _Ctx, id_prefix: str = "") -> Exercise:
    where = f"юнит {unit_id}, урок {slug}, упражнение {idx + 1}"
    etype = raw.get("type")
    if etype not in EXERCISE_TYPES:
        raise ContentError(f"{where}: неизвестный тип {etype!r}")
    level = int(raw.get("level", 1))
    if level not in LEVEL_NAMES:
        raise ContentError(f"{where}: уровень должен быть 1–3")
    audio = raw.get("audio", "")
    ex = Exercise(
        id=id_prefix or f"{unit_id}.{slug}.{idx}",
        type=etype,
        level=level,
        q=str(raw.get("q", "")).strip(),
        unit_id=unit_id,
        lesson_slug=slug,
        explain=str(raw.get("explain", "")).strip(),
        audio=clean(str(audio)) if audio else "",
        img=ctx.check_img(str(raw.get("img", "")), where),
        ref=str(raw.get("ref", "")),
    )
    if not ex.q:
        raise ContentError(f"{where}: пустой вопрос")
    if ex.ref not in ("", "dialogue", "reading"):
        raise ContentError(f"{where}: ref может быть dialogue или reading")

    if etype in ("choice", "odd"):
        ex.options = [str(o) for o in raw.get("options", [])]
        ans = raw.get("answer")
        if len(ex.options) < 2 or not isinstance(ans, int) or not 0 <= ans < len(ex.options):
            raise ContentError(f"{where}: некорректные варианты или индекс ответа")
        if len(set(ex.options)) != len(ex.options):
            raise ContentError(f"{where}: повторяющиеся варианты ответа")
        ex.answer = ans
    elif etype == "input":
        ans = raw.get("answer")
        if isinstance(ans, str):
            ans = [ans]
        if not ans:
            raise ContentError(f"{where}: нет правильного ответа")
        ex.answer = [str(a) for a in ans]
    elif etype == "order":
        ans = str(raw.get("answer", "")).strip()
        if len(ans.split()) < 2:
            raise ContentError(f"{where}: в задании на порядок слов нужно минимум два слова")
        ex.answer = ans
    elif etype == "match":
        pairs = raw.get("pairs") or []
        if len(pairs) < 2 or any(len(p) != 2 for p in pairs):
            raise ContentError(f"{where}: нужны пары [слева, справа]")
        ex.pairs = [[str(a), str(b)] for a, b in pairs]
        if len({p[1] for p in ex.pairs}) != len(ex.pairs) or len({p[0] for p in ex.pairs}) != len(ex.pairs):
            raise ContentError(f"{where}: элементы пар должны различаться")
    elif etype == "tf":
        items = raw.get("items") or []
        if not items or any(len(i) != 2 or not isinstance(i[1], bool) for i in items):
            raise ContentError(f"{where}: нужны утверждения [текст, true/false]")
        ex.items = [[str(t), bool(v)] for t, v in items]
    elif etype == "dialog":
        lines = [str(x).strip() for x in raw.get("lines") or []]
        if len(lines) < 3 or len(set(lines)) != len(lines):
            raise ContentError(f"{where}: нужно минимум 3 разные реплики")
        ex.lines = lines
    elif etype == "cloze":
        ex.text, ex.gaps = _parse_cloze(str(raw.get("text", "")).strip(), where)
    elif etype == "error":
        text = str(raw.get("text", "")).strip()
        marks = ERROR_MARK.findall(text)
        if len(marks) != 1:
            raise ContentError(f"{where}: в предложении нужна ровно одна ошибка {{{{неверно=>верно}}}}")
        wrong, right = marks[0]
        if " " in wrong.strip():
            raise ContentError(f"{where}: ошибка должна быть одним словом")
        others = ERROR_MARK.sub("", text).split()
        if wrong.strip() in others:
            raise ContentError(f"{where}: слово «{wrong.strip()}» встречается в предложении дважды — неясно, какое отмечать")
        ex.text = text
        ex.answer = [wrong.strip(), right.strip()]
    return ex


def _parse_verb(raw: dict, unit_id: int, idx: int) -> Verb:
    where = f"юнит {unit_id}, глагол {idx + 1}"
    forms = raw.get("forms") or []
    if len(forms) != 6:
        raise ContentError(f"{where}: нужно 6 форм")
    return Verb(
        id=f"{unit_id}.v{idx}", inf=str(raw["inf"]), ru=str(raw.get("ru", "")),
        tense=str(raw.get("tense", "presente")),
        forms=[[v.strip() for v in str(f).split("|")] for f in forms], unit_id=unit_id,
    )


def _parse_unit(data: dict, ctx: _Ctx) -> Unit:
    unit_id = int(data["id"])
    lessons: list[Lesson] = []
    for les in data.get("lessons", []):
        slug = les["slug"]
        where = f"юнит {unit_id}, урок {slug}"
        kind = les.get("kind", "lesson")
        if kind not in LESSON_KINDS:
            raise ContentError(f"{where}: неизвестный вид урока {kind!r}")
        lesson = Lesson(
            unit_id=unit_id, slug=slug, title_it=les["title_it"], title_ru=les["title_ru"],
            theory=str(les.get("theory", "")).strip(), kind=kind,
            words=[_parse_word(w, unit_id, slug, i, ctx) for i, w in enumerate(les.get("words", []))],
            phrases=[_parse_phrase(p, f"{where}, фраза {i}", ctx) for i, p in enumerate(les.get("phrases", []))],
            exercises=[_parse_exercise(e, unit_id, slug, i, ctx) for i, e in enumerate(les.get("exercises", []))],
            dialogue=_parse_dialogue(les.get("dialogue"), f"{where}, диалог"),
            reading=_parse_reading(les.get("reading"), f"{where}, текст", ctx),
            photos=[ctx.check_img(str(p), where) for p in les.get("photos", [])],
        )
        for ex in lesson.exercises:
            if ex.ref == "dialogue" and lesson.dialogue is None or ex.ref == "reading" and lesson.reading is None:
                raise ContentError(f"{where}: упражнение {ex.id} ссылается на {ex.ref}, которого нет в уроке")
        if not (lesson.theory or lesson.dialogue or lesson.reading):
            raise ContentError(f"{where}: в уроке нет ни правила, ни диалога, ни текста")
        lessons.append(lesson)
    if len({les.slug for les in lessons}) != len(lessons):
        raise ContentError(f"юнит {unit_id}: повторяющиеся slug уроков")
    for goal in data.get("goals", []):
        if not isinstance(goal, str):
            raise ContentError(f"юнит {unit_id}: цель должна быть строкой (возьмите в кавычки, если есть двоеточие): {goal!r}")
    return Unit(
        id=unit_id, title_it=data["title_it"], title_ru=data["title_ru"], level=data.get("level", "A1"),
        icon=data.get("icon", "🌸"), description=str(data.get("description", "")).strip(),
        goals=list(data.get("goals", [])), lessons=lessons,
        verbs=[_parse_verb(v, unit_id, i) for i, v in enumerate(data.get("verbs", []))],
    )


def _parse_test(data: dict, ctx: _Ctx) -> ProgressTest:
    tid = str(data["id"])
    sections = []
    for si, sec in enumerate(data.get("sections", [])):
        where = f"тест {tid}, раздел {si + 1}"
        exercises = [
            _parse_exercise(e, -1, tid, i, ctx, id_prefix=f"t.{tid}.{si}.{i}") for i, e in enumerate(sec.get("exercises", []))
        ]
        if not exercises:
            raise ContentError(f"{where}: нет заданий")
        sections.append(TestSection(
            title=str(sec.get("title", "")), intro=str(sec.get("intro", "")).strip(),
            reading=_parse_reading(sec.get("reading"), where, ctx),
            audio=clean(str(sec.get("audio", ""))).strip(), exercises=exercises,
        ))
    return ProgressTest(
        id=tid, title=str(data["title"]), units=[int(u) for u in data.get("units", [])],
        description=str(data.get("description", "")).strip(), sections=sections,
        writing=list(data.get("writing", [])),
    )


def load_images(root: Path = CONTENT_ROOT) -> tuple[dict[str, dict], dict[str, str], dict[str, str]]:
    """Картинки и соответствия «слово → картинка», «фраза → картинка» из images.yaml."""
    path = root / "images.yaml"
    if not path.exists():
        return {}, {}, {}
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    images = data.get("images") or {}
    words = {str(k).lower(): str(v) for k, v in (data.get("words") or {}).items()}
    phrases = {str(k): str(v) for k, v in (data.get("phrases") or {}).items()}
    return images, words, phrases


def _merge_extra(data: dict, extra: dict, name: str) -> dict:
    """Дополнения юнита: уроки до/после основных и задания в существующие уроки."""
    lessons = list(extra.get("lessons_before", [])) + list(data.get("lessons", [])) + list(extra.get("lessons_after", []))
    by_slug = {les["slug"]: les for les in lessons}
    for slug, exercises in (extra.get("exercises") or {}).items():
        if slug not in by_slug:
            raise ContentError(f"{name}: дополнительные задания для несуществующего урока {slug!r}")
        by_slug[slug]["exercises"] = list(by_slug[slug].get("exercises", [])) + list(exercises)
    return {**data, "lessons": lessons}


def load_library(content_dir: Path = CONTENT_DIR) -> Library:
    raw_units: list[tuple[str, dict]] = []
    extra_dir = content_dir.parent / "extra"
    for path in sorted(content_dir.glob("unit_*.yaml")):
        with path.open(encoding="utf-8") as fh:
            data = yaml.safe_load(fh)
        extra_path = extra_dir / path.name
        if extra_path.exists():
            data = _merge_extra(data, yaml.safe_load(extra_path.read_text(encoding="utf-8")) or {}, extra_path.name)
        raw_units.append((path.name, data))
    images, word_images, phrase_images = load_images(content_dir.parent)
    # ударения, размеченные в словарях уроков, применяются ко всем фразам
    lexicon = stress_lexicon(
        [str(entry).split("|")[0] for _, data in raw_units for les in data.get("lessons", []) for entry in les.get("words", [])]
    )
    ctx = _Ctx(lexicon, images, word_images, phrase_images)
    units = []
    for name, data in raw_units:
        try:
            units.append(_parse_unit(data, ctx))
        except (ContentError, KeyError, TypeError, ValueError) as exc:
            raise ContentError(f"{name}: {exc}") from exc
    units.sort(key=lambda u: u.id)
    tests = []
    for path in sorted((content_dir.parent / "tests").glob("*.yaml")):
        try:
            tests.append(_parse_test(yaml.safe_load(path.read_text(encoding="utf-8")), ctx))
        except (ContentError, KeyError, TypeError, ValueError) as exc:
            raise ContentError(f"{path.name}: {exc}") from exc
    words = {w.id: w for u in units for les in u.lessons for w in les.words}
    exercises = {e.id: e for u in units for les in u.lessons for e in les.exercises}
    exercises.update({e.id: e for t in tests for s in t.sections for e in s.exercises})
    verbs = {v.id: v for u in units for v in u.verbs}
    return Library(units=units, words=words, exercises=exercises, verbs=verbs, tests=tests, images=images)


@lru_cache(maxsize=1)
def get_library() -> Library:
    return load_library()


# ---------- экспорт для фронтенда ----------


def _drop_empty(d: dict) -> dict:
    return {k: v for k, v in d.items() if v not in ("", None, [], {})}


def _ex_json(ex: Exercise) -> dict:
    d = asdict(ex)
    d.pop("unit_id")
    d.pop("lesson_slug")
    return _drop_empty(d) | {"answer": ex.answer} if ex.answer is not None else _drop_empty(d)


def export_course(lib: Library) -> dict:
    units = []
    for u in lib.units:
        lessons = []
        for les in u.lessons:
            lessons.append(_drop_empty({
                "key": les.key, "slug": les.slug, "title_it": les.title_it, "title_ru": les.title_ru,
                "kind": les.kind, "theory": les.theory,
                "dialogue": asdict(les.dialogue) if les.dialogue else None,
                "reading": asdict(les.reading) if les.reading else None,
                "photos": les.photos,
                "words": [_drop_empty(asdict(w)) | {"unit_id": w.unit_id} for w in les.words],
                "phrases": [_drop_empty(asdict(p)) for p in les.phrases],
                "exercises": [_ex_json(e) for e in les.exercises],
            }))
        units.append({
            "id": u.id, "title_it": u.title_it, "title_ru": u.title_ru, "level": u.level, "icon": u.icon,
            "description": u.description, "goals": u.goals, "lessons": lessons,
            "verbs": [asdict(v) for v in u.verbs],
        })
    tests = [
        {
            "id": t.id, "title": t.title, "units": t.units, "description": t.description, "writing": t.writing,
            "sections": [
                _drop_empty({
                    "title": s.title, "intro": s.intro, "audio": s.audio,
                    "reading": asdict(s.reading) if s.reading else None,
                    "exercises": [_ex_json(e) for e in s.exercises],
                })
                for s in t.sections
            ],
        }
        for t in lib.tests
    ]
    return {"version": 2, "units": units, "tests": tests, "images": lib.images}
