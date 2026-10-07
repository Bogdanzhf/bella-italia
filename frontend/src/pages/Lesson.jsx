import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { lessonPractice } from '../lib/quiz'
import { speak, speakDialogue, stop } from '../speech'
import { useApp } from '../state'
import { Flower } from '../components/Decor'
import Quiz from '../components/Quiz'
import WordCard from '../components/WordCard'
import { Md, Pic, SpeakButton } from '../components/ui'
import { KIND } from './Unit'

const SPEAKER_COLORS = ['#ffd1e3', '#e2d4ff', '#c8f0de', '#ffe7c2', '#d4ecff']
const SPEAKER_ICONS = {
  Sofia: '👱🏻‍♀️', Gianna: '👩🏼', Lorenzo: '👨🏻', Michela: '👩🏻‍🦰', madre: '👩🏻', padre: '👨🏼',
  Cameriere: '🤵🏻', Commessa: '👩🏻‍💼', Fruttivendolo: '👨🏻‍🌾',
}

function DialogueView({ dialogue }) {
  const [current, setCurrent] = useState(-1)
  const [showRu, setShowRu] = useState({})
  const [allRu, setAllRu] = useState(false)
  const speakers = [...new Set(dialogue.lines.map((l) => l.speaker))]
  useEffect(() => () => stop(), [])

  return (
    <section className="card dialogue">
      {dialogue.title && <h2>{dialogue.title}</h2>}
      {dialogue.scene && <p className="scene">🎬 {dialogue.scene}</p>}
      <div className="row-gap">
        <button className="btn" onClick={() => speakDialogue(dialogue.lines, { onLine: setCurrent, onEnd: () => setCurrent(-1) })}>▶ Прослушать диалог</button>
        <button className="btn btn-ghost" onClick={() => { stop(); setCurrent(-1) }}>⏹ Стоп</button>
        <button className="btn btn-soft" onClick={() => setAllRu((v) => !v)}>{allRu ? 'Скрыть перевод' : 'Показать перевод'}</button>
      </div>
      <div className="bubbles">
        {dialogue.lines.map((l, i) => {
          const k = speakers.indexOf(l.speaker)
          return (
            <div key={i} className={`bubble ${k % 2 ? 'right' : 'left'} ${current === i ? 'speaking' : ''}`}>
              <span className="who" aria-hidden="true">{SPEAKER_ICONS[l.speaker] ?? (k % 2 ? '🧑🏻' : '👩🏼')}</span>
              <div className="bubble-body" style={{ background: SPEAKER_COLORS[k % SPEAKER_COLORS.length] }}>
                <div className="speaker">{l.speaker}</div>
                <button className="bubble-it" onClick={() => setShowRu((s) => ({ ...s, [i]: !s[i] }))} title="Нажмите, чтобы увидеть перевод">
                  {l.it}
                </button>
                {(allRu || showRu[i]) && <div className="bubble-ru">{l.ru}</div>}
              </div>
              <SpeakButton text={l.it} small />
            </div>
          )
        })}
      </div>
      <p className="muted small">Нажмите на реплику, чтобы увидеть перевод. 🔊 — послушать одну реплику.</p>
    </section>
  )
}

function ReadingView({ reading, photos }) {
  const [ru, setRu] = useState(false)
  return (
    <section className="card reading">
      {reading.title && <h2>{reading.title}</h2>}
      {reading.photo && <Pic id={reading.photo} photo caption className="reading-photo" />}
      <div className="row-gap">
        <button className="btn btn-soft" onClick={() => speak(reading.text, { rate: 0.85 })}>🔊 Прослушать текст</button>
        <button className="btn btn-ghost" onClick={() => stop()}>⏹</button>
        {reading.ru && <button className="btn btn-ghost" onClick={() => setRu((v) => !v)}>{ru ? 'Скрыть перевод' : 'Перевод'}</button>}
      </div>
      <div className="reading-text">{reading.text.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>
      {ru && <div className="reading-ru">{reading.ru.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>}
      {reading.glossary?.length > 0 && (
        <div className="glossary">
          <h3>Глоссарий</h3>
          <dl>{reading.glossary.map(([it, r]) => <div key={it}><dt>{it}</dt><dd>{r}</dd></div>)}</dl>
        </div>
      )}
      {photos?.length > 0 && <div className="gallery">{photos.map((p) => <Pic key={p} id={p} photo caption />)}</div>}
    </section>
  )
}

export default function Lesson() {
  const { unitId, slug } = useParams()
  const app = useApp()
  const { course, progress } = app
  const lesson = course.lesson(unitId, slug)
  const tabs = useMemo(() => {
    if (!lesson) return []
    const t = []
    if (lesson.dialogue) t.push({ id: 'dialogue', label: 'Диалог', icon: '💬' })
    if (lesson.reading || lesson.photos?.length) t.push({ id: 'reading', label: 'Текст', icon: '📜' })
    if (lesson.theory) t.push({ id: 'theory', label: 'Правило', icon: '📖' })
    if (lesson.words?.length) t.push({ id: 'words', label: 'Слова', icon: '🌸', count: lesson.words.length })
    if (lesson.phrases?.length) t.push({ id: 'phrases', label: 'Фразы', icon: '💭' })
    t.push({ id: 'practice', label: 'Практика', icon: '✏️' })
    return t
  }, [lesson])
  const [chosenTab, setTab] = useState(tabs[0]?.id)
  // вкладка прошлого урока могла не существовать в этом (например, «Диалог»)
  const tab = tabs.some((t) => t.id === chosenTab) ? chosenTab : tabs[0]?.id
  const [practice, setPractice] = useState(null)

  useEffect(() => {
    setTab(tabs[0]?.id)
    setPractice(null)
  }, [lesson?.key])
  useEffect(() => {
    if (lesson && tab && tab !== tabs[0]?.id) app.markTheory(lesson.key).catch(() => {})
  }, [tab])

  if (!lesson) return <p className="empty">Урок не найден 🥀</p>
  const unit = course.unitOf(lesson.key)
  const p = progress.lessons[lesson.key]
  const idx = course.flatLessons.indexOf(lesson)
  const prev = course.flatLessons[idx - 1]
  const next = course.flatLessons[idx + 1]
  const tabIndex = tabs.findIndex((t) => t.id === tab)
  const nextTab = tabs[tabIndex + 1]

  const startPractice = () => {
    setTab('practice')
    setPractice({ questions: lessonPractice(course, lesson, Date.now()), n: Date.now() })
  }
  const go = (id) => (id === 'practice' ? startPractice() : setTab(id))
  const kind = KIND[lesson.kind] ?? KIND.lesson

  return (
    <div className="lesson">
      <Link to={`/unit/${unit.id}`} className="link-back">← {unit.icon} Юнит {unit.id}: {unit.title_it}</Link>
      <header className="lesson-head card">
        <div>
          <span className={`kind kind-${lesson.kind}`}>{kind.icon} {kind.label}</span>
          <h1>{lesson.title_ru}</h1>
          <div className="lesson-it">«{lesson.title_it}» <SpeakButton text={lesson.title_it} small /></div>
        </div>
        <div className="lesson-status">
          {p?.completed ? <span className="badge-ok">Пройден 🌸 {p.best_score}%</span>
            : p?.best_score > 0 ? <span className="badge">Лучший результат: {p.best_score}%</span>
              : <span className="badge">Новый урок ✨</span>}
        </div>
      </header>

      <div className="lesson-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'ltab active' : 'ltab'} onClick={() => go(t.id)}>
            <span aria-hidden="true">{t.icon}</span> {t.label}{t.count ? <small> {t.count}</small> : null}
          </button>
        ))}
      </div>

      {tab === 'dialogue' && lesson.dialogue && <DialogueView dialogue={lesson.dialogue} />}
      {tab === 'reading' && (lesson.reading ? <ReadingView reading={lesson.reading} photos={lesson.photos} />
        : <section className="card gallery">{lesson.photos.map((ph) => <Pic key={ph} id={ph} photo caption />)}</section>)}
      {tab === 'theory' && lesson.theory && <section className="card theory"><Md>{lesson.theory}</Md></section>}
      {tab === 'words' && (
        <section>
          <p className="muted small">Транскрипция русскими буквами (ударная гласная отмечена) и международная (IPA). 🔊 — послушать, ♡ — в избранное.</p>
          <div className="word-grid">
            {lesson.words.map((w) => (
              <WordCard key={w.id} word={w} row={progress.words[w.id]} onFavorite={() => app.favorite(w.id, !progress.words[w.id]?.favorite)} />
            ))}
          </div>
        </section>
      )}
      {tab === 'phrases' && (
        <section className="card">
          <ul className="phrases">
            {lesson.phrases.map((ph) => (
              <li key={ph.it}>
                {ph.img && <Pic id={ph.img} size={44} />}
                <div className="grow">
                  <div className="phrase-it"><SpeakButton text={ph.it} small /><b>{ph.it}</b></div>
                  <div className="phrase-tr">{ph.cyr}</div>
                  <div className="phrase-ru">{ph.ru}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {tab === 'practice' && practice && (
        <Quiz key={practice.n} questions={practice.questions} title={`Практика: ${lesson.title_ru}`}
          meta={{ kind: 'lesson', scope: lesson.key, title: lesson.title_ru, level: 1 }} onRestart={startPractice} />
      )}

      {tab !== 'practice' && nextTab && (
        <div className="row-end">
          <button className="btn" onClick={() => go(nextTab.id)}>{nextTab.icon} {nextTab.label} →</button>
        </div>
      )}

      <nav className="lesson-nav">
        {prev ? <Link to={`/lesson/${prev.unit_id}/${prev.slug}`} className="btn btn-ghost">← {prev.title_ru}</Link> : <span />}
        <Flower size={28} className="spin" />
        {next ? <Link to={`/lesson/${next.unit_id}/${next.slug}`} className="btn btn-ghost">{next.title_ru} →</Link> : <span />}
      </nav>
    </div>
  )
}
