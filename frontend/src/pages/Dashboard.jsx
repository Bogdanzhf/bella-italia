import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { computeStats } from '../lib/stats'
import { useApp } from '../state'
import { Bird, Flower, Princess, Sparkle } from '../components/Decor'
import { ProgressBar, Ring, plural } from '../components/ui'

const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Buonanotte'
  if (h < 12) return 'Buongiorno'
  if (h < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

export default function Dashboard() {
  const { course, progress, user } = useApp()
  const s = useMemo(() => computeStats(course, progress), [course, progress])
  const maxPts = Math.max(10, ...s.week.map((d) => d.points))
  const next = s.next
  const nextUnit = next && course.unitOf(next.key)

  return (
    <div className="dashboard">
      <section className="hero card">
        <div className="hero-text">
          <h1>{greeting()}, {user.display_name}! {user.avatar}</h1>
          <p className="muted">
            {s.lessonsDone === 0
              ? 'Добро пожаловать в королевство итальянского языка! Начнём с алфавита и первых слов.'
              : `Пройдено ${s.lessonsDone} ${plural(s.lessonsDone, 'урок', 'урока', 'уроков')} из ${s.lessonsTotal}. Continua così!`}
          </p>
          {next ? (
            <Link to={`/lesson/${next.unit_id}/${next.slug}`} className="btn btn-big">
              {s.lessonsDone === 0 ? 'Начать первый урок' : 'Продолжить'} →
            </Link>
          ) : (
            <p className="badge-ok">Все уроки пройдены — ты настоящая принцесса итальянского! 👑</p>
          )}
          {next && <p className="muted small">{nextUnit.icon} Юнит {nextUnit.id} · {next.title_ru}</p>}
        </div>
        <div className="hero-art">
          <Sparkle size={22} className="twinkle t1 hero-sparkle" />
          <Princess size={150} className="hero-princess" />
        </div>
      </section>

      <section className="stat-grid">
        <div className="stat card">
          <div className="stat-icon">🔥</div>
          <div className="stat-num">{s.streak}</div>
          <div className="stat-label">{plural(s.streak, 'день', 'дня', 'дней')} подряд</div>
        </div>
        <div className="stat card">
          <Ring value={s.lessonsDone} max={s.lessonsTotal} size={70}>{Math.round((s.lessonsDone * 100) / s.lessonsTotal)}%</Ring>
          <div className="stat-label">курса пройдено</div>
        </div>
        <div className="stat card">
          <div className="stat-icon">🌸</div>
          <div className="stat-num">{s.wordsLearned}</div>
          <div className="stat-label">слов выучено из {s.wordsTotal}</div>
        </div>
        <div className="stat card">
          <div className="stat-icon">🏆</div>
          <div className="stat-num">{s.averagePercent}%</div>
          <div className="stat-label">средний балл · {s.testsTaken} {plural(s.testsTaken, 'тест', 'теста', 'тестов')}</div>
        </div>
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Активность за неделю</h2>
          <div className="week">
            {s.week.map((d) => (
              <div key={d.day} className="week-day" title={`${d.points} очков`}>
                <div className="week-bar-wrap"><div className="week-bar" style={{ height: `${(d.points * 100) / maxPts}%` }} /></div>
                <span>{DAYS[d.weekday]}</span>
              </div>
            ))}
          </div>
          <p className="muted small">Очки — за уроки, тесты, карточки и игры. Сегодня: {s.pointsToday} ✨ · всего: {s.pointsTotal}</p>
        </section>

        <section className="card">
          <h2>Повторение слов</h2>
          <div className="review-box">
            <Bird size={64} className="float f2" />
            <div>
              <p>{s.wordsDue > 0 ? <>Пора повторить <b>{s.wordsDue}</b> {plural(s.wordsDue, 'слово', 'слова', 'слов')}!</> : 'Новые слова ждут тебя в карточках.'}</p>
              <p className="muted small">Изучаются: {s.wordsLearning} · В избранном: {s.favorites}</p>
              <div className="row-gap">
                <Link to="/flashcards" className="btn">Карточки 🃏</Link>
                <Link to="/games" className="btn btn-ghost">Игры 🎲</Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <h2>Мой путь по учебнику</h2>
        <div className="path">
          {s.units.map((u) => (
            <Link key={u.id} to={`/unit/${u.id}`} className={`path-step ${u.done === u.total ? 'done' : ''}`}>
              <span className="path-icon">{u.icon}</span>
              <span className="path-title">{u.id}. {u.title_it}</span>
              <ProgressBar value={u.done} max={u.total} label={u.title_it} />
              {u.done === u.total && <Flower size={18} className="path-flower" />}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
