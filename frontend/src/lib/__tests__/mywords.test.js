import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { indexCourse } from '../course'
import { dictCounts, dictEntries, examplesFor, explainWord, guessPlural } from '../mywords'
import { LEARN_STREAK, applyResult, dictStatus, emptyProgress, review, setDict } from '../progress'

const course = indexCourse(JSON.parse(readFileSync(new URL('../../../public/data/course.json', import.meta.url), 'utf8')))

describe('личный словарь: правила разделов', () => {
  it('слово попадает в «Изучаю» и уходит из словаря', () => {
    const row = setDict(undefined, 'learning')
    expect(dictStatus(row)).toBe('learning')
    expect(dictStatus(setDict(row, null))).toBe(null)
  })

  it(`${LEARN_STREAK} верных ответа подряд — «Выучено», ошибка — снова «Изучаю»`, () => {
    let row = setDict(undefined, 'learning')
    for (let i = 0; i < LEARN_STREAK - 1; i++) {
      row = review(row, true)
      expect(dictStatus(row)).toBe('learning')
    }
    row = review(row, true)
    expect(dictStatus(row)).toBe('learned')
    row = review(row, false)
    expect(dictStatus(row)).toBe('learning')
    expect(row.streak).toBe(0)
  })

  it('ошибка сбрасывает серию: нужно снова три верных подряд', () => {
    let row = setDict(undefined, 'learning')
    row = review(review(row, true), true)
    row = review(row, false)
    row = review(review(row, true), true)
    expect(dictStatus(row)).toBe('learning')
  })

  it('слова вне словаря не попадают в него от упражнений', () => {
    expect(dictStatus(review(undefined, false))).toBe(null)
    expect(dictStatus(review(undefined, true))).toBe(null)
  })

  it('ручной перенос в «Выучено» и старое «избранное»', () => {
    expect(dictStatus(setDict(undefined, 'learned'))).toBe('learned')
    expect(dictStatus({ favorite: true })).toBe('learning')
  })

  it('ошибка в тесте возвращает выученное слово в «Изучаю»', () => {
    const id = course.wordList[0].id
    const p = emptyProgress()
    p.words[id] = setDict(undefined, 'learned')
    applyResult(p, { kind: 'unit', scope: '0', score: 0, total: 1, words: [{ id, correct: false }] })
    expect(dictStatus(p.words[id])).toBe('learning')
  })
})

describe('личный словарь: список и объяснения', () => {
  it('объединяет слова курса и свои слова', () => {
    const p = emptyProgress()
    const w = course.wordList[3]
    p.words[w.id] = setDict(undefined, 'learning')
    p.custom = [{ id: 'c:1', it: 'la farfalla', ru: 'бабочка', note: '', example: 'Una farfalla gialla.' }]
    p.words['c:1'] = setDict(undefined, 'learned')
    const all = dictEntries(course, p)
    expect(all.map((e) => e.id).sort()).toEqual([w.id, 'c:1'].sort())
    expect(dictCounts(course, p)).toEqual({ all: 2, learning: 1, learned: 1 })
  })

  it('множественное число по правилам', () => {
    expect(guessPlural('libro', 'm')).toBe('i libri')
    expect(guessPlural('casa', 'f')).toBe('le case')
    expect(guessPlural('studente', 'm')).toBe('gli studenti')
    expect(guessPlural('città', 'f')).toBe('le città')
    expect(guessPlural('amica', 'f')).toBe('le amiche')
    expect(guessPlural('problema', 'm')).toBe('i problemi')
    expect(guessPlural('camicia', 'f')).toBe('le camicie')
    expect(guessPlural('arancia', 'f')).toBe('le arance')
    expect(guessPlural('uomo', 'm')).toBe('gli uomini')
    expect(guessPlural('zaino', 'm')).toBe('gli zaini')
  })

  it('объяснение: род, множественное число, спряжение', () => {
    const noun = explainWord(course, { it: 'il libro', ru: 'книга', custom: true })
    expect(noun.lines.join(' ')).toMatch(/мужского рода/)
    expect(noun.lines.join(' ')).toMatch(/i libri/)
    const verb = explainWord(course, { it: 'parlare', ru: 'говорить', custom: true })
    expect(verb.lines.join(' ')).toMatch(/I спряжения/)
  })

  it('к словам курса находятся примеры из уроков с переводом', () => {
    const w = course.wordList.find((x) => x.it === 'il caffè') ?? course.wordList.find((x) => /caff/.test(x.it))
    const ex = examplesFor(course, { ...w, lesson_key: `${w.unit_id}.${w.lesson_slug}` })
    expect(ex.length).toBeGreaterThan(0)
    expect(ex[0].ru).toBeTruthy()
  })

  it('объяснение строится для каждого слова курса без ошибок', () => {
    for (const w of course.wordList) {
      const e = explainWord(course, { ...w, lesson_key: `${w.unit_id}.${w.lesson_slug}`, custom: false })
      expect(e.lesson).toBeTruthy()
    }
  })
})
