import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { buildCrossword, buildWordSearch, gameWords, lineCells } from '../lib/games'
import { PERSONS, TENSE_RU, normalize, shuffle, stripAccents } from '../lib/quiz'
import { speak } from '../speech'
import { feedback, play } from '../sounds'
import { useApp } from '../state'
import { Flower, Princess } from '../components/Decor'
import { Pic, SpeakButton } from '../components/ui'

const GAMES = [
  { id: 'memory', icon: '🃏', title: 'Memory', hint: 'найди пары: слово и перевод' },
  { id: 'crossword', icon: '✏️', title: 'Кроссворд', hint: 'впиши слова по подсказкам' },
  { id: 'wordsearch', icon: '🔍', title: 'Найди слова', hint: 'отыщи спрятанные слова в сетке' },
  { id: 'hangman', icon: '🌷', title: 'Угадай слово', hint: 'по буквам, пока цветок не облетел' },
  { id: 'verbrace', icon: '⏱️', title: 'Гонка спряжений', hint: 'спрягай глаголы на скорость' },
]

function useUnitWords(unit) {
  const { course } = useApp()
  return useMemo(() => (unit === '' ? course.wordList : course.wordList.filter((w) => w.unit_id === Number(unit))), [course, unit])
}

function Win({ text, onAgain }) {
  return (
    <div className="game-win">
      <Princess size={90} />
      <div>
        <h2>{text}</h2>
        <button className="btn" onClick={onAgain}>Ещё раз</button>
      </div>
    </div>
  )
}

// ---------- Memory ----------

function Memory({ words, save }) {
  const [seed, setSeed] = useState(Date.now())
  const cards = useMemo(() => {
    const pick = shuffle(words.filter((w) => w.ru.length < 28), Math.random).slice(0, 6)
    return shuffle(pick.flatMap((w) => [{ id: `${w.id}:it`, pair: w.id, w, side: 'it' }, { id: `${w.id}:ru`, pair: w.id, w, side: 'ru' }]))
  }, [words, seed])
  const [open, setOpen] = useState([])
  const [found, setFound] = useState([])
  const [moves, setMoves] = useState(0)
  const done = cards.length && found.length === cards.length / 2

  useEffect(() => {
    setOpen([])
    setFound([])
    setMoves(0)
  }, [cards])
  useEffect(() => {
    if (done) save({ score: cards.length / 2, total: Math.max(cards.length / 2, moves), words: found.map((id) => ({ id, correct: true })) })
  }, [done])

  function flip(c) {
    if (open.length === 2 || open.includes(c.id) || found.includes(c.pair)) return
    if (c.side === 'it') speak(c.w.it)
    const next = [...open, c.id]
    setOpen(next)
    if (next.length === 2) {
      setMoves((m) => m + 1)
      const [a, b] = next.map((id) => cards.find((x) => x.id === id))
      setTimeout(() => {
        if (a.pair !== b.pair) play('wrong')
        else play(found.length + 1 === cards.length / 2 ? 'success' : 'correct')
        if (a.pair === b.pair) setFound((f) => [...f, a.pair])
        setOpen([])
      }, a.pair === b.pair ? 350 : 900)
    }
  }

  return (
    <div>
      <p className="muted">Ходов: {moves} · найдено пар: {found.length} из {cards.length / 2}</p>
      <div className="memory">
        {cards.map((c) => {
          const shown = open.includes(c.id) || found.includes(c.pair)
          return (
            <button key={c.id} className={`mem-card ${shown ? 'shown' : ''} ${found.includes(c.pair) ? 'found' : ''}`} onClick={() => flip(c)} aria-label={shown ? (c.side === 'it' ? c.w.it : c.w.ru) : 'Закрытая карточка'}>
              <span className="mem-inner">
                <span className="mem-back"><Flower size={34} /></span>
                <span className="mem-front">
                  {c.side === 'it' ? (<>{c.w.img && <Pic id={c.w.img} size={40} />}<b>{c.w.it}</b></>) : <span>{c.w.ru}</span>}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {done && <Win text={`Brava! Все пары за ${moves} ходов 🎉`} onAgain={() => setSeed(Date.now())} />}
    </div>
  )
}

// ---------- Кроссворд ----------

function Crossword({ words, save }) {
  const [seed, setSeed] = useState(Date.now())
  const cw = useMemo(() => buildCrossword(words, { rand: Math.random }), [words, seed])
  const [cells, setCells] = useState({})
  const [checked, setChecked] = useState(false)
  const refs = useRef({})
  useEffect(() => {
    setCells({})
    setChecked(false)
  }, [cw])
  if (!cw) return <p className="empty">Мало слов для кроссворда — выберите другой юнит</p>

  const starts = Object.fromEntries(cw.items.map((p) => [`${p.r},${p.c}`, p.num]))
  const solved = Object.keys(cw.solution).every((k) => cells[k] === cw.solution[k])
  const move = (key, delta) => {
    const [r, c] = key.split(',').map(Number)
    const across = cw.items.some((p) => p.dir === 'across' && p.r === r && c >= p.c && c < p.c + p.key.length)
    const next = across ? `${r},${c + delta}` : `${r + delta},${c}`
    refs.current[next]?.focus()
  }
  function check() {
    setChecked(true)
    const right = cw.items.filter((p) => Array.from(p.key).every((ch, i) => cells[`${p.r + (p.dir === 'down' ? i : 0)},${p.c + (p.dir === 'across' ? i : 0)}`] === ch))
    play(right.length === cw.items.length ? 'success' : right.length ? 'correct' : 'wrong')
    save({ score: right.length, total: cw.items.length, words: cw.items.map((p) => ({ id: p.w.id, correct: right.includes(p) })) })
  }

  return (
    <div className="crossword-wrap">
      <div className="crossword" style={{ gridTemplateColumns: `repeat(${cw.cols}, var(--cw))`, '--cw': `clamp(22px, calc((100vw - 88px) / ${cw.cols} - 2px), 34px)` }}>
        {Array.from({ length: cw.rows * cw.cols }, (_, i) => {
          const key = `${Math.floor(i / cw.cols)},${i % cw.cols}`
          if (!cw.solution[key]) return <span key={key} className="cw-empty" />
          const wrong = checked && cells[key] && cells[key] !== cw.solution[key]
          return (
            <span key={key} className={`cw-cell ${wrong ? 'bad' : ''} ${checked && cells[key] === cw.solution[key] ? 'ok' : ''}`}>
              {starts[key] && <small>{starts[key]}</small>}
              <input ref={(el) => { refs.current[key] = el }} maxLength={1} value={cells[key] ?? ''} aria-label={`Клетка ${key}`}
                autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
                onChange={(e) => {
                  const ch = stripAccents(e.target.value).toUpperCase().replace(/[^A-Z]/g, '').slice(-1)
                  setCells({ ...cells, [key]: ch })
                  setChecked(false)
                  if (ch) move(key, 1)
                }}
                onKeyDown={(e) => e.key === 'Backspace' && !cells[key] && move(key, -1)} />
            </span>
          )
        })}
      </div>
      <div className="cw-clues">
        {['across', 'down'].map((dir) => (
          <div key={dir}>
            <h3>{dir === 'across' ? 'По горизонтали →' : 'По вертикали ↓'}</h3>
            <ol>
              {cw.items.filter((p) => p.dir === dir).sort((a, b) => a.num - b.num).map((p) => (
                <li key={p.key} value={p.num}>{p.w.img && <Pic id={p.w.img} size={26} />} {p.w.ru} <span className="muted">({p.key.length})</span></li>
              ))}
            </ol>
          </div>
        ))}
        <div className="row-gap">
          <button className="btn" onClick={check}>Проверить</button>
          <button className="btn btn-ghost" onClick={() => { setCells(cw.solution); setChecked(true) }}>Показать ответы</button>
          <button className="btn btn-ghost" onClick={() => setSeed(Date.now())}>Новый кроссворд</button>
        </div>
        {solved && <Win text="Кроссворд решён! 🎉" onAgain={() => setSeed(Date.now())} />}
      </div>
    </div>
  )
}

// ---------- Поиск слов ----------

function WordSearch({ words, save }) {
  const [seed, setSeed] = useState(Date.now())
  const ws = useMemo(() => buildWordSearch(words, { size: 10, count: 8, rand: Math.random }), [words, seed])
  const [start, setStart] = useState(null)
  const [found, setFound] = useState([])
  useEffect(() => {
    setFound([])
    setStart(null)
  }, [ws])
  const foundCells = new Set(found.flatMap((k) => ws.placed.find((p) => p.key === k).cells))
  const done = ws.placed.length && found.length === ws.placed.length
  useEffect(() => {
    if (done) save({ score: found.length, total: ws.placed.length, words: ws.placed.map((p) => ({ id: p.w.id, correct: true })) })
  }, [done])

  function tap(key) {
    if (!start) {
      play('tap')
      return setStart(key)
    }
    const line = lineCells(start, key)
    setStart(null)
    if (!line) return play('wrong')
    const hit = ws.placed.find((p) => !found.includes(p.key) && (p.cells.join() === line.join() || p.cells.join() === [...line].reverse().join()))
    if (hit) {
      setFound((f) => [...f, hit.key])
      play(found.length + 1 === ws.placed.length ? 'success' : 'correct')
      setTimeout(() => speak(hit.w.it), 450)
    } else {
      play('wrong')
    }
  }

  return (
    <div className="ws-wrap">
      <div className="wordsearch" style={{ gridTemplateColumns: `repeat(${ws.grid.length}, 1fr)` }}>
        {ws.grid.flatMap((row, r) => row.map((ch, c) => {
          const key = `${r},${c}`
          return <button key={key} className={`ws-cell ${foundCells.has(key) ? 'found' : ''} ${start === key ? 'start' : ''}`} onClick={() => tap(key)} aria-label={`${ch}, строка ${r + 1}, столбец ${c + 1}`}>{ch}</button>
        }))}
      </div>
      <div>
        <p className="muted small">Нажмите на первую и последнюю букву слова. Слова идут вправо, вниз или по диагонали.</p>
        <ul className="ws-list">
          {ws.placed.map((p) => (
            <li key={p.key} className={found.includes(p.key) ? 'found' : ''}>
              {p.w.img && <Pic id={p.w.img} size={28} />} {p.w.ru} {found.includes(p.key) && <b>— {p.w.it}</b>}
            </li>
          ))}
        </ul>
        {done ? <Win text="Все слова найдены! 🎉" onAgain={() => setSeed(Date.now())} /> : <button className="btn btn-ghost" onClick={() => setSeed(Date.now())}>Новая сетка</button>}
      </div>
    </div>
  )
}

// ---------- Угадай слово ----------

const ALPHABET = 'ABCDEFGHILMNOPQRSTUVZ'.split('')
const MAX_MISSES = 6

function Hangman({ words }) {
  const app = useApp()
  const pool = useMemo(() => gameWords(words), [words])
  const [i, setI] = useState(0)
  const [guessed, setGuessed] = useState([])
  const [score, setScore] = useState({ won: 0, played: 0 })
  const item = pool[i % Math.max(pool.length, 1)]
  if (!item) return <p className="empty">Мало слов — выберите другой юнит</p>
  const misses = guessed.filter((ch) => !item.key.includes(ch)).length
  const won = Array.from(item.key).every((ch) => guessed.includes(ch))
  const lost = misses >= MAX_MISSES

  function guess(ch) {
    if (won || lost || guessed.includes(ch)) return
    const next = [...guessed, ch]
    setGuessed(next)
    const nowWon = Array.from(item.key).every((c) => next.includes(c))
    const nowLost = next.filter((c) => !item.key.includes(c)).length >= MAX_MISSES
    if (!nowWon && !nowLost) play(item.key.includes(ch) ? 'tap' : 'wrong')
    if (nowWon || nowLost) {
      play(nowWon ? 'success' : 'tryAgain')
      setTimeout(() => speak(item.w.it), 600)
      const s = { won: score.won + (nowWon ? 1 : 0), played: score.played + 1 }
      setScore(s)
      app.reviews([{ id: item.w.id, correct: nowWon }]).catch(() => {})
    }
  }

  return (
    <div className="hangman">
      <div className="hm-flower" aria-label={`Осталось лепестков: ${MAX_MISSES - misses}`}>
        <svg viewBox="0 0 80 80" width="110" height="110">
          {Array.from({ length: MAX_MISSES }, (_, k) => (
            <ellipse key={k} cx="40" cy="18" rx="9" ry="15" fill={k < MAX_MISSES - misses ? '#ffb3cf' : '#f3e6ec'}
              transform={`rotate(${k * 60} 40 40)`} className={k >= MAX_MISSES - misses ? 'petal-gone' : ''} />
          ))}
          <circle cx="40" cy="40" r="10" fill="#ffd36e" />
        </svg>
      </div>
      <div className="hm-clue">
        {item.w.img && <Pic id={item.w.img} size={72} />}
        <p>Подсказка: <b>{item.w.ru}</b></p>
      </div>
      <div className="hm-word" aria-live="polite">
        {Array.from(item.key).map((ch, k) => <span key={k} className="hm-letter">{guessed.includes(ch) || lost ? ch : ''}</span>)}
      </div>
      <div className="hm-keys">
        {ALPHABET.map((ch) => (
          <button key={ch} disabled={guessed.includes(ch) || won || lost} className={`key ${guessed.includes(ch) ? (item.key.includes(ch) ? 'hit' : 'miss') : ''}`} onClick={() => guess(ch)}>{ch}</button>
        ))}
      </div>
      {(won || lost) && (
        <div className={`feedback ${won ? 'ok' : 'bad'}`}>
          <div className="feedback-text"><b>{won ? 'Bravissima! 🌸' : 'Peccato! 🥀'}</b> Это <b>{item.w.it}</b> — {item.w.ru} <SpeakButton text={item.w.it} small /></div>
          <button className="btn" onClick={() => { setI(i + 1); setGuessed([]) }}>Следующее слово →</button>
        </div>
      )}
      <p className="muted small center">Угадано: {score.won} из {score.played}</p>
    </div>
  )
}

// ---------- Гонка спряжений ----------

function VerbRace({ unit, save }) {
  const { course } = useApp()
  const verbs = useMemo(() => course.verbList.filter((v) => unit === '' || v.unit_id <= Number(unit)), [course, unit])
  const [state, setState] = useState('ready')
  const [time, setTime] = useState(60)
  const [task, setTask] = useState(null)
  const [answer, setAnswer] = useState('')
  const [score, setScore] = useState({ ok: 0, all: 0 })
  const [flash, setFlash] = useState(null)
  const input = useRef(null)

  const newTask = () => {
    const v = verbs[Math.floor(Math.random() * verbs.length)]
    const persons = v.forms.map((f, k) => (f[0] !== '—' ? k : -1)).filter((k) => k >= 0)
    setTask({ v, p: persons[Math.floor(Math.random() * persons.length)] })
    setAnswer('')
  }
  useEffect(() => {
    if (state !== 'run') return undefined
    if (time <= 0) {
      setState('done')
      save({ score: score.ok, total: Math.max(1, score.all) })
      return undefined
    }
    const t = setTimeout(() => setTime((x) => x - 1), 1000)
    return () => clearTimeout(t)
  }, [state, time])

  function submit(e) {
    e.preventDefault()
    const ok = task.v.forms[task.p].some((f) => normalize(f) === normalize(answer) || stripAccents(normalize(f)) === stripAccents(normalize(answer)))
    feedback(ok)
    setScore((s) => ({ ok: s.ok + ok, all: s.all + 1 }))
    setFlash(ok ? { ok: true } : { ok: false, right: task.v.forms[task.p].join(' / ') })
    newTask()
    input.current?.focus()
  }

  if (!verbs.length) return <p className="empty">В этих юнитах нет глаголов</p>
  if (state === 'ready') {
    return (
      <div className="race-start card">
        <p>За 60 секунд напиши как можно больше правильных форм глаголов. Ударения можно не ставить.</p>
        <button className="btn btn-big" onClick={() => { setScore({ ok: 0, all: 0 }); setTime(60); newTask(); setState('run'); setTimeout(() => input.current?.focus(), 50) }}>Старт ⏱️</button>
      </div>
    )
  }
  if (state === 'done') return <Win text={`Время вышло! Верно: ${score.ok} из ${score.all} ⏱️`} onAgain={() => setState('ready')} />
  return (
    <form className="race card" onSubmit={submit}>
      <div className="race-top"><span className="race-time">⏱ {time}</span><span>✔ {score.ok} / {score.all}</span></div>
      <p className="race-q"><b>{task.v.inf}</b> ({task.v.ru}) · {TENSE_RU[task.v.tense] ?? task.v.tense} · <b>{PERSONS[task.p]}</b></p>
      <input ref={input} value={answer} onChange={(e) => setAnswer(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} lang="it" aria-label="Форма глагола" enterKeyHint="send" />
      <button className="btn">→</button>
      {flash && <p className={flash.ok ? 'right' : 'wrong-plain'}>{flash.ok ? 'Giusto! ✨' : `Правильно: ${flash.right}`}</p>}
    </form>
  )
}

// ---------- страница ----------

export default function Games() {
  const { game } = useParams()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const app = useApp()
  const unit = params.get('unit') ?? ''
  const words = useUnitWords(unit)
  const current = GAMES.find((g) => g.id === game)

  const save = (r) => app.saveResult({ kind: 'game', scope: game, title: `Игра: ${current.title}`, level: 0, ...r }).catch(() => {})

  return (
    <div>
      <div className="page-head">
        <h1>Игры 🎲</h1>
        <p className="muted">Повторяем слова и грамматику играючи — как в «Attività extra e ludiche» к учебнику.</p>
      </div>
      <div className="filters card">
        <label className="inline-label">Слова из
          <select value={unit} onChange={(e) => setParams(e.target.value ? { unit: e.target.value } : {})}>
            <option value="">всех юнитов</option>
            {app.course.units.map((u) => <option key={u.id} value={u.id}>{u.icon} юнита {u.id}: {u.title_it}</option>)}
          </select>
        </label>
        <div className="seg seg-wrap">
          {GAMES.map((g) => (
            <button key={g.id} className={game === g.id ? 'active' : ''} onClick={() => nav({ pathname: `/games/${g.id}`, search: params.toString() })}>{g.icon} {g.title}</button>
          ))}
        </div>
      </div>
      {!current ? (
        <div className="games-grid">
          {GAMES.map((g) => (
            <Link key={g.id} to={{ pathname: `/games/${g.id}`, search: params.toString() }} className="game-card card">
              <span className="game-icon">{g.icon}</span>
              <b>{g.title}</b>
              <small>{g.hint}</small>
            </Link>
          ))}
        </div>
      ) : (
        <section className="card game-area">
          <h2>{current.icon} {current.title}</h2>
          {game === 'memory' && <Memory key={unit} words={words} save={save} />}
          {game === 'crossword' && <Crossword key={unit} words={words} save={save} />}
          {game === 'wordsearch' && <WordSearch key={unit} words={words} save={save} />}
          {game === 'hangman' && <Hangman key={unit} words={words} />}
          {game === 'verbrace' && <VerbRace key={unit} unit={unit} save={save} />}
        </section>
      )}
    </div>
  )
}
