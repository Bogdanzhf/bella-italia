import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { progressTestQuestions } from '../lib/quiz'
import { useApp } from '../state'
import Quiz from '../components/Quiz'
import { Md } from '../components/ui'

function Writing({ tasks }) {
  const [texts, setTexts] = useState({})
  const [shown, setShown] = useState({})
  if (!tasks?.length) return null
  return (
    <section className="card writing">
      <h2>✍️ Письмо — самопроверка</h2>
      <p className="muted small">Эту часть платформа не оценивает автоматически: напишите текст, сверьтесь с чек-листом и посмотрите образец.</p>
      {tasks.map((t, i) => {
        const words = (texts[i] ?? '').trim().split(/\s+/).filter(Boolean).length
        return (
          <div key={i} className="writing-task">
            <Md>{t.task}</Md>
            <textarea rows={5} value={texts[i] ?? ''} onChange={(e) => setTexts({ ...texts, [i]: e.target.value })}
              lang="it" spellCheck={false} placeholder="Scrivi qui…" aria-label={`Задание на письмо ${i + 1}`} />
            <div className="muted small">Слов: {words}{t.words ? ` (нужно ${t.words})` : ''}</div>
            {t.checklist && (
              <ul className="checklist">{t.checklist.map((c) => <li key={c}><label><input type="checkbox" /> {c}</label></li>)}</ul>
            )}
            {t.sample && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => setShown({ ...shown, [i]: !shown[i] })}>{shown[i] ? 'Скрыть образец' : 'Показать образец ответа'}</button>
                {shown[i] && <div className="sample"><Md>{t.sample}</Md></div>}
              </>
            )}
          </div>
        )
      })}
    </section>
  )
}

export default function ProgressTest() {
  const { testId } = useParams()
  const { course } = useApp()
  const test = course.test(testId)
  const [run, setRun] = useState(null)
  const [finished, setFinished] = useState(false)

  const sections = useMemo(() => (test ? progressTestQuestions(course, test, run ?? 1) : []), [test, run])
  if (!test) return <p className="empty">Тест не найден 🥀</p>

  // вопросы всех разделов подряд; к каждому прикрепляем текст или аудио своего раздела
  const questions = sections.flatMap((s) => s.questions.map((q) => ({
    ...q,
    section: s.title,
    sectionIntro: s.intro,
    listen: s.audio || undefined,
    context: q.context ?? (s.reading ? { kind: 'reading', data: s.reading } : undefined),
  })))

  return (
    <div>
      <Link to="/tests" className="link-back">← Все тесты</Link>
      {!run ? (
        <section className="card ptest-intro">
          <h1>{test.title} 🎓</h1>
          <p>{test.description}</p>
          <ol className="ptest-sections">
            {test.sections.map((s) => <li key={s.title}><b>{s.title}</b> — {s.exercises.length} {s.exercises.length === 1 ? 'задание' : 'заданий'}</li>)}
            {test.writing?.length > 0 && <li><b>Письмо</b> — самопроверка по образцу</li>}
          </ol>
          <p className="muted small">Для аудирования включите звук. Тест засчитывается при результате от 70%.</p>
          <button className="btn btn-big" onClick={() => setRun(Date.now())}>Начать тест</button>
        </section>
      ) : (
        <>
          <Quiz key={run} questions={questions} title={test.title}
            meta={{ kind: 'progress', scope: test.id, title: test.title, level: 2 }}
            onDone={() => setFinished(true)} onRestart={() => { setFinished(false); setRun(Date.now()) }} />
          {finished && <Writing tasks={test.writing} />}
        </>
      )}
    </div>
  )
}
