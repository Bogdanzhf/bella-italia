// Загрузка курса (data/course.json) и быстрые индексы по нему.

export function indexCourse(data) {
  const words = {}
  const exercises = {}
  const verbs = {}
  const lessons = {}
  const lessonOfExercise = {}
  const flatLessons = []
  for (const u of data.units) {
    for (const les of u.lessons) {
      les.unit_id = u.id
      lessons[les.key] = les
      flatLessons.push(les)
      for (const w of les.words ?? []) words[w.id] = w
      for (const ex of les.exercises ?? []) {
        exercises[ex.id] = ex
        lessonOfExercise[ex.id] = les
      }
    }
    for (const v of u.verbs) verbs[v.id] = v
  }
  const testSectionOfExercise = {}
  for (const t of data.tests ?? []) {
    for (const s of t.sections) {
      for (const ex of s.exercises) {
        exercises[ex.id] = ex
        testSectionOfExercise[ex.id] = s
      }
    }
  }
  const units = data.units
  return {
    ...data,
    words,
    wordList: Object.values(words),
    exercises,
    verbs,
    verbList: Object.values(verbs),
    lessons,
    flatLessons,
    unit: (id) => units.find((u) => u.id === Number(id)),
    unitOf: (lessonKey) => units.find((u) => u.id === lessons[lessonKey]?.unit_id),
    lesson: (unitId, slug) => lessons[`${unitId}.${slug}`],
    test: (id) => (data.tests ?? []).find((t) => t.id === id),
    image: (key) => (key ? data.images?.[key] : null),
    contextOf(exId) {
      const les = lessonOfExercise[exId]
      if (les) return { dialogue: les.dialogue, reading: les.reading }
      const s = testSectionOfExercise[exId]
      return s ? { reading: s.reading } : {}
    },
  }
}

let cache = null

export async function loadCourse() {
  if (cache) return cache
  const res = await fetch(`${import.meta.env.BASE_URL}data/course.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error('Не удалось загрузить курс')
  cache = indexCourse(await res.json())
  return cache
}
