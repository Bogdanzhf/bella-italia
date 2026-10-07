import { useEffect, useState } from 'react'
import { isDue, isSeen } from '../lib/progress'
import { shuffle, wordsDrill } from '../lib/quiz'
import { speak } from '../speech'
import { play } from '../sounds'
import { useApp } from '../state'
import { Bird, Princess } from '../components/Decor'
import Quiz from '../components/Quiz'
import { ErrorBox, Pic, ProgressBar, SpeakButton, genderLabel } from '../components/ui'

const MODES = [
  { id: 'cards', label: '🃏 Карточки', hint: 'переверни и оцени, помнишь ли слово' },
  { id: 'picture', label: '🖼 По картинке', hint: 'узнай слово по картинке' },
  { id: 'choice', label: '🌱 Перевод', hint: 'итальянский → русский' },
  { id: 'listen', label: '🎧 На слух', hint: 'услышь слово и выбери перевод' },
  { id: 'reverse', label: '🌷 Обратный', hint: 'русский → итальянский' },
  { id: 'write', label: '👑 Написание', hint: 'напиши слово по-итальянски' },
  { id: 'dictation', label: '✍️ Диктант', hint: 'услышь и напиши' },
]

function Cards({ cards, onFinish }) {
  const app = useApp()
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState([])
  const card = cards[i]

  useEffect(() => {
    if (card) speak(card.it)
  }, [i])

  async function answer(known) {
    const next = [...results, { id: card.id, correct: known }]
    play(known ? 'correct' : 'tap')
    setResults(next)
    setFlipped(false)
    if (i + 1 < cards.length) setI(i + 1)
    else {
      setTimeout(() => play('success'), 400)
      await app.reviews(next)
      onFinish(next.filter((r) => r.correct).length, next.length)
    }
  }

  return (
    <div className="flash-wrap">
      <ProgressBar value={i} max={cards.length} label="Прогресс карточек" />
      <p className="muted small center">{i + 1} / {cards.length}</p>
      <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} role="button" tabIndex={0}
        aria-label="Перевернуть карточку" onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setFlipped(!flipped)}>
        <div className="flash-inner">
          <div className="flash-face front">
            {card.img && <Pic id={card.img} size={96} />}
            <div className="flash-it">{card.it}</div>
            <div className="flash-tr">{card.cyr} · {card.ipa}</div>
            <SpeakButton text={card.it} />
            <div className="muted small">нажми, чтобы перевернуть</div>
          </div>
          <div className="flash-face back">
            <div className="flash-ru">{card.ru}</div>
            {card.gender && <span className="tag">{genderLabel[card.gender]}</span>}
            <div className="flash-it small">{card.it}</div>
          </div>
        </div>
      </div>
      <div className="flash-actions">
        <button className="btn btn-soft" onClick={() => answer(false)}>🥀 Не помню</button>
        <button className="btn" onClick={() => answer(true)}>🌸 Помню</button>
      </div>
    </div>
  )
}

export default function Flashcards() {
  const { course, progress } = useApp()
  const [opts, setOpts] = useState({ unit: '', favorites: false, mode: 'cards', count: 15 })
  const [session, setSession] = useState(null)
  const [done, setDone] = useState(null)
  const [error, setError] = useState(null)

  function pool() {
    return course.wordList.filter((w) => (opts.unit === '' || w.unit_id === Number(opts.unit)) && (!opts.favorites || progress.words[w.id]?.favorite))
  }

  function start() {
    setError(null)
    setDone(null)
    const words = pool()
    if (opts.mode === 'cards') {
      // сначала слова, которые пора повторить, затем новые
      const due = words.filter((w) => isDue(progress.words[w.id])).sort((a, b) => new Date(progress.words[a.id].due_at) - new Date(progress.words[b.id].due_at))
      const fresh = words.filter((w) => !isSeen(progress.words[w.id]))
      const cards = [...due, ...fresh].slice(0, opts.count)
      if (!cards.length) return setError(new Error('Все слова повторены — загляните позже или выберите другой юнит 🌸'))
      return setSession({ mode: 'cards', cards, n: Date.now() })
    }
    let list = words
    if (opts.mode === 'picture') list = words.filter((w) => w.img)
    if (list.length < 3) return setError(new Error('Недостаточно слов для тренировки'))
    const weak = shuffle(list).sort((a, b) => (progress.words[a.id]?.box ?? 0) - (progress.words[b.id]?.box ?? 0))
    setSession({ mode: opts.mode, questions: wordsDrill(course, weak.slice(0, opts.count), opts.mode, Date.now()), n: Date.now() })
  }

  if (session?.mode === 'cards' && done === null) {
    return (
      <div>
        <button className="link-back" onClick={() => setSession(null)}>← Настройки</button>
        <Cards key={session.n} cards={session.cards} onFinish={(k, n) => setDone({ k, n })} />
      </div>
    )
  }
  if (session && session.mode !== 'cards') {
    const m = MODES.find((x) => x.id === session.mode)
    return (
      <div>
        <button className="link-back" onClick={() => setSession(null)}>← Настройки</button>
        <Quiz key={session.n} questions={session.questions} title={m.label}
          meta={{ kind: 'words', scope: opts.unit === '' ? 'all' : String(opts.unit), title: `Слова: ${m.label}`, level: 1 }} onRestart={start} />
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <h1>Тренировка слов 🃏</h1>
        <p className="muted">
          Интервальное повторение: слова, которые ты помнишь, возвращаются всё реже, трудные — чаще. Слово считается
          выученным после трёх верных ответов подряд.
        </p>
      </div>
      {done && (
        <div className="card done-card">
          <Princess size={90} />
          <div>
            <h2>Molto bene! 🎉</h2>
            <p>Ты вспомнила {done.k} из {done.n} слов.</p>
            <button className="btn" onClick={start}>Ещё порция</button>
          </div>
        </div>
      )}
      <div className="card setup">
        <h2>Режим</h2>
        <div className="mode-grid">
          {MODES.map((m) => (
            <button key={m.id} className={opts.mode === m.id ? 'mode active' : 'mode'} onClick={() => setOpts({ ...opts, mode: m.id })}>
              <b>{m.label}</b><small>{m.hint}</small>
            </button>
          ))}
        </div>
        <div className="setup-row">
          <label>Слова из
            <select value={opts.unit} onChange={(e) => setOpts({ ...opts, unit: e.target.value })}>
              <option value="">всех юнитов</option>
              {course.units.map((u) => <option key={u.id} value={u.id}>{u.icon} юнита {u.id}: {u.title_it}</option>)}
            </select>
          </label>
          <label>Количество
            <select value={opts.count} onChange={(e) => setOpts({ ...opts, count: Number(e.target.value) })}>
              {[10, 15, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={opts.favorites} onChange={(e) => setOpts({ ...opts, favorites: e.target.checked })} /> ♥ только избранные</label>
        </div>
        <ErrorBox error={error} />
        <button className="btn btn-big" onClick={start}>Начать <Bird size={26} /></button>
      </div>
    </div>
  )
}
