import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { dictStatus, isLearned, isSeen } from '../lib/progress'
import { useApp } from '../state'
import WordCard from '../components/WordCard'

const STATUSES = [
  { id: 'all', label: 'Все' },
  { id: 'new', label: 'Новые' },
  { id: 'learning', label: 'Встречались' },
  { id: 'learned', label: 'Освоены' },
]
const PAGE = 60

export default function Dictionary() {
  const app = useApp()
  const { course, progress } = app
  const [filters, setFilters] = useState({ unit: '', q: '', status: 'all', mine: false, pics: false })
  const [shown, setShown] = useState(PAGE)
  const q = useDeferredValue(filters.q.trim().toLowerCase())

  const words = useMemo(() => course.wordList.filter((w) => {
    const row = progress.words[w.id]
    if (filters.unit !== '' && w.unit_id !== Number(filters.unit)) return false
    if (q && !w.it.toLowerCase().includes(q) && !w.ru.toLowerCase().includes(q)) return false
    if (filters.mine && !dictStatus(row)) return false
    if (filters.pics && !w.img) return false
    if (filters.status === 'new' && isSeen(row)) return false
    if (filters.status === 'learning' && (!isSeen(row) || isLearned(row))) return false
    if (filters.status === 'learned' && !isLearned(row)) return false
    return true
  }), [course, progress.words, filters, q])

  const set = (patch) => {
    setFilters((f) => ({ ...f, ...patch }))
    setShown(PAGE)
  }

  return (
    <div>
      <div className="page-head">
        <h1>Словарь 🌸</h1>
        <p className="muted">Все слова учебника с картинками, переводом, транскрипцией и озвучкой. Ищите по-итальянски или по-русски. Нажмите «＋ В словарь», чтобы добавить слово в <Link to="/my-words">мой словарь</Link> и отработать его на карточках.</p>
      </div>
      <div className="filters card">
        <input className="search" type="search" placeholder="🔍 gatto, кошка…" value={filters.q} onChange={(e) => set({ q: e.target.value })} aria-label="Поиск" />
        <select value={filters.unit} onChange={(e) => set({ unit: e.target.value })} aria-label="Юнит">
          <option value="">Все юниты</option>
          {course.units.map((u) => <option key={u.id} value={u.id}>{u.icon} Юнит {u.id}: {u.title_it}</option>)}
        </select>
        <div className="seg">
          {STATUSES.map((s) => (
            <button key={s.id} className={filters.status === s.id ? 'active' : ''} onClick={() => set({ status: s.id })}>{s.label}</button>
          ))}
        </div>
        <label className="check"><input type="checkbox" checked={filters.mine} onChange={(e) => set({ mine: e.target.checked })} /> ⭐ в моём словаре</label>
        <label className="check"><input type="checkbox" checked={filters.pics} onChange={(e) => set({ pics: e.target.checked })} /> 🖼 с картинками</label>
      </div>
      <p className="muted small">Найдено слов: {words.length}</p>
      <div className="word-grid">
        {words.slice(0, shown).map((w) => (
          <WordCard key={w.id} word={w} row={progress.words[w.id]} showUnit />
        ))}
      </div>
      {shown < words.length && (
        <div className="row-center"><button className="btn btn-ghost" onClick={() => setShown(shown + PAGE)}>Показать ещё</button></div>
      )}
      {words.length === 0 && <p className="empty">Ничего не нашлось 🥀</p>}
    </div>
  )
}
