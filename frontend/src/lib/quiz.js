// Генерация вопросов и проверка ответов. Работает целиком в браузере,
// поэтому одинаково для серверного режима и статического сайта.
//
// Идентификаторы вопросов:
//   ex:<id упражнения>   — упражнение из урока или теста
//   w2r / r2w / r2wi     — слово → перевод / перевод → слово / написать слово
//   wimg                 — картинка → слово, wl — услышать слово → перевод, wd — диктант
//   wm:<id>,<id>…        — сопоставить слова и переводы
//   vc / vi:<глагол>:<лицо> — выбрать / написать форму глагола

export const PERSONS = ['io', 'tu', 'lui / lei', 'noi', 'voi', 'loro']
export const LEVEL_NAMES = { 1: 'Лёгкий', 2: 'Средний', 3: 'Сложный' }
export const TENSE_RU = {
  presente: 'настоящее время',
  'passato prossimo': 'passato prossimo',
  'futuro semplice': 'будущее время',
  imperfetto: 'imperfetto',
  condizionale: 'условное наклонение',
  imperativo: 'повелительное наклонение',
}
const ARTICLES = ['il ', 'lo ', 'la ', 'i ', 'gli ', 'le ', 'un ', 'uno ', 'una ', "l'", "un'"]
const WORD_KINDS = ['w2r', 'r2w', 'r2wi', 'wimg', 'wl', 'wd']

// ---------- случайность ----------

export function rng(seed = Date.now()) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}
export const shuffle = (arr, rand = Math.random) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const sample = (arr, n, rand) => shuffle(arr, rand).slice(0, n)

// ---------- нормализация ----------

export function normalize(text) {
  return String(text ?? '')
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/[’`]/g, "'")
    .replace(/\s*'\s*/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^[\s.!?;:,]+|[\s.!?;:,]+$/g, '')
}
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')
export const stripAccents = (t) => t.normalize('NFD').replace(COMBINING_MARKS, '')
const noPunct = (t) => normalize(t).replace(/[^\p{L}\p{N}' ]/gu, '').replace(/\s+/g, ' ').trim()

function compareText(given, accepted) {
  const g = normalize(given)
  const norm = accepted.map(normalize)
  if (norm.includes(g)) return { correct: true, expected: accepted[0] }
  if (norm.map(stripAccents).includes(stripAccents(g)))
    return { correct: true, expected: accepted[0], note: 'Верно! Только не забывайте про знак ударения.' }
  return { correct: false, expected: accepted[0] }
}

export function withoutArticle(it) {
  const low = it.toLowerCase()
  const art = ARTICLES.find((a) => low.startsWith(a))
  return art ? it.slice(art.length).trim() : it
}

export function wordAnswers(word) {
  const v = [word.it]
  const bare = withoutArticle(word.it)
  if (bare !== word.it) v.push(bare)
  if (word.it.includes(' / ')) {
    const tail = word.it.split(' / ').pop()
    v.push(tail, withoutArticle(tail))
  }
  return v
}

// ---------- представление упражнений ----------

function tokenizeError(text) {
  // "Io {{sono=>ho}} vent'anni" → токены, у ошибочного отмечен индекс
  const parts = []
  let wrongIndex = -1
  const re = /\{\{(.+?)=>(.+?)\}\}|(\S+)/g
  let m
  while ((m = re.exec(text))) {
    if (m[1]) {
      wrongIndex = parts.length
      parts.push(m[1])
    } else parts.push(m[3])
  }
  return { tokens: parts, wrongIndex }
}

function clozeParts(text) {
  // делим текст на куски и пропуски
  const out = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(/\[\[(.+?)\]\]/g)) {
    out.push({ text: text.slice(last, m.index) })
    out.push({ gap: i++ })
    last = m.index + m[0].length
  }
  out.push({ text: text.slice(last) })
  return out
}

export function exerciseQuestion(ex, rand = Math.random, context = {}) {
  const q = {
    id: `ex:${ex.id}`, type: ex.type, level: ex.level, prompt: ex.q,
    audio: ex.audio, img: ex.img, explain: ex.explain,
  }
  if (ex.ref && context[ex.ref]) q.context = { kind: ex.ref, data: context[ex.ref] }
  switch (ex.type) {
    case 'choice':
    case 'odd':
      q.options = ex.options.some((o) => /вариант/i.test(o)) ? [...ex.options] : shuffle(ex.options, rand)
      if (ex.type === 'odd') q.type = 'choice'
      q.kind = ex.type
      break
    case 'order': {
      const tokens = ex.answer.split(/\s+/)
      let s = shuffle(tokens, rand)
      for (let k = 0; k < 5 && s.join(' ') === tokens.join(' '); k++) s = shuffle(tokens, rand)
      q.tokens = s
      break
    }
    case 'match':
      q.left = ex.pairs.map((p) => p[0])
      q.right = shuffle(ex.pairs.map((p) => p[1]), rand)
      break
    case 'tf':
      q.items = ex.items.map((it) => it[0])
      break
    case 'dialog': {
      let s = shuffle(ex.lines, rand)
      for (let k = 0; k < 5 && s.join('|') === ex.lines.join('|'); k++) s = shuffle(ex.lines, rand)
      q.lines = s
      break
    }
    case 'cloze':
      q.parts = clozeParts(ex.text)
      q.gaps = ex.gaps.map((g) => ({ options: g.options.length ? shuffle(g.options, rand) : null }))
      break
    case 'error':
      q.tokens = tokenizeError(ex.text).tokens
      break
    default:
  }
  return q
}

// ---------- генерируемые вопросы ----------

function options(correct, pool, rand) {
  const opts = [correct]
  for (const c of shuffle(pool, rand)) {
    if (!opts.includes(c)) opts.push(c)
    if (opts.length === 4) break
  }
  return shuffle(opts, rand)
}

export function buildQuestion(course, qid, rand = Math.random, poolWords = null) {
  const [kind, ...restParts] = qid.split(':')
  const ref = restParts.join(':')
  if (kind === 'ex') {
    const ex = course.exercises[ref]
    if (!ex) throw new Error(`Нет упражнения ${ref}`)
    return exerciseQuestion(ex, rand, course.contextOf(ref))
  }
  const words = poolWords ?? course.wordList
  if (WORD_KINDS.includes(kind)) {
    const w = course.words[ref]
    if (!w) throw new Error(`Нет слова ${ref}`)
    const ruPool = words.filter((x) => normalize(x.it) !== normalize(w.it)).map((x) => x.ru)
    const itPool = words.filter((x) => normalize(x.ru) !== normalize(w.ru)).map((x) => x.it)
    switch (kind) {
      case 'w2r':
        return { id: qid, type: 'choice', level: 1, speak: w.it, img: w.img, prompt: `Как переводится **${w.it}**?`,
          hint: `${w.cyr} ${w.ipa}`, options: options(w.ru, ruPool, rand) }
      case 'wl':
        return { id: qid, type: 'choice', level: 1, audio: w.it, prompt: '🎧 Послушайте слово и выберите перевод',
          options: options(w.ru, ruPool, rand) }
      case 'wimg': {
        const imgPool = words.filter((x) => x.img && x.img !== w.img && normalize(x.ru) !== normalize(w.ru)).map((x) => x.it)
        return { id: qid, type: 'choice', level: 1, img: w.img, bigImg: true, prompt: 'Что на картинке?',
          options: options(w.it, imgPool.length >= 3 ? imgPool : itPool, rand) }
      }
      case 'r2w':
        return { id: qid, type: 'choice', level: 2, img: w.img, prompt: `Выберите итальянское слово: **${w.ru}**`,
          options: options(w.it, itPool, rand) }
      case 'wd':
        return { id: qid, type: 'input', level: 3, audio: w.it, prompt: '🎧 Диктант: напишите слово, которое услышите',
          hint: 'артикль можно не писать' }
      default: // r2wi
        return { id: qid, type: 'input', level: 3, img: w.img, prompt: `Напишите по-итальянски: **${w.ru}**`,
          hint: withoutArticle(w.it) !== w.it ? 'артикль можно не писать' : '' }
    }
  }
  if (kind === 'wm') {
    const ws = ref.split(',').map((i) => course.words[i]).filter(Boolean)
    return { id: qid, type: 'match', level: 2, prompt: 'Соедините слова и переводы',
      left: ws.map((w) => w.it), right: shuffle(ws.map((w) => w.ru), rand) }
  }
  if (kind === 'vc' || kind === 'vi') {
    const [vid, p] = [ref.slice(0, ref.lastIndexOf(':')), Number(ref.slice(ref.lastIndexOf(':') + 1))]
    const verb = course.verbs[vid]
    if (!verb) throw new Error(`Нет глагола ${vid}`)
    const prompt = `**${verb.inf}** (${verb.ru}) — ${TENSE_RU[verb.tense] ?? verb.tense}.\n\nФорма для **${PERSONS[p]}**:`
    if (kind === 'vi') return { id: qid, type: 'input', level: 3, prompt }
    const correct = verb.forms[p][0]
    const pool = verb.forms.map((f) => f[0]).filter((f) => f !== '—' && f !== correct)
    return { id: qid, type: 'choice', level: 2, prompt, options: shuffle([correct, ...sample(pool, 3, rand)], rand) }
  }
  throw new Error(`Неизвестный тип вопроса ${qid}`)
}

// ---------- проверка ----------

function checkMatch(expected, answer) {
  const text = Object.entries(expected).map(([a, b]) => `${a} — ${b}`).join(' · ')
  if (!answer || typeof answer !== 'object') return { correct: false, expected: text }
  const ok = Object.entries(expected).every(([k, v]) => normalize(answer[k]) === normalize(v))
  return { correct: ok, expected: text }
}

function checkExercise(ex, answer) {
  switch (ex.type) {
    case 'choice':
    case 'odd':
      return { correct: normalize(answer) === normalize(ex.options[ex.answer]), expected: ex.options[ex.answer] }
    case 'input':
      return compareText(answer, ex.answer)
    case 'order': {
      const given = Array.isArray(answer) ? answer.join(' ') : String(answer ?? '')
      return { correct: noPunct(given) === noPunct(ex.answer), expected: ex.answer }
    }
    case 'match':
      return checkMatch(Object.fromEntries(ex.pairs), answer)
    case 'tf': {
      const marks = ex.items.map((it, i) => Array.isArray(answer) && answer[i] === it[1])
      return {
        correct: marks.every(Boolean), marks,
        expected: ex.items.map((it) => `${it[1] ? 'Верно' : 'Неверно'}: ${it[0]}`).join('\n'),
      }
    }
    case 'dialog': {
      const given = Array.isArray(answer) ? answer : []
      return { correct: given.join('\u0001') === ex.lines.join('\u0001'), expected: ex.lines.join('\n') }
    }
    case 'cloze': {
      const given = Array.isArray(answer) ? answer : []
      const marks = ex.gaps.map((g, i) => compareText(given[i] ?? '', g.answers).correct)
      const accentNote = ex.gaps.some((g, i) => marks[i] && !g.answers.map(normalize).includes(normalize(given[i])))
      return {
        correct: marks.every(Boolean), marks,
        expected: ex.gaps.map((g, i) => `${i + 1}) ${g.answers[0]}`).join('  '),
        note: accentNote ? 'Обратите внимание на знаки ударения.' : '',
      }
    }
    case 'error': {
      const { wrongIndex, tokens } = tokenizeError(ex.text)
      return {
        correct: Number(answer) === wrongIndex,
        expected: `«${tokens[wrongIndex]}» → «${ex.answer[1]}»`,
        note: `Правильно: ${ex.text.replace(/\{\{(.+?)=>(.+?)\}\}/, '$2')}`,
      }
    }
    default:
      return { correct: false, expected: '' }
  }
}

export function checkAnswer(course, qid, answer) {
  const [kind, ...restParts] = qid.split(':')
  const ref = restParts.join(':')
  if (kind === 'ex') {
    const ex = course.exercises[ref]
    const v = checkExercise(ex, answer)
    if (ex.explain) v.note = [v.note, ex.explain].filter(Boolean).join(' ')
    return v
  }
  if (WORD_KINDS.includes(kind)) {
    const w = course.words[ref]
    if (kind === 'w2r' || kind === 'wl') return { correct: normalize(answer) === normalize(w.ru), expected: w.ru }
    if (kind === 'r2w' || kind === 'wimg') return { correct: normalize(answer) === normalize(w.it), expected: w.it }
    const synonyms = course.wordList.filter((x) => x !== w && normalize(x.ru) === normalize(w.ru))
    const v = compareText(answer, [...wordAnswers(w), ...synonyms.flatMap(wordAnswers)])
    return { ...v, expected: w.it }
  }
  if (kind === 'wm') {
    const ws = ref.split(',').map((i) => course.words[i]).filter(Boolean)
    return checkMatch(Object.fromEntries(ws.map((w) => [w.it, w.ru])), answer)
  }
  if (kind === 'vc' || kind === 'vi') {
    const vid = ref.slice(0, ref.lastIndexOf(':'))
    const forms = course.verbs[vid].forms[Number(ref.slice(ref.lastIndexOf(':') + 1))]
    const v = compareText(answer, forms)
    return { ...v, expected: forms.join(' / ') }
  }
  throw new Error(`Неизвестный тип вопроса ${qid}`)
}

/** Слово, к которому относится вопрос (для интервального повторения). */
export function wordOf(qid) {
  const [kind, id] = qid.split(':')
  return WORD_KINDS.includes(kind) ? id : null
}

// ---------- наборы вопросов ----------

export function lessonPractice(course, lesson, seed) {
  const rand = rng(seed)
  const unit = course.unitOf(lesson.key)
  const unitWords = unit.lessons.flatMap((l) => l.words ?? [])
  const pool = unitWords.length >= 8 ? unitWords : course.wordList
  const ctx = { dialogue: lesson.dialogue, reading: lesson.reading }
  const qs = [...(lesson.exercises ?? [])]
    .sort((a, b) => a.level - b.level)
    .map((ex) => exerciseQuestion(ex, rand, ctx))
  const words = lesson.words ?? []
  if (words.length >= 4) {
    const s = sample(words, Math.min(5, words.length), rand)
    const withImg = s.filter((w) => w.img)
    const vocab = [
      buildQuestion(course, `w2r:${s[0].id}`, rand, pool),
      buildQuestion(course, `${withImg[0] ? 'wimg' : 'wl'}:${(withImg[0] ?? s[1]).id}`, rand, pool),
      buildQuestion(course, `wl:${s[2].id}`, rand, pool),
      buildQuestion(course, `r2w:${s[3].id}`, rand, pool),
    ]
    return [...vocab.slice(0, 2), ...qs.slice(0, 4), ...vocab.slice(2), ...qs.slice(4)]
  }
  return qs
}

export function generateTest(course, unitIds, level, count = 15, seed) {
  const rand = rng(seed)
  const units = course.units.filter((u) => unitIds.includes(u.id))
  if (!units.length) throw new Error('Выберите хотя бы один юнит')
  const words = units.flatMap((u) => u.lessons.flatMap((l) => l.words ?? []))
  const pool = words.length >= 8 ? words : course.wordList
  const exercises = units.flatMap((u) => u.lessons.flatMap((l) => l.exercises ?? []))
  const verbs = units.flatMap((u) => u.verbs)

  const allowed = { 1: [1], 2: [1, 2], 3: [2, 3] }[level]
  let exPool = shuffle(exercises.filter((e) => allowed.includes(e.level)), rand)
  if (level > 1) exPool = [...exPool.filter((e) => e.level === level), ...exPool.filter((e) => e.level !== level)]

  const nVerbs = level > 1 ? Math.min(verbs.length, Math.floor(count / 6)) : 0
  const nVocab = Math.min(words.length, Math.max(2, Math.floor((count * 3) / 10)))
  const nEx = Math.max(0, count - nVerbs - nVocab)

  const qids = exPool.slice(0, nEx).map((e) => `ex:${e.id}`)
  const vw = sample(words, Math.min(words.length, nVocab + 5), rand)
  if (level === 1) {
    vw.slice(0, nVocab).forEach((w, i) => qids.push(`${['w2r', w.img ? 'wimg' : 'wl', 'wl'][i % 3]}:${w.id}`))
  } else if (level === 2) {
    const half = Math.floor(nVocab / 2)
    vw.slice(0, half).forEach((w) => qids.push(`r2w:${w.id}`))
    const group = vw.slice(half, half + 5)
    if (group.length >= 3 && new Set(group.map((w) => w.ru)).size === group.length && new Set(group.map((w) => w.it)).size === group.length)
      qids.push(`wm:${group.map((w) => w.id).join(',')}`)
    vw.slice(half + 5, half + 5 + (nVocab - half - 1)).forEach((w) => qids.push(`wl:${w.id}`))
  } else {
    vw.slice(0, nVocab).forEach((w, i) => qids.push(`${i % 3 === 2 ? 'wd' : 'r2wi'}:${w.id}`))
  }
  for (const verb of sample(verbs, nVerbs, rand)) {
    const persons = verb.forms.map((f, i) => (f[0] !== '—' ? i : -1)).filter((i) => i >= 0)
    qids.push(`${level === 2 ? 'vc' : 'vi'}:${verb.id}:${persons[Math.floor(rand() * persons.length)]}`)
  }
  const used = new Set(qids.map((q) => q.split(':')[1]))
  for (const w of shuffle(words, rand)) {
    if (qids.length >= count) break
    if (!used.has(w.id)) qids.push(`${['w2r', 'r2w', 'r2wi'][level - 1]}:${w.id}`)
  }
  return shuffle(qids, rand).slice(0, count).map((id) => buildQuestion(course, id, rand, pool))
}

export function wordsDrill(course, words, mode, seed) {
  const rand = rng(seed)
  const kind = { choice: 'w2r', reverse: 'r2w', write: 'r2wi', listen: 'wl', dictation: 'wd', picture: 'wimg' }[mode] ?? 'w2r'
  const unitIds = new Set(words.map((w) => w.unit_id))
  const pool = course.wordList.filter((w) => unitIds.has(w.unit_id))
  return words.map((w) => buildQuestion(course, `${kind === 'wimg' && !w.img ? 'w2r' : kind}:${w.id}`, rand, pool.length >= 8 ? pool : null))
}

export function progressTestQuestions(course, test, seed) {
  const rand = rng(seed)
  return test.sections.map((s) => ({
    ...s,
    questions: s.exercises.map((ex) => exerciseQuestion(ex, rand, { reading: s.reading })),
  }))
}
