import pytest

from app.content import ContentError, _parse_cloze, export_course, get_library, load_library
from app.transcription import transcribe

lib = get_library()


def test_all_units_loaded():
    assert [u.id for u in lib.units] == list(range(12))
    assert len(lib.words) > 1000
    assert len(lib.exercises) > 500


def test_every_lesson_has_content_and_exercises():
    for u in lib.units:
        for les in u.lessons:
            assert les.theory or les.dialogue or les.reading, les.key
            assert len(les.exercises) >= 3, les.key


@pytest.mark.parametrize(
    "word,ipa,cyr",
    [
        ("ciao", "[ˈtʃao]", "ча́о"),
        ("famiglia", "[faˈmiʎʎa]", "фами́лья"),
        ("gnocchi", "[ˈɲokki]", "ньо́кки"),
        ("caffè", "[kafˈfɛ]", "каффэ́"),
        ("m`usica", "[ˈmuzika]", "му́зика"),
        ("piccolo", "[ˈpikkolo]", "пи́кколо"),
        ("il macellaio", "[il matʃelˈlajo]", "ил мачелла́йо"),
        ("scuola", "[ˈskwola]", "скуо́ла"),
    ],
)
def test_transcription(word, ipa, cyr):
    assert transcribe(word) == (ipa, cyr)


def test_display_text_has_no_stress_marks():
    assert all("`" not in w.it for w in lib.words.values())


def test_cloze_parsing():
    text, gaps = _parse_cloze("Io [[sono]] di [[*Roma/Milano/Napoli]].", "t")
    assert gaps[0] == {"answers": ["sono"], "options": []}
    assert gaps[1] == {"answers": ["Roma"], "options": ["Roma", "Milano", "Napoli"]}
    with pytest.raises(ContentError):
        _parse_cloze("Нет пропусков", "t")
    with pytest.raises(ContentError):
        _parse_cloze("[[*a/*b]]", "t")


def test_bad_content_is_reported(tmp_path):
    units = tmp_path / "units"
    units.mkdir()
    (units / "unit_00.yaml").write_text(
        "id: 0\ntitle_it: X\ntitle_ru: X\nlessons:\n  - slug: a\n    title_it: A\n    title_ru: A\n    theory: T\n"
        "    exercises:\n      - {type: choice, q: Q, options: [a, b], answer: 5}\n",
        encoding="utf-8",
    )
    with pytest.raises(ContentError, match="unit_00.yaml"):
        load_library(units)


def test_export_contains_everything_the_frontend_needs():
    data = export_course(lib)
    assert len(data["units"]) == 12
    keys = [les["key"] for les in data["units"][0]["lessons"]]
    assert keys[0] == "0.dialogo-benvenuti" and "0.alfabeto" in keys
    les = next(les for les in data["units"][0]["lessons"] if les["key"] == "0.alfabeto")
    assert les["words"][0]["ipa"].startswith("[")
    assert all("answer" in e or e["type"] in ("match", "tf", "dialog", "cloze") for e in les["exercises"])


def test_every_phrase_has_a_picture():
    # новые фразы нужно добавить в content/phrase_images.txt и запустить tools/build_images.py
    missing = [p.it for u in lib.units for les in u.lessons for p in les.phrases if not p.img]
    assert missing == []
