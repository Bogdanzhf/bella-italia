// Личный словарь: слова курса и свои слова в одном виде + объяснение к каждому слову.

import { dictStatus } from './progress'
import { normalize, stripAccents } from './quiz'

/** Все слова словаря: { id, it, ru, cyr, ipa, img, note, example, custom, unit_id, lesson_key, row, status }. */
export function dictEntries(course, progress) {
  const out = []
  const custom = new Map((progress.custom ?? []).map((c) => [c.id, c]))
  for (const [id, row] of Object.entries(progress.words)) {
    const status = dictStatus(row)
    if (!status) continue
    const w = course.words[id]
    if (w) {
      out.push({ ...w, lesson_key: `${w.unit_id}.${w.lesson_slug}`, custom: false, row, status })
    } else if (custom.has(id)) {
      out.push({ ...custom.get(id), custom: true, row, status })
    }
  }
  return out.sort((a, b) => (b.row.dict_added_at ?? '').localeCompare(a.row.dict_added_at ?? ''))
}

/** Слово курса или своё слово по id (для тренировки). */
export function entryById(course, progress, id) {
  if (course.words[id]) {
    const w = course.words[id]
    return { ...w, lesson_key: `${w.unit_id}.${w.lesson_slug}`, custom: false, row: progress.words[id], status: dictStatus(progress.words[id]) }
  }
  const c = (progress.custom ?? []).find((x) => x.id === id)
  return c ? { ...c, custom: true, row: progress.words[id], status: dictStatus(progress.words[id]) } : null
}

export function dictCounts(course, progress) {
  const all = dictEntries(course, progress)
  return { all: all.length, learning: all.filter((e) => e.status === 'learning').length, learned: all.filter((e) => e.status === 'learned').length }
}

// ---------- объяснение слова ----------

const ARTICLES = [
  [/^(il|lo)\s+/i, 'm', 'sg'],
  [/^(i|gli)\s+/i, 'm', 'pl'],
  [/^la\s+/i, 'f', 'sg'],
  [/^le\s+/i, 'f', 'pl'],
  [/^(un|uno)\s+/i, 'm', 'sg'],
  [/^una\s+/i, 'f', 'sg'],
  [/^un['’]/i, 'f', 'sg'],
  [/^l['’]/i, null, 'sg'],
]

// существительные, у которых множественное число не по общему правилу
const PLURAL_EXCEPTIONS = {
  uomo: 'gli uomini', uovo: 'le uova', mano: 'le mani', dio: 'gli dei', braccio: 'le braccia', dito: 'le dita',
  ginocchio: 'le ginocchia', labbro: 'le labbra', osso: 'le ossa', paio: 'le paia', centinaio: 'le centinaia',
  migliaio: 'le migliaia', lenzuolo: 'le lenzuola', amico: 'gli amici', greco: 'i greci', medico: 'i medici',
  porco: 'i porci', cinema: 'i cinema', foto: 'le foto', radio: 'le radio', moto: 'le moto', auto: 'le auto',
  bici: 'le bici', moglie: 'le mogli', ala: 'le ali', arma: 'le armi', bue: 'i buoi', zio: 'gli zii', re: 'i re',
}

const VOWEL = /^[aeiouàèéìòù]/i

function pluralArticle(gender, bare) {
  if (gender === 'f') return 'le'
  if (VOWEL.test(bare) || /^(s[^aeiou]|z|gn|ps|pn|x|y)/i.test(bare)) return 'gli'
  return 'i'
}

/** Множественное число по общим правилам (null, если правило не подходит). */
export function guessPlural(bare, gender) {
  const low = bare.toLowerCase()
  if (PLURAL_EXCEPTIONS[low]) return PLURAL_EXCEPTIONS[low]
  if (bare.includes(' ')) return null
  let pl
  if (/[àèéìòù]$/i.test(bare) || /[^aeiou]$/i.test(bare) || /i$/i.test(bare)) pl = bare // città, sport, crisi — не меняются
  else if (/ca$/i.test(bare)) pl = gender === 'm' ? bare.replace(/ca$/i, 'chi') : bare.replace(/ca$/i, 'che')
  else if (/ga$/i.test(bare)) pl = gender === 'm' ? bare.replace(/ga$/i, 'ghi') : bare.replace(/ga$/i, 'ghe')
  else if (/(cia|gia)$/i.test(bare)) pl = /[aeiou](cia|gia)$/i.test(bare) ? bare.replace(/a$/i, 'e') : bare.replace(/ia$/i, 'e')
  else if (/(co|go)$/i.test(bare)) pl = bare.replace(/o$/i, 'hi')
  else if (/io$/i.test(bare)) pl = bare.replace(/io$/i, 'i')
  else if (/a$/i.test(bare)) pl = gender === 'm' ? bare.replace(/a$/i, 'i') : bare.replace(/a$/i, 'e')
  else if (/[oe]$/i.test(bare)) pl = bare.replace(/[oe]$/i, 'i')
  else return null
  return `${pluralArticle(gender, pl)} ${pl}`
}

const VERB_GROUPS = [
  [/(arsi|ersi|irsi)$/i, 'возвратный глагол: в спряжении появляются mi, ti, si, ci, vi, si; в прошедшем — вспомогательный essere'],
  [/are$/i, 'глагол I спряжения (-are): io parlo, tu parli, lui parla…'],
  [/ere$/i, 'глагол II спряжения (-ere): io prendo, tu prendi, lui prende…'],
  [/ire$/i, 'глагол III спряжения (-ire): io parto, tu parti… или с -isc-: io finisco, tu finisci…'],
]

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Примеры из курса: фразы и реплики диалогов, где встречается слово. */
export function examplesFor(course, entry, limit = 2) {
  const bare = entry.it.replace(/^(il|lo|la|i|gli|le|un|uno|una)\s+|^(l|un)['’]/i, '').trim()
  if (bare.length < 3) return []
  const base = stripAccents(normalize(bare))
  const isVerb = /(are|ere|ire|rsi)$/i.test(bare) && !bare.includes(' ')
  const stem = isVerb ? base.replace(/(arsi|ersi|irsi|are|ere|ire)$/, '') : null
  const re = isVerb && stem.length >= 3 ? new RegExp(`\\b${escape(stem)}[a-zàèéìòù]*`, 'i') : new RegExp(`(^|[^a-zà-ù])${escape(base)}([^a-zà-ù]|$)`, 'i')
  const found = []
  const consider = (it, ru, lesson) => {
    if (found.length >= limit * 4 || !it || !ru) return
    if (re.test(stripAccents(normalize(it)))) found.push({ it, ru, lesson, same: lesson?.unit_id === entry.unit_id })
  }
  for (const les of course.flatLessons) {
    for (const ph of les.phrases ?? []) consider(ph.it, ph.ru, les)
    for (const l of les.dialogue?.lines ?? []) consider(l.it, l.ru, les)
  }
  found.sort((a, b) => Number(b.same) - Number(a.same) || a.it.length - b.it.length)
  return found.slice(0, limit)
}

/**
 * Объяснение к слову для карточки: часть речи и род, множественное число, подсказка по спряжению,
 * заметка, примеры из уроков и урок, где слово встречается.
 */
export function explainWord(course, entry) {
  const lines = []
  const it = entry.it.trim()
  const art = ARTICLES.find(([re]) => re.test(it))
  if (art) {
    const gender = art[1] ?? entry.gender ?? null
    const bare = it.replace(art[0], '')
    const g = gender === 'm' ? 'мужского рода' : gender === 'f' ? 'женского рода' : ''
    lines.push(`Существительное${g ? ' ' + g : ''}${art[2] === 'pl' ? ', во множественном числе' : ''}.`)
    if (art[2] === 'sg' && gender && !/мн\.?\s*ч/i.test(entry.note ?? '')) {
      const pl = guessPlural(bare, gender)
      if (pl && pl.toLowerCase() !== it.toLowerCase()) lines.push(`Множественное число: ${pl}.`)
    }
  } else if (!it.includes(' ')) {
    const group = VERB_GROUPS.find(([re]) => re.test(it))
    if (group) lines.push(`Это ${group[1]}.`)
  } else if (/[?!.]$/.test(it) || it.split(' ').length > 2) {
    lines.push('Готовое выражение — запоминайте его целиком.')
  }
  if (entry.note) lines.push(`Заметка: ${entry.note}.`)
  const examples = entry.custom
    ? entry.example ? [{ it: entry.example, ru: '' }] : []
    : examplesFor(course, entry)
  const lesson = entry.custom ? null : course.lessons[entry.lesson_key]
  return { lines, examples, lesson }
}
