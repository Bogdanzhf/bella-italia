import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LEVEL_NAMES, generateTest } from '../lib/quiz'
import { useApp } from '../state'
import { Castle } from '../components/Decor'
import Quiz from '../components/Quiz'
import { ErrorBox, LEVELS } from '../components/ui'

const KIND_RU = { lesson: 'практика', unit: 'юнит', final: 'свой тест', words: 'слова', progress: 'тест прогресса', game: 'игра', verbs: 'глаголы' }

export default function Tests() {
  const { course, progress } = useApp()
  const started = course.units.filter((u) => u.lessons.some((l) => progress.lessons[l.key])).map((u) => u.id)
  const [selected, setSelected] = useState(started.length ? started : [0])
  const [level, setLevel] = useState(1)
  const [count, setCount] = useState(20)
  const [test, setTest] = useState(null)
  const [error, setError] = useState(null)

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].sort((a, b) => a - b)))
  function start() {
    setError(null)
    try {
      setTest({ questions: generateTest(course, selected, level, count, Date.now()), n: Date.now() })
    } catch (e) {
      setError(e)
    }
  }

  if (test) {
    const lvl = LEVELS.find((l) => l.level === level)
    const scope = selected.join(',')
    return (
      <div>
        <button className="link-back" onClick={() => setTest(null)}>← К тестам</button>
        <Quiz key={test.n} questions={test.questions} title={`${lvl.icon} ${lvl.name} · юниты ${scope}`}
          meta={{ kind: 'final', scope, title: `Тест: юниты ${scope}`, level }} onRestart={start} />
      </div>
    )
  }

  const bestOf = (id) => Math.max(0, ...progress.results.filter((r) => r.kind === 'progress' && r.scope === id).map((r) => Math.round((r.score * 100) / r.total)))

  return (
    <div>
      <div className="page-head with-art">
        <div>
          <h1>Тесты 🏆</h1>
          <p className="muted">Тесты прогресса — как в учебнике, после каждых трёх юнитов. А ещё можно собрать свой тест из любых юнитов и уровня сложности.</p>
        </div>
        <Castle size={150} />
      </div>

      {(course.tests ?? []).length > 0 && (
        <section className="card">
          <h2>Тесты прогресса 🎓</h2>
          <div className="progress-tests">
            {course.tests.map((t) => {
              const best = bestOf(t.id)
              return (
                <Link key={t.id} to={`/tests/progress/${t.id}`} className="ptest">
                  <b>{t.title}</b>
                  <small>{t.description}</small>
                  {best > 0 && <span className={`score-pill ${best >= 70 ? 'ok' : ''}`}>лучший: {best}%</span>}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <div className="card setup">
        <h2>Свой тест: 1. Юниты</h2>
        <div className="unit-chips">
          {course.units.map((u) => (
            <button key={u.id} className={selected.includes(u.id) ? 'chip chip-on' : 'chip'} onClick={() => toggle(u.id)} aria-pressed={selected.includes(u.id)}>
              {u.icon} {u.id}. {u.title_it}
            </button>
          ))}
        </div>
        <div className="row-gap">
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(course.units.map((u) => u.id))}>Выбрать все</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>Сбросить</button>
        </div>
        <h2>2. Уровень сложности</h2>
        <div className="level-buttons horizontal">
          {LEVELS.map((l) => (
            <button key={l.level} className={`level-btn lb-${l.level} ${level === l.level ? 'active' : ''}`} onClick={() => setLevel(l.level)} aria-pressed={level === l.level}>
              <span className="lb-icon">{l.icon}</span>
              <span><b>{l.name}</b><small>{l.hint}</small></span>
            </button>
          ))}
        </div>
        <h2>3. Количество вопросов</h2>
        <div className="seg">
          {[10, 20, 30, 40].map((n) => <button key={n} className={count === n ? 'active' : ''} onClick={() => setCount(n)}>{n}</button>)}
        </div>
        <ErrorBox error={error} />
        <button className="btn btn-big" disabled={!selected.length} onClick={start}>Начать тест 👑</button>
      </div>

      <section className="card">
        <h2>История</h2>
        {progress.results.length === 0 ? (
          <p className="muted">Здесь появятся результаты уроков, тестов и игр.</p>
        ) : (
          <div className="table-wrap">
            <table className="history">
              <thead><tr><th>Дата</th><th>Что</th><th>Уровень</th><th>Результат</th></tr></thead>
              <tbody>
                {progress.results.slice(0, 60).map((h) => {
                  const pct = Math.round((h.score * 100) / h.total)
                  return (
                    <tr key={h.id}>
                      <td>{new Date(h.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{h.title}</td>
                      <td>{KIND_RU[h.kind] ?? h.kind}{h.kind === 'unit' || h.kind === 'final' ? ` · ${LEVEL_NAMES[h.level] ?? ''}` : ''}</td>
                      <td><span className={`score-pill ${pct >= 70 ? 'ok' : ''}`}>{pct}%</span> {h.score}/{h.total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
