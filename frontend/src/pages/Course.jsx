import { Link } from 'react-router-dom'
import { useApp } from '../state'
import { Tulip } from '../components/Decor'
import { Ring } from '../components/ui'

const LEVEL_INFO = { A0: 'Самое начало', A1: 'Начальный уровень', A2: 'Элементарный уровень' }

export default function Course() {
  const { course, progress } = useApp()
  const done = (u) => u.lessons.filter((l) => progress.lessons[l.key]?.completed).length
  const words = (u) => u.lessons.reduce((n, l) => n + (l.words?.length ?? 0), 0)

  return (
    <div>
      <div className="page-head">
        <h1>Курс итальянского 📚</h1>
        <p className="muted">
          Уроки идут по порядку учебника <i>Nuovissimo Progetto italiano 1</i>. В каждом юните — диалог с героями курса,
          правила, слова с картинками и транскрипцией, культура Италии и практика. Урок засчитывается при результате от 70%.
          После юнитов 2, 5, 8 и 11 — тесты прогресса.
        </p>
      </div>
      {['A0', 'A1', 'A2'].map((lvl) => (
        <section key={lvl} className="level-group">
          <h2 className="level-title"><span className={`level-badge lv-${lvl}`}>{lvl}</span> {LEVEL_INFO[lvl]}</h2>
          <div className="unit-grid">
            {course.units.filter((u) => u.level === lvl).map((u) => (
              <Link key={u.id} to={`/unit/${u.id}`} className="unit-card card">
                <div className="unit-top">
                  <span className="unit-icon">{u.icon}</span>
                  <Ring value={done(u)} max={u.lessons.length} size={54}>{done(u)}/{u.lessons.length}</Ring>
                </div>
                <div className="unit-num">Юнит {u.id}</div>
                <h3>{u.title_it}</h3>
                <div className="unit-ru">{u.title_ru}</div>
                <p className="unit-desc">{u.description}</p>
                <div className="unit-meta">{u.lessons.length} уроков · {words(u)} слов</div>
                {done(u) === u.lessons.length && <Tulip size={22} className="unit-done" />}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
