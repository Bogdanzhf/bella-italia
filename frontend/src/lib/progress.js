// Правила прогресса, общие для обоих режимов (на сервере они продублированы в main.py).

export const PASS_PERCENT = 70
export const BOX_DAYS = [0, 1, 2, 4, 8, 16]
export const LEARNED_BOX = 3
/** Сколько верных ответов подряд нужно, чтобы слово из «Изучаю» перешло в «Выучено». */
export const LEARN_STREAK = 3
export const DICT_STATUSES = ['learning', 'learned']

export const emptyProgress = () => ({ lessons: {}, words: {}, custom: [], results: [], activity: {} })

/** Раздел личного словаря: 'learning' | 'learned' | null. Старое «избранное» считается «Изучаю». */
export function dictStatus(row) {
  if (!row) return null
  if (row.dict) return row.dict
  return row.favorite ? 'learning' : null
}

/** Ручное перемещение слова в раздел словаря (или удаление из словаря при status = null). */
export function setDict(row, status) {
  const r = { box: 0, correct: 0, wrong: 0, streak: 0, due_at: new Date().toISOString(), ...row }
  r.dict = status
  r.favorite = false
  r.streak = status === 'learned' ? LEARN_STREAK : 0
  if (status) r.dict_added_at = r.dict_added_at ?? new Date().toISOString()
  else delete r.dict_added_at
  return r
}

export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function review(row, known) {
  const r = { box: 0, favorite: false, correct: 0, wrong: 0, streak: 0, ...row }
  if (known) {
    r.correct += 1
    r.box = Math.min(r.box + 1, BOX_DAYS.length - 1)
  } else {
    r.wrong += 1
    r.box = 0
  }
  r.due_at = new Date(Date.now() + BOX_DAYS[r.box] * 86400000).toISOString()
  // личный словарь: ошибка возвращает слово в «Изучаю», серия верных ответов — переводит в «Выучено»
  const status = dictStatus(r)
  if (status) {
    r.streak = known ? r.streak + 1 : 0
    r.dict = !known ? 'learning' : r.streak >= LEARN_STREAK ? 'learned' : status
    r.favorite = false
  }
  return r
}

export function addActivity(p, points) {
  const d = today()
  p.activity[d] = (p.activity[d] ?? 0) + Math.max(0, points)
}

/** Применяет результат теста к прогрессу (локальный режим). */
export function applyResult(p, r) {
  const percent = Math.round((r.score * 100) / r.total)
  let completed = false
  if (r.kind === 'lesson') {
    const row = p.lessons[r.scope] ?? { theory_read: false, best_score: 0, completed: false }
    row.best_score = Math.max(row.best_score, percent)
    if (percent >= PASS_PERCENT) row.completed = completed = true
    p.lessons[r.scope] = row
  }
  for (const w of r.words ?? []) p.words[w.id] = review(p.words[w.id], w.correct)
  p.results.unshift({
    id: Date.now(), kind: r.kind, scope: r.scope, title: r.title || r.scope, level: r.level,
    score: r.score, total: r.total, created_at: new Date().toISOString(),
  })
  p.results = p.results.slice(0, 200)
  addActivity(p, 10 + r.score)
  return { percent, passed: percent >= PASS_PERCENT, lesson_completed: completed }
}

export const isDue = (row) => row && (row.correct || row.wrong) && new Date(row.due_at) <= new Date()
export const isLearned = (row) => (row?.box ?? 0) >= LEARNED_BOX
export const isSeen = (row) => Boolean(row && (row.correct || row.wrong))
