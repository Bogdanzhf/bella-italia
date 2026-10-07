// Статистика для главной страницы — считается из курса и прогресса в браузере.

import { isDue, isLearned, isSeen, today } from './progress'

export function streak(activity) {
  const days = new Set(Object.keys(activity))
  const d = new Date()
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(iso(d))) {
    n += 1
    d.setDate(d.getDate() - 1)
  }
  return n
}

export function computeStats(course, progress) {
  const lp = progress.lessons
  const wp = progress.words
  const results = progress.results
  const lessonsDone = course.flatLessons.filter((l) => lp[l.key]?.completed).length
  const next = course.flatLessons.find((l) => !lp[l.key]?.completed) ?? null
  const week = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    week.push({ day: key, weekday: d.getDay(), points: progress.activity[key] ?? 0 })
  }
  const rows = Object.values(wp)
  return {
    lessonsDone,
    lessonsTotal: course.flatLessons.length,
    wordsTotal: course.wordList.length,
    wordsLearned: rows.filter(isLearned).length,
    wordsLearning: rows.filter((r) => isSeen(r) && !isLearned(r)).length,
    wordsDue: rows.filter(isDue).length,
    favorites: rows.filter((r) => r.favorite).length,
    testsTaken: results.length,
    averagePercent: results.length ? Math.round(results.reduce((s, r) => s + (r.score * 100) / r.total, 0) / results.length) : 0,
    streak: streak(progress.activity),
    pointsToday: progress.activity[today()] ?? 0,
    pointsTotal: Object.values(progress.activity).reduce((a, b) => a + b, 0),
    week,
    next,
    units: course.units.map((u) => ({
      ...u,
      done: u.lessons.filter((l) => lp[l.key]?.completed).length,
      total: u.lessons.length,
    })),
  }
}
