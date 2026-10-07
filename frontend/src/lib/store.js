// Хранилище аккаунта и прогресса. Два режима с одинаковым интерфейсом:
//  • server — FastAPI: аккаунты с паролем, прогресс на сервере, вход с любого устройства;
//  • local  — статический сайт (GitHub Pages / офлайн): профили и прогресс в памяти браузера.
// Режим выбирается при сборке: VITE_STATIC=1 → local.

import { addActivity, applyResult, emptyProgress, review } from './progress'

export const MODE = import.meta.env.VITE_STATIC === '1' ? 'local' : 'server'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// ---------- сервер ----------

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'bella-italia' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    let msg = data?.detail ?? (res.status >= 500 ? 'Сервер недоступен' : 'Что-то пошло не так')
    if (Array.isArray(msg)) msg = msg.map((d) => String(d.msg).replace(/^Value error, /, '')).join('. ')
    if (res.status === 401 && !['/auth/login', '/auth/me'].includes(path)) window.dispatchEvent(new Event('auth:expired'))
    throw new ApiError(res.status, msg)
  }
  return data
}

const serverStore = {
  mode: 'server',
  async me() {
    try {
      return await request('GET', '/auth/me')
    } catch (e) {
      if (e.status === 401) return null
      throw e
    }
  },
  login: (username, password) => request('POST', '/auth/login', { username, password }).then((d) => d.user),
  register: (form) => request('POST', '/auth/register', form).then((d) => d.user),
  logout: () => request('POST', '/auth/logout'),
  updateProfile: (patch) => request('PATCH', '/auth/me', patch),
  changePassword: (current_password, new_password) => request('POST', '/auth/password', { current_password, new_password }),
  deleteAccount: (password) => request('POST', '/auth/delete', { password }),
  checkPassword: (password, username) => request('POST', '/auth/check-password', { password, username }),
  getProgress: () => request('GET', '/progress'),
  markTheory: (key) => request('POST', '/progress/lesson', { key, theory_read: true }),
  reviews: (list) => request('POST', '/progress/reviews', { reviews: list }),
  favorite: (id, favorite) => request('POST', '/progress/favorite', { id, favorite }),
  saveResult: (r) => request('POST', '/progress/result', r),
}

// ---------- устройство ----------

const LS = {
  profiles: 'bi:profiles',
  current: 'bi:current',
  progress: (id) => `bi:progress:${id}`,
}
const read = (k, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback
  } catch {
    return fallback
  }
}
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v))

function currentId() {
  return read(LS.current, null)
}
function mutate(fn) {
  const id = currentId()
  if (!id) throw new ApiError(401, 'Выберите профиль')
  const p = { ...emptyProgress(), ...read(LS.progress(id), {}) }
  const out = fn(p)
  write(LS.progress(id), p)
  return Promise.resolve(out ?? { ok: true })
}

const localStore = {
  mode: 'local',
  async me() {
    const id = currentId()
    return read(LS.profiles, []).find((p) => p.id === id) ?? null
  },
  async listProfiles() {
    return read(LS.profiles, [])
  },
  async createProfile({ display_name, avatar }) {
    const name = String(display_name ?? '').trim().slice(0, 60)
    if (!name) throw new ApiError(422, 'Введите имя')
    const profile = { id: crypto.randomUUID(), username: name, display_name: name, avatar: avatar || '👸' }
    write(LS.profiles, [...read(LS.profiles, []), profile])
    write(LS.current, profile.id)
    return profile
  },
  async switchProfile(id) {
    const profile = read(LS.profiles, []).find((p) => p.id === id)
    if (!profile) throw new ApiError(404, 'Профиль не найден')
    write(LS.current, id)
    return profile
  },
  async logout() {
    localStorage.removeItem(LS.current)
  },
  async updateProfile(patch) {
    const id = currentId()
    const profiles = read(LS.profiles, []).map((p) =>
      p.id === id ? { ...p, ...(patch.display_name?.trim() ? { display_name: patch.display_name.trim() } : {}), ...(patch.avatar ? { avatar: patch.avatar } : {}) } : p,
    )
    write(LS.profiles, profiles)
    return profiles.find((p) => p.id === id)
  },
  async deleteAccount() {
    const id = currentId()
    write(LS.profiles, read(LS.profiles, []).filter((p) => p.id !== id))
    localStorage.removeItem(LS.progress(id))
    localStorage.removeItem(LS.current)
  },
  async getProgress() {
    const id = currentId()
    return { ...emptyProgress(), ...read(LS.progress(id), {}) }
  },
  markTheory: (key) =>
    mutate((p) => {
      const row = p.lessons[key] ?? { theory_read: false, best_score: 0, completed: false }
      if (!row.theory_read) addActivity(p, 5)
      p.lessons[key] = { ...row, theory_read: true }
    }),
  reviews: (list) =>
    mutate((p) => {
      for (const r of list) p.words[r.id] = review(p.words[r.id], r.correct)
      addActivity(p, list.length)
    }),
  favorite: (id, favorite) =>
    mutate((p) => {
      p.words[id] = { box: 0, correct: 0, wrong: 0, due_at: new Date().toISOString(), ...p.words[id], favorite }
    }),
  saveResult: (r) => mutate((p) => applyResult(p, r)),
  async exportData() {
    const me = await this.me()
    return { app: 'bella-italia', version: 1, profile: me, progress: await this.getProgress() }
  },
  async importData(data) {
    if (data?.app !== 'bella-italia' || !data.progress) throw new ApiError(422, 'Это не файл прогресса Bella Italia')
    const id = currentId()
    if (!id) throw new ApiError(401, 'Выберите профиль')
    write(LS.progress(id), { ...emptyProgress(), ...data.progress })
  },
}

export const store = MODE === 'local' ? localStore : serverStore
