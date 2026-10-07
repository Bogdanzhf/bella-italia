import { useEffect, useMemo, useRef, useState } from 'react'
import { checkAnswer, wordOf } from '../lib/quiz'
import { speak, stop } from '../speech'
import { feedback, play } from '../sounds'
import { useApp } from '../state'
import { Bird, Princess } from './Decor'
import { ErrorBox, MdInline, Pic, ProgressBar, SpeakButton, Stars } from './ui'

const ACCENTS = ['à', 'è', 'é', 'ì', 'ò', 'ù', "'"]
const PRAISE = ['Brava! 🌸', 'Perfetto! 👑', 'Bellissimo! 🦋', 'Esatto! 🌷', 'Fantastico! ✨', 'Benissimo! 💖']
const COMFORT = ['Non fa niente! 🌼', 'Quasi! 💗', 'Coraggio! 🐦', 'Riprova dopo! 🌷']
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function AccentInput({ value, onChange, disabled, onEnter, autoFocus, small = false, label }) {
  const ref = useRef(null)
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus({ preventScroll: true })
  }, [autoFocus, disabled])
  const insert = (ch) => {
    const el = ref.current
    const v = value ?? ''
    const s = el?.selectionStart ?? v.length
    const e = el?.selectionEnd ?? v.length
    onChange(v.slice(0, s) + ch + v.slice(e))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(s + 1, s + 1)
    })
  }
  return (
    <span className={small ? 'accent-input small' : 'accent-input'}>
      <input
        ref={ref}
        value={value ?? ''}
        disabled={disabled}
        aria-label={label ?? 'Ответ'}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder={small ? '…' : 'Напишите ответ…'}
        autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} lang="it" enterKeyHint="done"
      />
      {!small && (
        <span className="accents">
          {ACCENTS.map((a) => (
            <button type="button" key={a} disabled={disabled} onClick={() => insert(a)} aria-label={`Вставить ${a}`}>{a}</button>
          ))}
        </span>
      )}
    </span>
  )
}

function Context({ context }) {
  const [open, setOpen] = useState(true)
  if (!context?.data) return null
  const { kind, data } = context
  return (
    <div className="q-context">
      <button type="button" className="q-context-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} {kind === 'dialogue' ? 'Диалог' : 'Текст'}: {data.title}
      </button>
      {open && (kind === 'dialogue' ? (
        <div className="q-context-body">
          {data.lines.map((l, i) => (
            <p key={i}><b>{l.speaker}:</b> {l.it}</p>
          ))}
        </div>
      ) : (
        <div className="q-context-body">{data.text.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>
      ))}
    </div>
  )
}

function QuestionBody({ q, disabled, value, setValue, onSubmit, verdict }) {
  switch (q.type) {
    case 'choice': {
      const state = (o) => {
        if (!verdict) return value === o ? 'chosen' : ''
        if (o === verdict.expected || verdict.expected.split(' / ').includes(o)) return 'opt-right'
        return o === value ? 'opt-wrong' : 'opt-dim'
      }
      return (
        <div className={`options ${q.options.some((o) => o.length > 40) ? 'options-wide' : ''}`}>
          {q.options.map((o) => (
            <button key={o} className={`option ${state(o)}`} disabled={disabled} onClick={() => onSubmit(o)}>
              <MdInline>{o}</MdInline>
            </button>
          ))}
        </div>
      )
    }
    case 'input':
      return (
        <div className="answer-input">
          <AccentInput value={value} onChange={setValue} disabled={disabled} autoFocus
            onEnter={() => (value ?? '').trim() && onSubmit(value)} />
          {!disabled && <button className="btn" disabled={!(value ?? '').trim()} onClick={() => onSubmit(value)}>Проверить</button>}
        </div>
      )
    case 'order': {
      const chosen = value ?? []
      return (
        <div className="order">
          <div className="order-line">
            {chosen.length === 0 && <span className="muted">Нажимайте на слова по порядку…</span>}
            {chosen.map((i) => (
              <button key={i} className="chip chip-on" disabled={disabled} onClick={() => setValue(chosen.filter((x) => x !== i))}>{q.tokens[i]}</button>
            ))}
          </div>
          <div className="order-bank">
            {q.tokens.map((t, i) => !chosen.includes(i) && (
              <button key={i} className="chip" disabled={disabled} onClick={() => setValue([...chosen, i])}>{t}</button>
            ))}
          </div>
          {!disabled && (
            <button className="btn" disabled={chosen.length !== q.tokens.length} onClick={() => onSubmit(chosen.map((i) => q.tokens[i]).join(' '))}>Проверить</button>
          )}
        </div>
      )
    }
    case 'match': {
      const pairs = value?.pairs ?? {}
      const active = value?.active ?? null
      const colorOf = (left) => `pair-${q.left.indexOf(left) % 6}`
      return (
        <div className="match">
          <div className="match-col">
            {q.left.map((l) => (
              <button key={l} disabled={disabled} className={`chip ${pairs[l] ? colorOf(l) : ''} ${active === l ? 'chip-active' : ''}`}
                onClick={() => {
                  const next = { ...pairs }
                  delete next[l]
                  setValue({ pairs: next, active: l })
                }}>
                {l}
              </button>
            ))}
          </div>
          <div className="match-col">
            {q.right.map((r) => {
              const owner = Object.keys(pairs).find((k) => pairs[k] === r)
              return (
                <button key={r} disabled={disabled || (!active && !owner)} className={`chip ${owner ? colorOf(owner) : ''}`}
                  onClick={() => {
                    if (!active) return
                    const next = Object.fromEntries(Object.entries(pairs).filter(([, v]) => v !== r))
                    next[active] = r
                    setValue({ pairs: next, active: null })
                  }}>
                  {r}
                </button>
              )
            })}
          </div>
          {!disabled && (
            <button className="btn match-check" disabled={Object.keys(pairs).length !== q.left.length} onClick={() => onSubmit(pairs)}>Проверить</button>
          )}
        </div>
      )
    }
    case 'tf': {
      const marks = value ?? q.items.map(() => null)
      return (
        <div className="tf">
          {q.items.map((it, i) => (
            <div key={i} className={`tf-row ${verdict ? (verdict.marks[i] ? 'ok' : 'bad') : ''}`}>
              <span className="tf-text"><MdInline>{it}</MdInline></span>
              <span className="tf-btns">
                {[true, false].map((v) => (
                  <button key={String(v)} disabled={disabled} className={`chip ${marks[i] === v ? 'chip-on' : ''}`}
                    onClick={() => setValue(marks.map((m, k) => (k === i ? v : m)))}>
                    {v ? 'Верно' : 'Неверно'}
                  </button>
                ))}
              </span>
            </div>
          ))}
          {!disabled && <button className="btn" disabled={marks.some((m) => m === null)} onClick={() => onSubmit(marks)}>Проверить</button>}
        </div>
      )
    }
    case 'dialog': {
      const chosen = value ?? []
      return (
        <div className="dialog-order">
          <ol className="dialog-built">
            {chosen.map((i) => (
              <li key={i}><button className="line chip-on" disabled={disabled} onClick={() => setValue(chosen.filter((x) => x !== i))}>{q.lines[i]}</button></li>
            ))}
            {chosen.length === 0 && <li className="muted">Выбирайте реплики по порядку, с первой…</li>}
          </ol>
          <div className="dialog-bank">
            {q.lines.map((l, i) => !chosen.includes(i) && (
              <button key={i} className="line" disabled={disabled} onClick={() => setValue([...chosen, i])}>{l}</button>
            ))}
          </div>
          {!disabled && (
            <button className="btn" disabled={chosen.length !== q.lines.length} onClick={() => onSubmit(chosen.map((i) => q.lines[i]))}>Проверить</button>
          )}
        </div>
      )
    }
    case 'cloze': {
      const vals = value ?? q.gaps.map(() => '')
      const set = (i, v) => setValue(vals.map((x, k) => (k === i ? v : x)))
      return (
        <div className="cloze">
          <p className="cloze-text">
            {q.parts.map((p, k) => {
              if (p.text !== undefined) return <span key={k}>{p.text}</span>
              const g = q.gaps[p.gap]
              const cls = verdict ? (verdict.marks[p.gap] ? 'gap ok' : 'gap bad') : 'gap'
              return g.options ? (
                <select key={k} className={cls} value={vals[p.gap]} disabled={disabled} onChange={(e) => set(p.gap, e.target.value)} aria-label={`Пропуск ${p.gap + 1}`}>
                  <option value="">{p.gap + 1}…</option>
                  {g.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <span key={k} className={cls}>
                  <AccentInput small value={vals[p.gap]} onChange={(v) => set(p.gap, v)} disabled={disabled} label={`Пропуск ${p.gap + 1}`} />
                </span>
              )
            })}
          </p>
          {!disabled && <button className="btn" disabled={vals.some((v) => !String(v).trim())} onClick={() => onSubmit(vals)}>Проверить</button>}
        </div>
      )
    }
    case 'error':
      return (
        <div className="error-q">
          <p className="error-sentence">
            {q.tokens.map((t, i) => (
              <button key={i} disabled={disabled} className={`word ${value === i ? 'chosen' : ''}`} onClick={() => onSubmit(i)}>{t}</button>
            ))}
          </p>
          <p className="muted small">Нажмите на слово с ошибкой</p>
        </div>
      )
    default:
      return null
  }
}

/**
 * Прохождение набора вопросов: мгновенная проверка, пояснения, итог со звёздами
 * и работой над ошибками. Результат сохраняется через app.saveResult(meta + счёт).
 */
export default function Quiz({ questions, meta, onDone, onRestart, title }) {
  const app = useApp()
  const [idx, setIdx] = useState(0)
  const [value, setValue] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const [answers, setAnswers] = useState([])
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const cheer = useMemo(() => ({ ok: pick(PRAISE), bad: pick(COMFORT) }), [idx])
  const q = questions[idx]

  useEffect(() => {
    if (q?.audio) {
      const t = setTimeout(() => speak(q.audio), 350)
      return () => clearTimeout(t)
    }
    return undefined
  }, [q])
  useEffect(() => () => stop(), [])

  function submitAnswer(answer) {
    if (verdict) return
    const v = checkAnswer(app.course, q.id, answer)
    setValue((prev) => prev ?? answer) // составные ответы (порядок, пары, диалог) уже лежат в value в своём формате
    setVerdict(v)
    setAnswers((prev) => [...prev, { id: q.id, answer, correct: v.correct, expected: v.expected, prompt: q.prompt, type: q.type }])
    feedback(v.correct)
    if (v.correct && (q.speak || q.audio)) setTimeout(() => speak(q.speak || q.audio), 450)
  }

  async function next() {
    if (idx + 1 < questions.length) {
      setIdx(idx + 1)
      setValue(null)
      setVerdict(null)
      return
    }
    setBusy(true)
    const score = answers.filter((a) => a.correct).length
    const words = answers.map((a) => ({ id: wordOf(a.id), correct: a.correct })).filter((w) => w.id)
    try {
      const res = await app.saveResult({ ...meta, score, total: answers.length, words })
      setResult({ ...res, score, total: answers.length })
      play(res.passed ? 'success' : 'tryAgain')
      onDone?.(res)
    } catch (e) {
      setError(e)
      const percent = Math.round((score * 100) / answers.length)
      setResult({ score, total: answers.length, percent, passed: percent >= 70 })
      play(percent >= 70 ? 'success' : 'tryAgain')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && verdict && !result && !busy && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (result) {
    const mistakes = answers.filter((a) => !a.correct)
    return (
      <div className="quiz-result card">
        <Princess size={110} className="result-princess" />
        <h2>{result.passed ? 'Complimenti! 🎉' : 'Ещё немного практики! 🌷'}</h2>
        <Stars percent={result.percent} />
        <p className="result-score">{result.score} из {result.total} · <b>{result.percent}%</b></p>
        {result.lesson_completed && <p className="badge-ok">Урок пройден! 🌸</p>}
        {meta.kind === 'lesson' && !result.passed && <p className="muted">Чтобы пройти урок, нужно набрать 70%.</p>}
        <ErrorBox error={error && `Результат не сохранился: ${error.message}`} />
        {mistakes.length > 0 && (
          <div className="mistakes">
            <h3>Работа над ошибками</h3>
            {mistakes.map((m) => (
              <div key={m.id} className="mistake">
                <div className="mistake-q"><MdInline>{m.prompt}</MdInline></div>
                <div className="right pre">{m.expected}</div>
              </div>
            ))}
          </div>
        )}
        <div className="row-center">{onRestart && <button className="btn" onClick={onRestart}>Пройти ещё раз</button>}</div>
      </div>
    )
  }
  if (!q) return null

  return (
    <div className="quiz card">
      <div className="quiz-head">
        <span className="muted">{title}</span>
        <span className="quiz-count">{idx + 1} / {questions.length} · ✔ {answers.filter((a) => a.correct).length}</span>
      </div>
      <ProgressBar value={idx + (verdict ? 1 : 0)} max={questions.length} label="Прогресс" />
      {q.section && (
        <div className="q-section">
          <b>{q.section}</b>
          {q.sectionIntro && <span className="muted small"> — {q.sectionIntro}</span>}
        </div>
      )}
      {q.listen && (
        <div className="q-listen">
          <span>🎧 Текст для аудирования</span>
          <button className="btn btn-soft btn-sm" onClick={() => speak(q.listen, { rate: 0.85 })}>▶ Слушать</button>
          <button className="btn btn-ghost btn-sm" onClick={() => speak(q.listen, { rate: 0.6 })}>🐢 Медленно</button>
          <button className="btn btn-ghost btn-sm" onClick={() => stop()}>⏹</button>
          {verdict && <details className="transcript"><summary>Текст записи</summary><p>{q.listen}</p></details>}
        </div>
      )}
      <Context context={q.context} />
      {q.img && <div className={q.bigImg ? 'q-img big' : 'q-img'}><Pic id={q.img} size={q.bigImg ? 120 : 72} /></div>}
      <div className="quiz-prompt">
        <MdInline>{q.prompt}</MdInline>
        {q.speak && <SpeakButton text={q.speak} small />}
      </div>
      {q.audio && (
        <div className="audio-row">
          <button className="btn btn-soft audio-btn" onClick={() => speak(q.audio)}>🔊 Слушать</button>
          <button className="btn btn-ghost btn-sm" onClick={() => speak(q.audio, { rate: 0.6 })}>🐢 Медленно</button>
        </div>
      )}
      {q.hint && <div className="quiz-hint">{q.hint}</div>}
      <QuestionBody key={q.id + idx} q={q} disabled={Boolean(verdict) || busy} value={value} setValue={setValue} onSubmit={submitAnswer} verdict={verdict} />
      {verdict && (
        <div className={`feedback ${verdict.correct ? 'ok' : 'bad'}`} role="status">
          <div className="feedback-text">
            <b>{verdict.correct ? cheer.ok : cheer.bad}</b>
            {!verdict.correct && <div className="pre">Правильно: <b>{verdict.expected}</b></div>}
            {verdict.correct && q.audio && q.type !== 'choice' && <div>Вы услышали: <b>{q.audio}</b></div>}
            {verdict.note && <div className="note">💡 {verdict.note}</div>}
          </div>
          <Bird size={46} className={verdict.correct ? 'hop' : ''} color={verdict.correct ? '#bdf0da' : '#ffd1e3'} wing={verdict.correct ? '#7fd3b4' : '#ffb3cf'} />
          <button className="btn" onClick={next} disabled={busy} autoFocus>
            {idx + 1 < questions.length ? 'Дальше →' : 'Завершить'}
          </button>
        </div>
      )}
    </div>
  )
}
