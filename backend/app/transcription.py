"""Автоматическая транскрипция итальянских слов: IPA и русскими буквами.

Ударение по умолчанию — на предпоследний слог (или на гласную со знаком ударения:
caffè, città). Нестандартное ударение в контенте отмечается обратным апострофом
перед ударной гласной: ``m`usica``, ``farmac`ia``, ``t`uo``. Сам знак в слово не попадает.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

STRESS = "`"
ACCENTED = {"à": "a", "è": "e", "é": "e", "ì": "i", "í": "i", "ò": "o", "ó": "o", "ù": "u", "ú": "u"}
OPEN_ACCENT = {"è": "ɛ", "ò": "ɔ"}
VOWELS = set("aeiou")
WEAK = set("iu")
CYR_ACUTE = "́"

SIMPLE_CONS = {
    "b": ("b", "б"), "d": ("d", "д"), "f": ("f", "ф"), "k": ("k", "к"), "l": ("l", "л"),
    "m": ("m", "м"), "n": ("n", "н"), "p": ("p", "п"), "r": ("r", "р"), "t": ("t", "т"),
    "v": ("v", "в"), "w": ("w", "в"), "x": ("ks", "кс"), "j": ("j", "й"),
}
CYR_VOWEL = {"a": "а", "e": "е", "i": "и", "o": "о", "u": "у"}
# гласная после мягкого звука (gl, gn, glide i): famiglia → фамилья
CYR_SOFT = {"a": "ья", "e": "ье", "i": "ьи", "o": "ьо", "u": "ью"}
CYR_IOT = {"a": "я", "e": "е", "i": "и", "o": "ё", "u": "ю"}
ONSET_OBSTRUENTS = {"p", "b", "t", "d", "k", "ɡ", "f", "v"}

# Слова с ударением не на предпоследний слог, которые встречаются в контенте
# без пометки (во фразах, примерах). Слова, размеченные в словаре урока, сюда
# добавляются автоматически при загрузке контента (см. content.py).
STRESS_OVERRIDES = {
    w.replace(STRESS, ""): w
    for w in (
        "`essere pr`endere risp`ondere sc`endere con`oscere con`oscersi con`oscerti conv`incere "
        "interr`ompere iscr`iversi m`ettersi m`etterci pi`overe `abitano `abiti ant`icipo `attimo "
        "b`ancomat c`amere c`ostano curr`iculum dec`alogo d`irmelo `erano f`igurati `internet "
        "m`aniche n`ascita pen`isola per`iodo pi`acciono p`iccolo p`opolo p`overa p`overo "
        "pr`endilo pr`ossima sc`arica sbr`igati spl`endido stat`istica class`ifica ti`enilo "
        "`ultima `unico `utile in`utile v`itae v`ogliono simp`atica part`ecipa `ancora odd`io "
        "perifer`ia poliz`ia p`aolo n`umero m`obile s`abato d`ubbio d`ue ventid`ue trentad`ue mar`ia luc`ia"
    ).split()
}
STRESS_OVERRIDES["yogurt"] = "i`ogurt"
LIQUIDS = {"r", "l"}


@dataclass
class Tok:
    kind: str  # "C" — согласный, "V" — гласный
    ipa: str
    cyr: str = ""
    vowel: str = ""  # для гласных: a/e/i/o/u
    open_vowel: str = ""  # ɛ/ɔ для è/ò
    src: int = -1
    soft: bool = False  # мягкий согласный (ʎ, ɲ): следующая гласная пишется я/ё/ю
    glide: bool = False
    nucleus: bool = False
    stressed: bool = False
    accented: bool = False


@dataclass
class Word:
    tokens: list[Tok] = field(default_factory=list)


def _prepare(word: str) -> tuple[str, int | None, set[int]]:
    """Возвращает (буквы без ударений, индекс явного ударения, индексы гласных со знаком)."""
    plain: list[str] = []
    explicit: int | None = None
    accented: set[int] = set()
    mark_next = False
    for ch in word.lower():
        if ch == STRESS:
            mark_next = True
            continue
        if ch in ACCENTED:
            accented.add(len(plain))
            plain.append(ch)  # знак сохраняем, чтобы различать è/é
        elif ch.isalpha():
            plain.append(ch)
        else:
            continue
        if mark_next:
            explicit = len(plain) - 1
            mark_next = False
    return "".join(plain), explicit, accented


def _base(ch: str) -> str:
    return ACCENTED.get(ch, ch)


def _tokenize(word: str) -> list[Tok]:
    s, explicit, accented = _prepare(word)
    b = [_base(c) for c in s]
    n = len(b)
    toks: list[Tok] = []

    def at(k: int) -> str:
        return b[k] if 0 <= k < n else ""

    def is_vowel(k: int) -> bool:
        return at(k) in VOWELS

    def silent_i(k: int) -> bool:
        """i после c/g/sc/gl перед гласной не читается (ciao, giallo, lasciare, figlio)."""
        return at(k) == "i" and is_vowel(k + 1) and k != explicit and k not in accented

    i = 0
    while i < n:
        c = b[i]
        nxt = at(i + 1)
        if c in VOWELS:
            toks.append(Tok("V", c, vowel=c, src=i, accented=i in accented,
                            stressed=i == explicit, open_vowel=OPEN_ACCENT.get(s[i], "")))
            i += 1
            continue
        if c == "h":
            i += 1
            continue
        if c in "cg" and nxt == c and at(i + 2) in ("e", "i"):
            # cc/gg перед e/i: cappuccino, oggi
            ipa, cyr = ("ttʃ", "ч") if c == "c" else ("ddʒ", "дж")
            toks.append(Tok("C", ipa, cyr))
            i += 2
            if silent_i(i):
                i += 1
            continue
        if c == "c":
            if nxt in ("e", "i"):
                toks.append(Tok("C", "tʃ", "ч"))
                i += 1
                if silent_i(i):
                    i += 1
            elif nxt == "h":
                toks.append(Tok("C", "k", "к"))
                i += 2
            elif nxt == "q":
                toks.append(Tok("C", "k", "к"))
                i += 1
            else:
                toks.append(Tok("C", "k", "к"))
                i += 1
            continue
        if c == "g":
            if nxt in ("e", "i"):
                toks.append(Tok("C", "dʒ", "дж"))
                i += 1
                if silent_i(i):
                    i += 1
            elif nxt == "h":
                toks.append(Tok("C", "ɡ", "г"))
                i += 2
            elif nxt == "n":
                toks.append(Tok("C", "ɲ", "н", soft=True))
                i += 2
            elif nxt == "l" and at(i + 2) == "i":
                toks.append(Tok("C", "ʎ", "л", soft=True))
                i += 2
                if silent_i(i):
                    i += 1
            elif nxt == "u" and is_vowel(i + 2):
                toks.append(Tok("C", "ɡw", "гу"))
                i += 2
            else:
                toks.append(Tok("C", "ɡ", "г"))
                i += 1
            continue
        if c == "q":
            toks.append(Tok("C", "kw", "кв"))
            i += 2 if nxt == "u" else 1
            continue
        if c == "s":
            if nxt == "c" and at(i + 2) in ("e", "i"):
                toks.append(Tok("C", "ʃ", "ш"))
                i += 2
                if silent_i(i):
                    i += 1
                continue
            if nxt == "s":
                toks.append(Tok("C", "s", "с"))
                toks.append(Tok("C", "s", "с"))
                i += 2
                continue
            voiced = (is_vowel(i - 1) and is_vowel(i + 1)) or nxt in set("bdglmnrv")
            toks.append(Tok("C", "z", "з") if voiced else Tok("C", "s", "с"))
            i += 1
            continue
        if c == "z":
            if nxt == "z":
                toks.append(Tok("C", "t", "ц"))
                toks.append(Tok("C", "ts", "ц"))
                i += 2
                continue
            if i == 0:
                toks.append(Tok("C", "dz", "дз"))
            else:
                toks.append(Tok("C", "ts", "ц"))
            i += 1
            continue
        if c == "y":
            toks.append(Tok("V", "i", vowel="i", src=i))
            i += 1
            continue
        if c in SIMPLE_CONS:
            ipa, cyr = SIMPLE_CONS[c]
            if c == "n" and nxt in ("c", "g", "q") and at(i + 1) + at(i + 2) not in ("ce", "ci", "ge", "gi"):
                ipa = "ŋ"
            toks.append(Tok("C", ipa, cyr))
            i += 1
            continue
        i += 1  # неизвестный символ — пропускаем
    _assign_nuclei(toks)
    return toks


def _assign_nuclei(toks: list[Tok]) -> None:
    # группы подряд идущих гласных
    groups: list[list[Tok]] = []
    cur: list[Tok] = []
    for t in toks:
        if t.kind == "V":
            cur.append(t)
        else:
            if cur:
                groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)

    for g in groups:
        forced = [t for t in g if t.stressed or t.accented]
        for t in g:
            if t in forced or t.vowel not in WEAK:
                t.nucleus = True
        if not any(t.nucleus for t in g):
            g[0].nucleus = True  # только слабые: lui, fui
        for t in g:
            if not t.nucleus:
                t.glide = True

    nuclei = [t for t in toks if t.nucleus]
    if not nuclei:
        return
    marked = [t for t in nuclei if t.stressed] or [t for t in nuclei if t.accented]
    if marked:
        target = marked[-1]
    elif len(nuclei) == 1 or toks[-1].kind == "C":
        # усечённые слова на согласный: nessun, signor — ударение на последний слог
        target = nuclei[-1]
    else:
        target = nuclei[-2]
    for t in nuclei:
        t.stressed = t is target


def _onset_start(toks: list[Tok], idx: int) -> int:
    """Индекс начала слога, ядро которого стоит в позиции idx."""
    k = idx
    while k - 1 >= 0 and toks[k - 1].glide and toks[k - 1].kind == "V":
        prev = toks[k - 2] if k - 2 >= 0 else None
        if prev is not None and prev.kind == "V" and prev.nucleus:
            break  # mai-o: глайд относится к предыдущему слогу
        k -= 1
    run_end = k
    j = k
    while j - 1 >= 0 and toks[j - 1].kind == "C":
        j -= 1
    run = toks[j:run_end]
    if not run:
        return k
    if j == 0:
        return 0
    onset = 1
    if len(run) >= 2:
        a, c = run[-2].ipa, run[-1].ipa
        if a in ONSET_OBSTRUENTS and c in LIQUIDS:
            onset = 2
    if len(run) > onset and run[-onset - 1].ipa in ("s", "z") and run[-onset - 1].ipa != run[-onset].ipa:
        onset += 1
    return run_end - onset


def _word_ipa(toks: list[Tok]) -> str:
    out: list[str] = []
    nuclei = [t for t in toks if t.nucleus]
    stress_at = -1
    if len(nuclei) > 1:
        idx = next(i for i, t in enumerate(toks) if t.nucleus and t.stressed)
        stress_at = _onset_start(toks, idx)
    for i, t in enumerate(toks):
        if i == stress_at:
            ipa = _cons_ipa(toks, i) if t.kind == "C" else ""
            if len(ipa) >= 2 and ipa[0] == ipa[1]:
                # гемината делится между слогами: kapputˈtʃino
                out.extend([ipa[0], "ˈ", ipa[1:]])
                continue
            out.append("ˈ")
        if t.kind == "V":
            if t.glide:
                out.append("j" if t.vowel == "i" else "w")
            else:
                out.append(t.open_vowel or t.vowel)
        else:
            out.append(_cons_ipa(toks, i))
    return "".join(out)


def _cons_ipa(toks: list[Tok], i: int) -> str:
    ipa = toks[i].ipa
    # ʎ, ɲ, ʃ между гласными всегда долгие
    if ipa in ("ʎ", "ɲ", "ʃ") and i > 0 and toks[i - 1].kind == "V":
        ipa = ipa * 2
    return ipa


def _word_cyr(toks: list[Tok]) -> str:
    out: list[str] = []
    polysyllabic = sum(1 for t in toks if t.nucleus) > 1
    prev: Tok | None = None
    for i, t in enumerate(toks):
        if t.kind == "C":
            if t.cyr in ("л", "н") and t.soft and (i + 1 >= len(toks) or toks[i + 1].kind == "C"):
                out.append(t.cyr + "ь")
            else:
                out.append(t.cyr)
            prev = t
            continue
        v = t.vowel
        if t.glide and v == "i":
            nxt = toks[i + 1] if i + 1 < len(toks) else None
            if nxt is not None and nxt.kind == "V" and nxt.nucleus and (prev is None or prev.kind == "C"):
                # пьеде, Италья; в начале слова — йери
                if prev is None:
                    out.append("й")
                elif prev.cyr in ("ч", "дж", "ш"):
                    pass
                else:
                    out.append("ь")
                prev = t
                continue
            out.append("й")
            prev = t
            continue
        if prev is not None and prev.kind == "C" and prev.soft:
            letter = CYR_SOFT[v]
        elif prev is not None and prev.kind == "V" and prev.glide and prev.vowel == "i" and out[-1] == "й":
            letter = CYR_VOWEL[v]  # macellaio → мачеллайо, ieri → йери
        elif prev is not None and prev.kind == "V" and prev.glide and prev.vowel == "i":
            letter = CYR_VOWEL[v] if v == "e" else CYR_IOT[v]
            if out and out[-1] == "ь" and v == "o":
                letter = "о"  # фьоре
        elif v == "e" and (prev is None or prev.kind == "V"):
            letter = "э"
        elif v == "e" and t.accented and i == len(toks) - 1:
            letter = "э"  # caffè → каффэ
        else:
            letter = CYR_VOWEL[v]
        if t.stressed and polysyllabic:
            letter = letter + CYR_ACUTE
        out.append(letter)
        prev = t
    return "".join(out)


_SPLIT = re.compile(r"(\s+|[.,!?;:()\-–—/«»\"]+)")


def clean(text: str) -> str:
    """Убирает служебные знаки ударения для отображения."""
    return text.replace(STRESS, "")


def stress_lexicon(marked_texts: list[str]) -> dict[str, str]:
    """Собирает словарь ударений из размеченных текстов (``m`usica`` → musica)."""
    lexicon: dict[str, str] = {}
    for text in marked_texts:
        for part in _SPLIT.split(text):
            for word in re.split(r"['’]", part):
                if STRESS in word:
                    lexicon[word.replace(STRESS, "").lower()] = word.lower()
    return lexicon


def transcribe(text: str, lexicon: dict[str, str] | None = None) -> tuple[str, str]:
    """Возвращает (IPA, кириллица) для слова или фразы."""
    ipa_parts: list[str] = []
    cyr_parts: list[str] = []
    for part in _SPLIT.split(text):
        if not part:
            continue
        if _SPLIT.fullmatch(part):
            sep = " " if part.isspace() else part.strip() + (" " if part.strip() in ",;:" else "")
            ipa_parts.append(" " if part.isspace() else (" " if part.strip() in ",;:-–—/" else ""))
            cyr_parts.append(sep if sep else " ")
            continue
        word = "".join(_with_stress(w, lexicon) for w in re.split(r"(['’])", part) if w not in ("'", "’"))
        toks = _tokenize(word)
        if not toks:
            continue
        ipa_parts.append(_word_ipa(toks))
        cyr_parts.append(_word_cyr(toks))
    ipa = re.sub(r"\s+", " ", "".join(ipa_parts)).strip()
    cyr = re.sub(r"\s+", " ", "".join(cyr_parts)).strip()
    return f"[{ipa}]", cyr


def _with_stress(word: str, lexicon: dict[str, str] | None) -> str:
    if STRESS in word or any(ch in ACCENTED for ch in word):
        return word
    key = word.lower()
    if lexicon and key in lexicon:
        return lexicon[key]
    return STRESS_OVERRIDES.get(key, word)
