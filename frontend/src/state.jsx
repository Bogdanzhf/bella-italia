// Общее состояние приложения: курс, пользователь и его прогресс.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { loadCourse } from './lib/course'
import { emptyProgress } from './lib/progress'
import { MODE, store } from './lib/store'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [course, setCourse] = useState(null)
  const [user, setUser] = useState(null)
  const [progress, setProgress] = useState(emptyProgress())
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setProgress(await store.getProgress())
    } catch (e) {
      if (e.status !== 401) throw e
    }
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all([loadCourse(), store.me()])
      .then(async ([c, u]) => {
        if (!alive) return
        setCourse(c)
        setUser(u)
        if (u) setProgress(await store.getProgress())
      })
      .catch((e) => alive && setError(e))
      .finally(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const onExpired = () => {
      setUser(null)
      setProgress(emptyProgress())
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  const signedIn = useCallback(async (u) => {
    setUser(u)
    setProgress(await store.getProgress())
  }, [])

  const logout = useCallback(async () => {
    try {
      await store.logout()
    } finally {
      setUser(null)
      setProgress(emptyProgress())
    }
  }, [])

  // изменения прогресса: сохраняем и сразу перечитываем состояние
  const actions = useMemo(
    () => ({
      async markTheory(key) {
        if (progress.lessons[key]?.theory_read) return
        await store.markTheory(key)
        await refresh()
      },
      async favorite(id, fav) {
        setProgress((p) => ({ ...p, words: { ...p.words, [id]: { box: 0, correct: 0, wrong: 0, ...p.words[id], favorite: fav } } }))
        await store.favorite(id, fav)
      },
      async reviews(list) {
        if (!list.length) return
        await store.reviews(list)
        await refresh()
      },
      async saveResult(r) {
        const res = await store.saveResult(r)
        await refresh()
        return res
      },
    }),
    [progress.lessons, refresh],
  )

  const value = { course, user, setUser, progress, ready, error, mode: MODE, signedIn, logout, refresh, ...actions }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => useContext(AppContext)
