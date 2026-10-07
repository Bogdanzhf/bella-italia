import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { generateTest } from '../lib/quiz'
import { useApp } from '../state'
import { Butterfly } from '../components/Decor'
import Quiz from '../components/Quiz'
import VerbTable from '../components/VerbTable'
import { LEVELS, ProgressBar } from '../components/ui'

export const KIND = {
  dialogue: { label: 'Диалог', icon: '💬' },
  lesson: { label: 'Урок', icon: '📖' },
  grammar: { label: 'Грамматика', icon: '✏️' },
  culture: { label: 'Культура', icon: '🏛️' },
  review: { label: 'Повторение', icon: '🌟' },
}

export default function Unit() {
  const { unitId } = useParams()
  const { course, progress } = useApp()
  const [test, setTest] = useState(null)
  const unit = course.unit(unitId)
  if (!unit) return <p className="empty">Юнит не найден 🥀</p>

  const done = unit.lessons.filter((l) => progress.lessons[l.key]?.completed).length
  const progressTest = (course.tests ?? []).find((t) => Math.max(...t.units) === unit.id)
  const start = (level) => setTest({ level, questions: generateTest(course, [unit.id], level, 15, Date.now()), n: Date.now() })

  if (test) {
    const lvl = LEVELS.find((l) => l.level === test.level)
    return (
      <div>
        <button className="link-back" onClick={() => setTest(null)}>← К юниту</button>
        <Quiz key={test.n} questions={test.questions} title={`Тест по юниту ${unit.id} · ${lvl.icon} ${lvl.name}`}
          meta={{ kind: 'unit', scope: String(unit.id), title: `Юнит ${unit.id}: ${unit.title_it}`, level: test.level }}
          onRestart={() => start(test.level)} />
      </div>
    )
  }

  return (
    <div>
      <Link to="/course" className="link-back">← Все юниты</Link>
      <section className="unit-hero card">
        <div className="unit-hero-icon">{unit.icon}</div>
        <div className="grow">
          <div className="unit-num">Юнит {unit.id} · <span className={`level-badge lv-${unit.level}`}>{unit.level}</span></div>
          <h1>{unit.title_it}</h1>
          <div className="unit-ru">{unit.title_ru}</div>
          <p>{unit.description}</p>
          <ProgressBar value={done} max={unit.lessons.length} label="Прогресс юнита" />
          <p className="muted small">Пройдено уроков: {done} из {unit.lessons.length}</p>
        </div>
        <Butterfly size={50} className="float f2 unit-butterfly" />
      </section>

      <div className="two-col wide-left">
        <section className="card">
          <h2>Уроки</h2>
          <ol className="lesson-list">
            {unit.lessons.map((l, i) => {
              const p = progress.lessons[l.key]
              const kind = KIND[l.kind] ?? KIND.lesson
              return (
                <li key={l.key}>
                  <Link to={`/lesson/${unit.id}/${l.slug}`} className={`lesson-item ${p?.completed ? 'done' : ''}`}>
                    <span className="lesson-num">{p?.completed ? '🌸' : i + 1}</span>
                    <span className="lesson-titles">
                      <b>{l.title_ru}</b>
                      <i>{l.title_it}</i>
                    </span>
                    <span className="lesson-meta">
                      <span className={`kind kind-${l.kind}`}>{kind.icon} {kind.label}</span>
                      {p?.best_score > 0 && <span className="score-pill">{p.best_score}%</span>}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>

        <aside>
          <section className="card">
            <h2>Цели юнита</h2>
            <ul className="goals">{unit.goals.map((g) => <li key={g}>{g}</li>)}</ul>
          </section>
          <section className="card">
            <h2>Тест по юниту</h2>
            <p className="muted small">15 вопросов по всем урокам: упражнения, слова, глаголы и аудирование.</p>
            <div className="level-buttons">
              {LEVELS.map((l) => (
                <button key={l.level} className={`level-btn lb-${l.level}`} onClick={() => start(l.level)}>
                  <span className="lb-icon">{l.icon}</span>
                  <span><b>{l.name}</b><small>{l.hint}</small></span>
                </button>
              ))}
            </div>
            {progressTest && (
              <Link to={`/tests/progress/${progressTest.id}`} className="progress-test-link">
                🎓 <span><b>{progressTest.title}</b><small>чтение, аудирование, грамматика, письмо</small></span>
              </Link>
            )}
          </section>
          <section className="card">
            <h2>Игры по юниту 🎲</h2>
            <div className="mini-games">
              <Link to={`/games/memory?unit=${unit.id}`} className="chip">🃏 Memory</Link>
              <Link to={`/games/crossword?unit=${unit.id}`} className="chip">✏️ Кроссворд</Link>
              <Link to={`/games/wordsearch?unit=${unit.id}`} className="chip">🔍 Найди слова</Link>
              <Link to={`/games/hangman?unit=${unit.id}`} className="chip">🌷 Угадай слово</Link>
            </div>
          </section>
        </aside>
      </div>

      {unit.verbs.length > 0 && (
        <section className="card">
          <h2>Глаголы юнита 🦋</h2>
          <div className="verb-grid">{unit.verbs.map((v) => <VerbTable key={v.id} verb={v} />)}</div>
        </section>
      )}
    </div>
  )
}
