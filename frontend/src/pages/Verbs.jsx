import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state'
import VerbTable from '../components/VerbTable'

const TENSES = [
  ['presente', 'Настоящее'],
  ['passato prossimo', 'Passato prossimo'],
  ['imperfetto', 'Imperfetto'],
  ['futuro semplice', 'Будущее'],
  ['condizionale', 'Условное'],
  ['imperativo', 'Повелительное'],
]

export default function Verbs() {
  const { course } = useApp()
  const [tense, setTense] = useState('presente')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    const seen = new Set()
    return course.verbList.filter((v) => {
      if (v.tense !== tense) return false
      if (query && !v.inf.includes(query) && !v.ru.toLowerCase().includes(query)) return false
      if (seen.has(v.inf)) return false
      seen.add(v.inf)
      return true
    })
  }, [course, tense, q])

  return (
    <div>
      <div className="page-head">
        <h1>Спряжение глаголов 🦋</h1>
        <p className="muted">Таблицы спряжений из всех юнитов. Потренируйтесь в игре <Link to="/games/verbrace">«Гонка спряжений»</Link> или в тестах среднего и сложного уровня.</p>
      </div>
      <div className="filters card">
        <input className="search" type="search" placeholder="🔍 essere, быть…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск глагола" />
        <div className="seg seg-wrap">
          {TENSES.map(([id, label]) => <button key={id} className={tense === id ? 'active' : ''} onClick={() => setTense(id)}>{label}</button>)}
        </div>
      </div>
      <div className="verb-grid">{list.map((v) => <VerbTable key={v.id} verb={v} />)}</div>
      {list.length === 0 && <p className="empty">Таких глаголов пока нет 🥀</p>}
    </div>
  )
}
