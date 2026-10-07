import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { indexCourse } from '../course'
import {
  buildQuestion, checkAnswer, exerciseQuestion, generateTest, lessonPractice, normalize, progressTestQuestions, rng, wordsDrill,
} from '../quiz'
import { applyResult, emptyProgress, review } from '../progress'

const course = indexCourse(JSON.parse(readFileSync(new URL('../../../public/data/course.json', import.meta.url), 'utf8')))

/** Правильный ответ на упражнение в том виде, в каком его даёт интерфейс. */
function rightAnswer(ex) {
  switch (ex.type) {
    case 'choice':
    case 'odd':
      return ex.options[ex.answer]
    case 'input':
      return ex.answer[0]
    case 'order':
      return ex.answer
    case 'match':
      return Object.fromEntries(ex.pairs)
    case 'tf':
      return ex.items.map((i) => i[1])
    case 'dialog':
      return ex.lines
    case 'cloze':
      return ex.gaps.map((g) => g.answers[0])
    case 'error':
      // индекс отмеченного слова {{…=>…}} среди слов предложения
      return ex.text.split(/\s+/).findIndex((t) => t.startsWith('{{'))
    default:
      throw new Error(ex.type)
  }
}

describe('упражнения курса', () => {
  const all = Object.values(course.exercises)

  it('курс не пустой', () => {
    expect(course.units.length).toBe(12)
    expect(all.length).toBeGreaterThan(500)
  })

  it('тексты юнитов и уроков — строки (React не отрисует объект)', () => {
    for (const u of course.units) {
      for (const g of u.goals) expect(typeof g).toBe('string')
      for (const l of u.lessons) {
        expect(typeof l.title_ru).toBe('string')
        expect(typeof l.title_it).toBe('string')
      }
    }
  })

  it('каждое упражнение принимает свой правильный ответ', () => {
    for (const ex of all) {
      const v = checkAnswer(course, `ex:${ex.id}`, rightAnswer(ex))
      expect(v.correct, `${ex.id}: ${ex.q}`).toBe(true)
    }
  })

  it('неверный ответ не засчитывается', () => {
    for (const ex of all.filter((e) => e.type === 'choice').slice(0, 50)) {
      const wrong = ex.options.find((_, i) => i !== ex.answer)
      expect(checkAnswer(course, `ex:${ex.id}`, wrong).correct).toBe(false)
    }
  })

  it('вопросы для интерфейса не раскрывают ответ', () => {
    for (const ex of all) {
      const q = exerciseQuestion(ex, rng(1))
      expect(q.answer).toBeUndefined()
      expect(q.pairs).toBeUndefined()
    }
  })
})

describe('проверка ввода', () => {
  it('нормализует регистр, пробелы и апострофы', () => {
    expect(normalize('  L’AMICO ')).toBe("l'amico")
    expect(normalize("l ' amico.")).toBe("l'amico")
  })

  it('принимает ответ без ударения с подсказкой', () => {
    const strip = (s) => s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    const ex = Object.values(course.exercises).find(
      (e) => e.type === 'input' && e.answer.every((a) => strip(a) !== a) && !e.answer.some((a) => e.answer.includes(strip(a))),
    )
    const v = checkAnswer(course, `ex:${ex.id}`, strip(ex.answer[0]))
    expect(v.correct).toBe(true)
    expect(v.note).toMatch(/ударени/)
  })

  it('слово можно писать без артикля, синонимы засчитываются', () => {
    const w = course.wordList.find((x) => x.it === 'il gelato')
    expect(checkAnswer(course, `r2wi:${w.id}`, 'gelato').correct).toBe(true)
    expect(checkAnswer(course, `r2wi:${w.id}`, 'gelata').correct).toBe(false)
    const abitare = course.wordList.find((x) => x.it === 'abitare')
    const vivere = course.wordList.find((x) => x.it === 'vivere')
    if (abitare && vivere && normalize(abitare.ru) === normalize(vivere.ru)) {
      expect(checkAnswer(course, `r2wi:${abitare.id}`, 'vivere').correct).toBe(true)
    }
  })
})

describe('генерация', () => {
  it.each([1, 2, 3])('тест уровня %i решаем и без повторов', (level) => {
    for (let seed = 1; seed <= 8; seed++) {
      const ids = course.units.slice(0, (seed % 12) + 1).map((u) => u.id)
      const qs = generateTest(course, ids, level, 15, seed)
      expect(qs).toHaveLength(15)
      expect(new Set(qs.map((q) => q.id)).size).toBe(15)
      for (const q of qs) {
        if (q.type === 'choice') {
          expect(new Set(q.options).size).toBe(q.options.length)
          expect(q.options.some((o) => checkAnswer(course, q.id, o).correct), q.id).toBe(true)
        }
      }
    }
  })

  it('практика урока содержит все его упражнения', () => {
    const les = course.units[1].lessons.find((l) => l.slug === 'presente-regolare')
    const qs = lessonPractice(course, les, 3)
    const ids = new Set(qs.map((q) => q.id))
    for (const ex of les.exercises) expect(ids.has(`ex:${ex.id}`)).toBe(true)
  })

  it('тренировка слов во всех режимах', () => {
    const words = course.units[2].lessons.find((l) => (l.words?.length ?? 0) >= 6).words.slice(0, 6)
    for (const mode of ['choice', 'reverse', 'write', 'listen', 'dictation', 'picture']) {
      const qs = wordsDrill(course, words, mode, 5)
      expect(qs).toHaveLength(6)
    }
  })

  it('глаголы: выбор формы решаем', () => {
    for (const v of course.verbList.slice(0, 30)) {
      const p = v.forms.findIndex((f) => f[0] !== '—')
      const q = buildQuestion(course, `vc:${v.id}:${p}`, rng(2))
      expect(q.options.some((o) => checkAnswer(course, q.id, o).correct)).toBe(true)
    }
  })

  it('тесты прогресса собираются', () => {
    for (const t of course.tests ?? []) {
      const sections = progressTestQuestions(course, t, 1)
      expect(sections.flatMap((s) => s.questions).length).toBeGreaterThan(5)
    }
  })
})

describe('прогресс', () => {
  it('коробки Лейтнера', () => {
    let row = review(undefined, true)
    row = review(row, true)
    row = review(row, true)
    expect(row.box).toBe(3)
    expect(review(row, false).box).toBe(0)
  })

  it('урок засчитывается от 70%', () => {
    const p = emptyProgress()
    expect(applyResult(p, { kind: 'lesson', scope: '0.alfabeto', score: 6, total: 10, level: 1 }).lesson_completed).toBe(false)
    expect(applyResult(p, { kind: 'lesson', scope: '0.alfabeto', score: 7, total: 10, level: 1 }).lesson_completed).toBe(true)
    expect(p.lessons['0.alfabeto'].best_score).toBe(70)
  })
})
