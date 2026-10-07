"""Сборка картинок для курса.

    poetry run python tools/build_images.py

1. Иллюстрации — Microsoft Fluent Emoji 3D (лицензия MIT):
   https://github.com/microsoft/fluentui-emoji
2. Фотографии — Wikimedia Commons, только свободные лицензии (CC0, CC BY, CC BY-SA,
   public domain); автор и лицензия сохраняются и показываются на странице «Об авторах».

Результат: frontend/public/img/{e,p}/*.webp и backend/content/images.yaml.
Скачанные исходники кэшируются в _scratch/img/cache, повторный запуск ничего не качает.
"""

from __future__ import annotations

import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import yaml
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "_scratch" / "img" / "cache"
OUT = ROOT / "frontend" / "public" / "img"
WORDS_FILE = ROOT / "backend" / "content" / "image_words.txt"
IMAGES_YAML = ROOT / "backend" / "content" / "images.yaml"
PHRASES_FILE = ROOT / "backend" / "content" / "phrase_images.txt"
EXTRA_FILE = ROOT / "backend" / "content" / "image_extra.txt"
FLUENT_TREE = "https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/main?recursive=1"
FLUENT_RAW = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/"
UA = {"User-Agent": "BellaItaliaCourseBuilder/1.0 (educational, non-commercial)"}
OK_LICENSES = re.compile(r"^(cc0|cc[ -]by(-sa)?( \d\.\d)?|public domain|pd|attribution)", re.I)

# ключ фотографии → (поисковый запрос на Commons, подпись)
PHOTOS = {
    "colosseo": ("Colosseum Rome exterior", "Колизей, Рим"),
    "gondola": ("Gondola Venice Grand Canal", "Гондола в Венеции"),
    "torre-pisa": ("Leaning Tower of Pisa", "Пизанская башня"),
    "duomo-milano": ("Milan Cathedral facade", "Миланский собор"),
    "firenze": ("Florence Cathedral Duomo view", "Флоренция"),
    "venezia": ("Venice Grand Canal Rialto", "Венеция"),
    "napoli": ("Naples Vesuvius bay panorama", "Неаполь и Везувий"),
    "torino": ("Mole Antonelliana Turin", "Турин, Моле Антонеллиана"),
    "parigi": ("Eiffel Tower Paris", "Париж"),
    "fontana-trevi": ("Trevi Fountain Rome", "Фонтан Треви"),
    "san-marco": ("Piazza San Marco Venice square basilica", "Площадь Сан-Марко"),
    "pizza-margherita": ("Pizza Margherita", "Пицца «Маргарита»"),
    "pasta-tipi": ("Italian pasta types", "Виды пасты"),
    "espresso-bar": ("Espresso cup Italian bar", "Эспрессо в баре"),
    "moka": ("Bialetti Moka Express coffee maker", "Гейзерная кофеварка мока"),
    "parmigiano": ("Parmigiano Reggiano wheels", "Пармиджано-реджано"),
    "mercato-rialto": ("Rialto market Venice", "Рынок Риальто"),
    "panettone": ("Panettone", "Панеттоне"),
    "carnevale-venezia": ("Venice Carnival masks", "Венецианский карнавал"),
    "presepe": ("Presepe napoletano", "Рождественский вертеп"),
    "dolomiti": ("Dolomites Tre Cime di Lavaredo", "Доломитовые Альпы"),
    "frecciarossa": ("Frecciarossa train", "Скоростной поезд «Фречароса»"),
    "vespa": ("Vespa scooter Italy", "Мотороллер «Веспа»"),
    "galleria-milano": ("Galleria Vittorio Emanuele II Milan", "Галерея Виктора Эммануила II"),
    "sanremo-ariston": ("Teatro Ariston Sanremo", "Театр «Аристон», Сан-Ремо"),
    "cinecitta": ("Cinecittà studios entrance", "Киностудия «Чинечитта»"),
    "spiaggia-italia": ("Amalfi coast beach Positano", "Побережье Амальфи"),
    "roma-trastevere": ("Trastevere Rome street restaurant", "Трастевере, Рим"),
    "mercato-frutta": ("Italian market fruit vegetables stall", "Овощной рынок"),
    "gelateria": ("Gelato Italy ice cream shop", "Джелатерия"),
    "verona-arena": ("Arena di Verona", "Арена ди Верона"),
    "bologna": ("Bologna Due Torri", "Болонья"),
    "palermo": ("Palermo Cathedral", "Палермо"),
    "genova": ("Genoa Boccadasse", "Генуя"),
}


def fetch(url: str, attempts: int = 5) -> bytes:
    import urllib.error

    if not url.startswith("https://"):
        raise ValueError(f"разрешены только https-адреса: {url}")
    for i in range(attempts):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:  # nosec B310 — схема проверена выше
                return r.read()
        except urllib.error.HTTPError as exc:
            if i == attempts - 1:
                raise
            # 429 — сервер просит подождать: уважаем Retry-After
            wait = int(exc.headers.get("Retry-After") or 0) if exc.code == 429 else 0
            time.sleep(max(wait, 15 * (i + 1) if exc.code == 429 else 2 * (i + 1)))
        except Exception:  # noqa: BLE001 — сеть: повторяем
            if i == attempts - 1:
                raise
            time.sleep(2 * (i + 1))
    raise RuntimeError("unreachable")


def cached(name: str, url: str) -> bytes:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists():
        path.write_bytes(fetch(url))
        time.sleep(2.0 if "wikimedia" in url or "wikipedia" in url else 0.15)
    return path.read_bytes()


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def fluent_index() -> dict[str, str]:
    tree = json.loads(cached("fluent_tree.json", FLUENT_TREE))
    index: dict[str, str] = {}
    for item in tree["tree"]:
        p = item["path"]
        parts = p.split("/")
        if p.endswith("_3d.png") and len(parts) == 4 and parts[2] == "3D":
            index.setdefault(parts[1].lower(), p)
        elif p.endswith("_3d_default.png") and "/Default/3D/" in p:
            index.setdefault(parts[1].lower(), p)
    return index


def save_webp(data: bytes, out: Path, size: int, quality: int = 82) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(io.BytesIO(data))
    img = img.convert("RGBA") if img.mode in ("P", "LA", "RGBA") else img.convert("RGB")
    img.thumbnail((size, size), Image.LANCZOS)
    img.save(out, "WEBP", quality=quality, method=6)


def phrase_key(text: str) -> str:
    """Ключ фразы: нижний регистр, без пробелов и знаков в конце (так же считает app/content.py)."""
    return re.sub(r"[\s!?.…]+$", "", text.strip().lower())


def parse_phrases(path: Path) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines() if path.exists() else []:
        line = line.strip()
        if line and not line.startswith("#"):
            phrase, _, target = line.rpartition("=")
            mapping[phrase_key(phrase)] = target.strip().lower()
    return mapping


def parse_mapping(path: Path) -> dict[str, str]:
    mapping: dict[str, str] = {}
    if not path.exists():
        return mapping
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        word, _, target = line.partition("=")
        mapping[word.strip().lower()] = target.strip().lower()
    return mapping


def commons_photo(key: str, query: str) -> dict | None:
    api = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "generator": "search", "gsrsearch": f"filetype:bitmap {query}",
        "gsrnamespace": 6, "gsrlimit": 12, "prop": "imageinfo", "iiprop": "url|extmetadata|size|mime",
        "iiurlwidth": 960,
    })
    data = json.loads(cached(f"commons_{key}.json", api))
    pages = sorted((data.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
    for page in pages:
        info = (page.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {})
        lic = meta.get("LicenseShortName", {}).get("value", "")
        if info.get("mime") != "image/jpeg" or info.get("width", 0) < 900 or not OK_LICENSES.match(lic.strip()):
            continue
        artist = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip() or "неизвестен"
        return {
            "thumb": info["thumburl"],
            "credit": artist[:120],
            "license": lic,
            "source": info.get("descriptionurl", ""),
            "title": page["title"].removeprefix("File:"),
        }
    return None


def draw_flag(out: Path) -> None:
    """Флаг Италии рисуем сами: в Fluent Emoji нет государственных флагов."""
    out.parent.mkdir(parents=True, exist_ok=True)
    w, h = 960, 600
    img = Image.new("RGB", (w, h), (234, 246, 255))
    from PIL import ImageDraw

    d = ImageDraw.Draw(img)
    fx, fy, fw, fh = 150, 110, 660, 420
    d.rounded_rectangle((fx - 8, fy - 8, fx + fw + 8, fy + fh + 8), radius=28, fill=(220, 226, 236))
    for i, color in enumerate([(0, 146, 70), (255, 255, 255), (206, 43, 55)]):
        d.rectangle((fx + i * fw // 3, fy, fx + (i + 1) * fw // 3, fy + fh), fill=color)
    d.rectangle((fx - 40, fy - 30, fx - 26, h - 40), fill=(170, 150, 120))
    img.save(out, "WEBP", quality=88)


def main() -> None:
    mapping = parse_mapping(WORDS_FILE) | parse_mapping(EXTRA_FILE)
    index = fluent_index()
    images: dict[str, dict] = {}
    words: dict[str, str] = {}
    phrases: dict[str, str] = {}
    missing: list[str] = []

    # иллюстрации: слова и фразы
    jobs = [(words, w, t) for w, t in mapping.items()] + [(phrases, p, t) for p, t in parse_phrases(PHRASES_FILE).items()]
    for target_map, word, target in jobs:
        if target.startswith("photo:"):
            target_map[word] = "p-" + target.removeprefix("photo:")
            continue
        path = index.get(target)
        if not path:
            missing.append(f"{word} → {target}")
            continue
        key = "e-" + slug(target)
        target_map[word] = key
        if key not in images:
            out = OUT / "e" / f"{slug(target)}.webp"
            if not out.exists():
                save_webp(cached(f"fluent_{slug(target)}.png", FLUENT_RAW + urllib.parse.quote(path)), out, 160)
            images[key] = {"src": f"img/e/{slug(target)}.webp", "kind": "emoji", "alt": target}

    # флаг — собственный рисунок
    draw_flag(OUT / "p" / "bandiera-italia.webp")
    images["p-bandiera-italia"] = {"src": "img/p/bandiera-italia.webp", "kind": "photo", "alt": "Флаг Италии",
                                   "credit": "Bella Italia", "license": "собственный рисунок", "source": ""}

    # фотографии
    for key, (query, caption) in PHOTOS.items():
        out = OUT / "p" / f"{key}.webp"
        info = commons_photo(key, query)
        if info is None:
            missing.append(f"фото {key}: нет подходящего снимка со свободной лицензией")
            continue
        if not out.exists():
            save_webp(cached(f"photo_{key}.jpg", info["thumb"]), out, 960, quality=78)
        images[f"p-{key}"] = {
            "src": f"img/p/{key}.webp", "kind": "photo", "alt": caption,
            "credit": info["credit"], "license": info["license"], "source": info["source"],
        }

    for target_map in (words, phrases):
        for word, key in list(target_map.items()):
            if key not in images:
                missing.append(f"{word} → {key} (нет картинки)")
                del target_map[word]

    IMAGES_YAML.write_text(
        "# Сгенерировано tools/build_images.py — не редактируйте вручную.\n"
        + yaml.safe_dump({"images": images, "words": words, "phrases": phrases}, allow_unicode=True, sort_keys=True, width=200),
        encoding="utf-8",
    )
    size = sum(f.stat().st_size for f in OUT.rglob("*.webp")) // 1024
    print(f"Иллюстраций: {sum(1 for v in images.values() if v['kind'] == 'emoji')}, "
          f"фото: {sum(1 for v in images.values() if v['kind'] == 'photo')}, слов с картинкой: {len(words)}, фраз: {len(phrases)}, {size} КБ")
    if missing:
        print("Не найдено:\n  " + "\n  ".join(missing), file=sys.stderr)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    main()
