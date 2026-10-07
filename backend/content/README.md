# Формат учебного контента

Каждый юнит — отдельный файл `units/unit_NN.yaml`, дополнения к нему — `extra/unit_NN.yaml`,
тесты прогресса — `tests/progress_N.yaml`, картинки — `images.yaml`. Контент проверяется при экспорте
и в тестах (`poetry run pytest`): ошибка в файле остановит сборку с понятным сообщением.

После любой правки контента пересоберите `course.json` и фронтенд:

```bash
cd backend && poetry run python -m app.export && cd ../frontend && npm run build
```

> Строки, в которых есть двоеточие с пробелом (`текст: пример`), берите в кавычки — иначе YAML
> превратит их в словарь. Загрузчик это проверяет для целей юнита.

```yaml
id: 1                       # номер юнита (порядок в курсе)
title_it: "Un nuovo inizio"
title_ru: "Новое начало"
level: A1                   # A0 / A1 / A2 — группа на странице курса
icon: "🕊️"
description: >
  Краткое описание юнита.
goals:
  - чему научится ученица

lessons:
  - slug: presente-regolare  # уникальный в пределах юнита, используется в URL
    title_it: "Sono molto contenta"
    title_ru: "Настоящее время: правильные глаголы"
    theory: |                # Markdown: заголовки ##, таблицы, **жирный**, *курсив*, > подсказки
      ## Три спряжения
      ...
    words:                   # «итальянский | русский | доп. поле»
      - "lavorare | работать"
      - "l'ufficio | офис | m"          # m / f — род для слов с артиклем l'
      - "m`usica | музыка"              # ` перед гласной — ударение не на предпоследний слог
      - "l'uovo | яйцо | m; мн. ч. le uova"   # после ; — примечание
    phrases:
      - "Come stai? | Как дела?"
    exercises:
      - type: choice          # выбор одного варианта
        level: 1              # 1 — лёгкий, 2 — средний, 3 — сложный
        q: "Io ___ in un ufficio."   # Markdown разрешён
        options: ["lavora", "lavoro", "lavori"]
        answer: 1             # индекс правильного варианта
        explain: "Пояснение после ответа (необязательно)"
      - type: input           # ввод с клавиатуры, сравнение без учёта регистра;
        level: 3              # ответ без знака ударения тоже засчитывается (с подсказкой)
        q: "Voi ___ (parlare) italiano?"
        answer: ["parlate"]   # один или несколько допустимых ответов
      - type: order           # собрать фразу из перемешанных слов
        level: 2
        q: "Соберите: «Я живу в Риме.»"
        answer: "Abito a Roma."
      - type: match           # сопоставить пары
        level: 2
        q: "Соедините слово и перевод"
        pairs:
          - ["ciao", "привет"]
          - ["grazie", "спасибо"]

verbs:                         # таблицы спряжений (6 форм: io, tu, lui/lei, noi, voi, loro)
  - {inf: andare, ru: идти, tense: presente, forms: [vado, vai, va, andiamo, andate, vanno]}
  - {inf: andare, ru: идти, tense: passato prossimo,
     forms: ["sono andato|sono andata", ...]}   # | — равноправные варианты
  # для imperativo отсутствующие формы обозначаются "—"
```

## Остальные типы упражнений

```yaml
- type: odd                 # «найди лишнее» — как choice: options + answer (индекс)
- type: tf                  # верно / неверно
  items: [["Sofia è russa.", true], ["Abita a Roma.", false]]
- type: dialog              # расставить реплики по порядку (lines — в правильном порядке)
  lines: ["Ciao!", "Ciao, come stai?", "Bene, grazie."]
- type: cloze               # текст с пропусками
  text: "Io [[sono|sono stata]] a Roma. Lui [[va/*viene/vanno]] a casa."
  #   [[ответ|вариант]] — ввод с клавиатуры, | — допустимые варианты
  #   [[a/*b/c]] — выпадающий список, * — правильный вариант
- type: error               # нажать на слово с ошибкой
  text: "Mia {{madri=>madre}} è italiana."
  #   ошибочное слово — одно и больше не встречается в предложении
```

Общие необязательные поля любого упражнения: `explain` (пояснение после ответа),
`audio` (фраза, которую платформа произнесёт — аудирование/диктант), `img` (ключ картинки),
`ref: dialogue | reading` (показать рядом диалог или текст урока).

## Виды уроков, диалоги и тексты

```yaml
- slug: dialogo-cena-fuori
  kind: dialogue            # lesson (по умолчанию) | grammar | dialogue | culture | review
  dialogue:
    title: "Al ristorante"
    scene: "Описание ситуации"
    lines:
      - "Cameriere: Buonasera! | Добрый вечер!"   # «Говорящий: по-итальянски | перевод»
  reading:                  # текст для чтения (уроки культуры)
    title: "La pizza Margherita"
    photo: p-pizza-margherita
    text: |
      Абзацы с новой строки…
    ru: |
      Перевод (необязательно)
    glossary: [["nascere", "рождаться"]]
  photos: [p-pasta-tipi, p-gelateria]   # галерея фотографий
```

## Дополнения к юниту: `extra/unit_NN.yaml`

```yaml
lessons_before: [...]   # уроки в начало юнита (например, вводный диалог)
lessons_after: [...]    # уроки в конец (культура, самопроверка)
exercises:              # дополнительные упражнения в существующие уроки
  possessivi-completi:  # slug урока
    - type: error
      ...
```

## Тесты прогресса: `tests/progress_N.yaml`

```yaml
id: progress-2
title: "Тест прогресса 2 · юниты 3–5"
units: [3, 4, 5]          # тест показывается на странице последнего юнита
sections:
  - title: "Чтение"
    intro: "Прочитайте письмо и ответьте на вопросы."
    reading: {title: ..., text: ...}   # или audio: "текст для прослушивания"
    exercises: [...]                   # упражнения любых типов
writing:                  # письмо — самопроверка по чек-листу и образцу
  - task: "**Ваши выходные** (40–50 слов): …"
    words: "40–50"
    checklist: ["Я использовала passato prossimo"]
    sample: "Образец ответа"
```

## Картинки

Слово из словаря получает картинку, если оно перечислено в `image_words.txt`
(`слово = название Fluent Emoji` или `слово = photo:ключ`). Скрипт
`poetry run python tools/build_images.py` скачивает иллюстрации Microsoft Fluent Emoji (MIT) и
фотографии с Wikimedia Commons (только со свободными лицензиями, автор и лицензия сохраняются),
конвертирует их в WebP в `frontend/public/img/` и пишет `images.yaml`.

## Транскрипция

Транскрипция (IPA и кириллица) строится автоматически по правилам чтения в
`app/transcription.py`. Ударение по умолчанию ставится на предпоследний слог или на гласную
со знаком (`caffè`). Если ударение другое, отметьте его обратным апострофом перед ударной гласной
в словаре урока — пометка автоматически применится и ко всем фразам. Частые слова с особым
ударением, которые встречаются только во фразах, перечислены в `STRESS_OVERRIDES`.
