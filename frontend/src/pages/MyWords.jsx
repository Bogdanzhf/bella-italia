import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { dictCounts, dictEntries, entryById, explainWord } from '../lib/mywords'
import { LEARN_STREAK } from '../lib/progress'
import { compareText, shuffle, wordAnswers } from '../lib/quiz'
import { feedback, play } from '../sounds'
import { speak } from '../speech'
import { useApp } from '../state'
import { Bird, Princess } from '../components/Decor'
import { AccentInput } from '../components/Quiz'
import { ErrorBox, Pic, ProgressBar, SpeakButton } from '../components/ui'

const TABS = [
  { id: 'learning', label: '📖 Изучаю' },
  { id: 'learned', label: '✅ Выучено' },
  { id: 'all', label: 'Все' },
]

function Streak({ row }) {
  const n = Math.min(row?.streak ?? 0, LEARN_STREAK)
  return (
    <span className="streak" title={`Верных ответов подряд: ${n} из ${LEARN_STREAK}`} aria-label={`Верных ответов подряд: ${n} из ${LEARN_STREAK}`}>
      {Array.from({ length: LEARN_STREAK }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}
    </span>
  )
}

/** Объяснение слова: правила, заметка, примеры из уроков, ссылка на урок. */
export function Explanation({ entry }) {
  const { course } = useApp()
  const ex = useMemo(() => explainWord(course, entry), [course, entry])
  return (
    <div className="explain">
      {ex.lines.map((l) => <p key={l}>{l}</p>)}
      {ex.examples.length > 0 && (
        <div className="explain-examples">
          <b>Пример{ex.examples.length > 1 ? 'ы' : ''}:</b>
          {ex.examples.map((e) => (
            <p key={e.it}>
              <SpeakButton text={e.it} small /> <span lang="it">{e.it}</span>
              {e.ru && <span className="muted"> — {e.ru}</span>}
            </p>
          ))}
        </div>
      )}
      {ex.lesson && (
        <p className="small">
          📚 Из урока <Link to={`/lesson/${ex.lesson.unit_id}/${ex.lesson.slug}`}>«{ex.lesson.title_ru}»</Link> (юнит {ex.lesson.unit_id})
        </p>
      )}
    </div>
  )
}

// ---------- своё слово ----------

const EMPTY = { it: '', ru: '', note: '', example: '' }

function CustomForm({ initial, onClose }) {
  const app = useApp()
  const [form, setForm] = useState(initial ? { it: initial.it, ru: initial.ru, note: initial.note ?? '', example: initial.example ?? '' } : EMPTY)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  async function submit(e) {
    e.preventDefault()
    setError(null)
    try {
      if (initial) await app.editCustom(initial.id, form)
      else await app.addCustom(form)
      play('correct')
      onClose()
    } catch (err) {
      setError(err)
    }
  }
  return (
    <form className="card custom-form" onSubmit={submit}>
      <h2>{initial ? 'Изменить слово' : 'Своё слово ✍️'}</h2>
      <label>
        По-итальянски
        <span className="row-gap nowrap">
          <input value={form.it} onChange={set('it')} maxLength={120} required lang="it" autoCapitalize="off" spellCheck={false} placeholder="la farfalla" autoFocus />
          {form.it.trim() && <SpeakButton text={form.it} small />}
        </span>
      </label>
      <label>
        Перевод
        <input value={form.ru} onChange={set('ru')} maxLength={200} required placeholder="бабочка" />
      </label>
      <label>
        Пояснение <span className="muted small">(необязательно: род, правило, как запомнить)</span>
        <input value={form.note} onChange={set('note')} maxLength={300} placeholder="ж. р., мн. ч. le farfalle" />
      </label>
      <label>
        Пример <span className="muted small">(необязательно)</span>
        <input value={form.example} onChange={set('example')} maxLength={300} lang="it" placeholder="Una farfalla gialla vola nel giardino." />
      </label>
      <p className="muted small">Слово попадёт в раздел «Изучаю».</p>
      <ErrorBox error={error} />
      <div className="row-gap">
        <button className="btn">{initial ? 'Сохранить' : 'Добавить'}</button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
      </div>
    </form>
  )
}

// ---------- строка словаря ----------

function EntryRow({ entry, selected, onSelect, onEdit }) {
  const app = useApp()
  const [open, setOpen] = useState(false)
  const move = (s) => app.setDict(entry.id, s).catch(() => {})
  const pic = entry.img ? <Pic id={entry.img} size={44} /> : <span className="word-pic-empty small">{entry.custom ? '✍️' : '🌸'}</span>
  return (
    <li className={`dict-row ${entry.status}`}>
      <div className="dict-row-main">
        <input type="checkbox" checked={selected} onChange={() => onSelect(entry.id)} aria-label={`Выбрать ${entry.it}`} />
        <span className="dict-pic">{pic}</span>
        <button className="dict-word" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Показать объяснение">
          <b lang="it">{entry.it}</b>
          <span className="muted">{entry.ru}</span>
          {entry.cyr && <span className="cyr small">{entry.cyr}</span>}
        </button>
        <SpeakButton text={entry.it} small />
        {entry.status === 'learning' && <Streak row={entry.row} />}
        <span className="dict-actions">
          {entry.status === 'learning'
            ? <button className="btn btn-soft btn-sm" onClick={() => move('learned')} title="Перенести в «Выучено»">✅ Выучено</button>
            : <button className="btn btn-soft btn-sm" onClick={() => move('learning')} title="Вернуть в «Изучаю»">📖 Изучать</button>}
          {entry.custom && <button className="btn btn-ghost btn-sm" onClick={() => onEdit(entry)} title="Изменить" aria-label={`Изменить ${entry.it}`}>✎</button>}
          <button
            className="btn btn-ghost btn-sm"
            title={entry.custom ? 'Удалить своё слово' : 'Убрать из словаря'}
            aria-label={`Убрать ${entry.it}`}
            onClick={() => {
              if (entry.custom) {
                if (window.confirm(`Удалить своё слово «${entry.it}»?`)) app.deleteCustom(entry.id).catch(() => {})
              } else move(null)
            }}
          >
            ✕
          </button>
        </span>
      </div>
      {open && <Explanation entry={entry} />}
    </li>
  )
}

// ---------- тренировка ----------

function checkWord(entry, given) {
  const accepted = entry.custom ? [entry.it, ...wordAnswers({ it: entry.it }).slice(1)] : wordAnswers(entry)
  return compareText(given, accepted)
}

function Trainer({ ids, mode, onExit }) {
  const app = useApp()
  const [order] = useState(() => shuffle(ids))
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(false)
  const [value, setValue] = useState('')
  const [verdict, setVerdict] = useState(null)
  const [answers, setAnswers] = useState([])
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState(null)
  // запоминаем слова на момент старта: перенос в «Выучено» не должен ломать текущую сессию
  const [entries] = useState(() => Object.fromEntries(order.map((id) => [id, entryById(app.course, app.progress, id)])))
  const entry = entries[order[i]]

  async function finish(list) {
    try {
      await app.reviews(list)
      play(list.every((a) => a.correct) ? 'success' : 'tryAgain')
    } catch (e) {
      setError(e)
    }
    setSaved(list)
  }

  function answer(correct) {
    const list = [...answers, { id: entry.id, correct }]
    setAnswers(list)
    if (i + 1 < order.length) {
      setI(i + 1)
      setShown(false)
      setValue('')
      setVerdict(null)
    } else finish(list)
  }

  function check() {
    if (!value.trim() || verdict) return
    const v = checkWord(entry, value)
    setVerdict(v)
    feedback(v.correct)
    if (v.correct) setTimeout(() => speak(entry.it), 450)
  }

  if (saved) {
    const right = saved.filter((a) => a.correct)
    const wrong = saved.filter((a) => !a.correct)
    const nowLearned = right.filter((a) => app.progress.words[a.id]?.dict === 'learned' && entries[a.id]?.status !== 'learned')
    return (
      <div className="card trainer-result">
        <Princess size={100} />
        <h2>{wrong.length === 0 ? 'Bravissima! 🎉' : 'Отличная тренировка! 🌷'}</h2>
        <p>Верно: <b>{right.length}</b> из {saved.length}</p>
        {nowLearned.length > 0 && <p className="badge-ok">Перешли в «Выучено»: {nowLearned.map((a) => entries[a.id].it).join(', ')}</p>}
        {wrong.length > 0 && (
          <div className="mistakes">
            <h3>Остаются в «Изучаю» — повторим ещё</h3>
            {wrong.map((a) => <div key={a.id} className="mistake"><b lang="it">{entries[a.id].it}</b> — {entries[a.id].ru}</div>)}
          </div>
        )}
        <p className="muted small">Слово переходит в «Выучено» после {LEARN_STREAK} верных ответов подряд — в тренировках, тестах и играх. Ошибка возвращает его в «Изучаю».</p>
        <ErrorBox error={error && `Результат не сохранился: ${error.message}`} />
        <button className="btn" onClick={onExit}>К словарю</button>
      </div>
    )
  }
  if (!entry) return null

  return (
    <div className="card trainer">
      <div className="quiz-head">
        <span className="muted">{mode === 'cards' ? '🃏 Карточки' : '✍️ Проверка'}</span>
        <span className="quiz-count">{i + 1} / {order.length}</span>
      </div>
      <ProgressBar value={i} max={order.length} label="Прогресс тренировки" />
      {mode === 'cards' ? (
        <div className="flash-card-big">
          <div className="fc-pic">{entry.img ? <Pic id={entry.img} size={96} /> : <span className="fc-emoji">{entry.custom ? '✍️' : '🌸'}</span>}</div>
          <div className="fc-word" lang="it">{entry.it} <SpeakButton text={entry.it} /></div>
          {entry.cyr && <div className="cyr">{entry.cyr}</div>}
          {!shown ? (
            <button className="btn btn-big" onClick={() => setShown(true)}>Показать перевод и объяснение</button>
          ) : (
            <>
              <div className="fc-ru">{entry.ru}</div>
              <Explanation entry={entry} />
              <p className="muted small">Вы вспомнили перевод сами?</p>
              <div className="row-gap center">
                <button className="btn btn-ghost" onClick={() => { play('wrong'); answer(false) }}>❌ Не вспомнила</button>
                <button className="btn" onClick={() => { play('correct'); answer(true) }}>✅ Помню</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flash-card-big">
          <div className="fc-pic">{entry.img ? <Pic id={entry.img} size={96} /> : <span className="fc-emoji">{entry.custom ? '✍️' : '🌸'}</span>}</div>
          <p className="muted small">Напишите по-итальянски (артикль можно не писать):</p>
          <div className="fc-ru">{entry.ru}</div>
          <AccentInput value={value} onChange={setValue} disabled={Boolean(verdict)} onEnter={check} autoFocus label="Слово по-итальянски" />
          {!verdict ? (
            <button className="btn" disabled={!value.trim()} onClick={check}>Проверить</button>
          ) : (
            <>
              <div className={`feedback ${verdict.correct ? 'ok' : 'bad'}`}>
                {verdict.correct ? 'Giusto! ✨' : 'Почти!'} <b lang="it">{entry.it}</b> <SpeakButton text={entry.it} small />
                {verdict.note && <div className="small">{verdict.note}</div>}
              </div>
              <Explanation entry={entry} />
              <button className="btn" onClick={() => answer(verdict.correct)} autoFocus>Дальше →</button>
            </>
          )}
        </div>
      )}
      <button className="link-back" onClick={onExit}>Закончить тренировку</button>
    </div>
  )
}

// ---------- страница ----------

export default function MyWords() {
  const app = useApp()
  const { course, progress } = app
  const [tab, setTab] = useState('learning')
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim().toLowerCase())
  const [selected, setSelected] = useState([])
  const [form, setForm] = useState(null)
  const [training, setTraining] = useState(null)
  const [size, setSize] = useState(15)

  const all = useMemo(() => dictEntries(course, progress), [course, progress])
  const counts = useMemo(() => dictCounts(course, progress), [course, progress])
  const shown = all.filter((e) => (tab === 'all' || e.status === tab) && (!q || e.it.toLowerCase().includes(q) || e.ru.toLowerCase().includes(q)))

  const pool = (status) => all.filter((e) => e.status === status).map((e) => e.id)
  const start = (mode, status = 'learning') => {
    const ids = shuffle(pool(status)).slice(0, size)
    if (ids.length) setTraining({ mode, ids, n: Date.now() })
  }
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const bulk = (status) => {
    app.setDict(selected, status).catch(() => {})
    setSelected([])
  }

  if (training) return <Trainer key={training.n} ids={training.ids} mode={training.mode} onExit={() => setTraining(null)} />

  return (
    <div className="my-words">
      <div className="page-head">
        <h1>Мой словарь ⭐</h1>
        <p className="muted">
          Слова, которые вы знаете и которые нужно отработать. Добавляйте их кнопкой «＋ В словарь» в уроках и в <Link to="/dictionary">словаре курса</Link> или вписывайте свои.
          Слово переходит в «Выучено» после {LEARN_STREAK} верных ответов подряд, ошибка возвращает его в «Изучаю».
        </p>
      </div>

      <section className="card dict-train">
        <Bird size={58} className="float f2" />
        <div className="grow">
          <h2>Тренировка</h2>
          <p className="muted small">В разделе «Изучаю»: <b>{counts.learning}</b> · «Выучено»: <b>{counts.learned}</b></p>
          <div className="row-gap">
            <button className="btn" disabled={!counts.learning} onClick={() => start('cards')}>🃏 Карточки с объяснением</button>
            <button className="btn btn-soft" disabled={!counts.learning} onClick={() => start('check')}>✍️ Проверка: написать слово</button>
            <button className="btn btn-ghost" disabled={!counts.learned} onClick={() => start('check', 'learned')} title="Проверить, не забылись ли выученные слова">🔁 Повторить выученные</button>
            <label className="check">
              по
              <select value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Сколько слов">
                {[10, 15, 25, 50, 1000].map((n) => <option key={n} value={n}>{n === 1000 ? 'все' : n}</option>)}
              </select>
              слов
            </label>
          </div>
          <p className="muted small">Ещё: <Link to="/flashcards">карточки по всем словам курса</Link> · <Link to="/games">игры</Link></p>
        </div>
      </section>

      {form && <CustomForm key={form === 'new' ? 'new' : form.id} initial={form === 'new' ? null : form} onClose={() => setForm(null)} />}

      <div className="filters card">
        <div className="seg">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => { setTab(t.id); setSelected([]) }}>
              {t.label} {t.id === 'all' ? counts.all : counts[t.id]}
            </button>
          ))}
        </div>
        <input className="search" type="search" placeholder="🔍 Поиск в моём словаре" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Поиск в моём словаре" />
        {!form && <button className="btn btn-soft" onClick={() => setForm('new')}>＋ Своё слово</button>}
      </div>

      {selected.length > 0 && (
        <div className="bulk card">
          Выбрано: {selected.length}
          <button className="btn btn-sm" onClick={() => bulk('learning')}>📖 В «Изучаю»</button>
          <button className="btn btn-sm" onClick={() => bulk('learned')}>✅ В «Выучено»</button>
          <button className="btn btn-ghost btn-sm" onClick={() => bulk(null)}>✕ Убрать</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>Снять выбор</button>
        </div>
      )}

      {counts.all === 0 ? (
        <div className="card empty-dict">
          <p>Здесь пока пусто 🌱</p>
          <p className="muted">Откройте любой урок → вкладка «Слова» → «＋ В словарь». Или добавьте своё слово.</p>
          <Link to="/course" className="btn">Открыть курс</Link>
        </div>
      ) : shown.length === 0 ? (
        <p className="empty">В этом разделе слов нет</p>
      ) : (
        <>
          <p className="muted small">
            Нажмите на слово, чтобы увидеть объяснение.{' '}
            <button className="linklike" onClick={() => setSelected(shown.map((e) => e.id))}>Выбрать все ({shown.length})</button>
          </p>
          <ul className="dict-list">
            {shown.map((e) => <EntryRow key={e.id} entry={e} selected={selected.includes(e.id)} onSelect={toggle} onEdit={setForm} />)}
          </ul>
        </>
      )}
    </div>
  )
}
