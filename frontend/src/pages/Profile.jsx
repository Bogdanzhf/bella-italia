import { useEffect, useRef, useState } from 'react'
import { generatePassphrase, passwordProblems } from '../lib/password'
import { store } from '../lib/store'
import { canSpeak, hasItalianVoice, speak } from '../speech'
import { useApp } from '../state'
import { Princess } from '../components/Decor'
import { ErrorBox } from '../components/ui'
import { play, setSoundOn, soundOn } from '../sounds'

const AVATARS = ['👸', '🧚', '🦄', '🐦', '🌸', '🦋', '🌷', '🐰', '🦢', '🍓']

function Saved({ show }) {
  return show ? <span className="badge-ok">Сохранено 🌸</span> : null
}

function PasswordChange() {
  const [form, setForm] = useState({ current: '', next: '' })
  const [msg, setMsg] = useState(null)
  const [error, setError] = useState(null)
  async function submit(e) {
    e.preventDefault()
    setError(null)
    setMsg(null)
    const problems = passwordProblems(form.next)
    if (problems.length) return setError(new Error(`Новый пароль ${problems[0]}`))
    try {
      await store.changePassword(form.current, form.next)
      setMsg('Пароль изменён. На других устройствах нужно будет войти заново.')
      setForm({ current: '', next: '' })
    } catch (err) {
      setError(err)
    }
  }
  return (
    <form className="stack" onSubmit={submit}>
      <h2>Смена пароля 🔑</h2>
      <input type="password" placeholder="Текущий пароль" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} autoComplete="current-password" required aria-label="Текущий пароль" />
      <div className="row-gap">
        <input type="text" placeholder="Новый пароль" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} autoComplete="new-password" required minLength={8} aria-label="Новый пароль" className="grow" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, next: generatePassphrase() })}>✨ Придумать</button>
      </div>
      <ErrorBox error={error} />
      {msg && <p className="badge-ok">{msg}</p>}
      <button className="btn">Сменить пароль</button>
    </form>
  )
}

function DataTransfer() {
  const { refresh } = useApp()
  const file = useRef(null)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(false)
  async function exportData() {
    const data = await store.exportData()
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bella-italia-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  async function importData(e) {
    setError(null)
    const f = e.target.files?.[0]
    if (!f) return
    try {
      if (f.size > 5_000_000) throw new Error('Файл слишком большой')
      await store.importData(JSON.parse(await f.text()))
      await refresh()
      setOk(true)
    } catch (err) {
      setError(err instanceof SyntaxError ? new Error('Файл повреждён') : err)
    }
  }
  return (
    <div className="stack">
      <h2>Перенос прогресса 💾</h2>
      <p className="muted small">Прогресс хранится на этом устройстве. Сохраните его в файл и загрузите на другом устройстве (например, с компьютера на iPad).</p>
      <div className="row-gap">
        <button className="btn" onClick={exportData}>Сохранить в файл</button>
        <button className="btn btn-ghost" onClick={() => file.current?.click()}>Загрузить из файла</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={importData} />
      </div>
      <ErrorBox error={error} />
      {ok && <p className="badge-ok">Прогресс загружен 🌸</p>}
    </div>
  )
}

function DeleteAccount() {
  const { logout, mode } = useApp()
  const [open, setOpen] = useState(false)
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState(null)
  async function del(e) {
    e.preventDefault()
    try {
      await store.deleteAccount(pwd)
      await logout()
    } catch (err) {
      setError(err)
    }
  }
  if (!open) return <button className="btn btn-soft" onClick={() => setOpen(true)}>Удалить {mode === 'local' ? 'профиль' : 'аккаунт'}…</button>
  return (
    <form className="stack danger" onSubmit={del}>
      <p>Весь прогресс будет удалён безвозвратно.</p>
      {mode === 'server' && <input type="password" placeholder="Пароль для подтверждения" value={pwd} onChange={(e) => setPwd(e.target.value)} required autoComplete="current-password" aria-label="Пароль" />}
      <ErrorBox error={error} />
      <div className="row-gap">
        <button className="btn btn-danger">Удалить навсегда</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Отмена</button>
      </div>
    </form>
  )
}

function SoundSettings() {
  const [on, setOn] = useState(soundOn())
  const toggle = () => {
    setSoundOn(!on)
    setOn(!on)
    if (!on) play('correct')
  }
  return (
    <div className="card">
      <h2>Звуки заданий 🔔</h2>
      <p>«Дзинь» за верный ответ, мягкий звук при ошибке и мелодия, когда урок или игра пройдены.</p>
      <div className="row-gap">
        <label className="switch">
          <input type="checkbox" checked={on} onChange={toggle} /> {on ? 'Звуки включены' : 'Звуки выключены'}
        </label>
        <button className="btn btn-ghost btn-sm" onClick={() => play('correct')} disabled={!on}>Верно</button>
        <button className="btn btn-ghost btn-sm" onClick={() => play('wrong')} disabled={!on}>Ошибка</button>
        <button className="btn btn-ghost btn-sm" onClick={() => play('success')} disabled={!on}>Успех</button>
      </div>
      <p className="muted small">На iPhone и iPad звуки не слышны, если включён беззвучный режим (переключатель на корпусе).</p>
    </div>
  )
}

export default function Profile() {
  const { user, setUser, logout, mode } = useApp()
  const [name, setName] = useState(user.display_name)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [voiceOk, setVoiceOk] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVoiceOk(hasItalianVoice()), 600)
    return () => clearTimeout(t)
  }, [])

  async function save(patch) {
    setError(null)
    try {
      setUser(await store.updateProfile(patch))
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setError(e)
    }
  }

  return (
    <div className="profile">
      <div className="card profile-card">
        <Princess size={120} />
        <div className="profile-body">
          <h1>{user.avatar} {user.display_name}</h1>
          {mode === 'server' && <p className="muted">Логин: {user.username}</p>}
          <form className="row-gap" onSubmit={(e) => { e.preventDefault(); save({ display_name: name }) }}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Имя" />
            <button className="btn">Сохранить</button>
            <Saved show={saved} />
          </form>
          <h3>Аватар</h3>
          <div className="avatars">
            {AVATARS.map((a) => <button key={a} className={user.avatar === a ? 'av active' : 'av'} onClick={() => save({ avatar: a })} aria-label={`Аватар ${a}`}>{a}</button>)}
          </div>
          <ErrorBox error={error} />
        </div>
      </div>

      <div className="card">
        <h2>Озвучка 🔊</h2>
        {!canSpeak() ? (
          <p>Браузер не поддерживает синтез речи. Попробуйте Safari, Chrome или Edge.</p>
        ) : (
          <>
            <p>
              Слова, фразы и диалоги озвучиваются голосом устройства.{' '}
              {voiceOk ? 'Итальянский голос найден ✔' : 'Итальянский голос не найден. На iPhone/iPad: Настройки → Универсальный доступ → Устный контент → Голоса → Italiano. На Windows: Параметры → Время и язык → Речь → добавить голос.'}
            </p>
            <button className="btn btn-ghost" onClick={() => speak('Ciao! Benvenuta! Studiamo insieme l’italiano.')}>Проверить голос</button>
          </>
        )}
      </div>

      <SoundSettings />

      {mode === 'server' ? <div className="card"><PasswordChange /></div> : <div className="card"><DataTransfer /></div>}

      <div className="card">
        <h2>{mode === 'local' ? 'Сменить профиль' : 'Выход'}</h2>
        <div className="row-gap">
          <button className="btn btn-ghost" onClick={logout}>{mode === 'local' ? 'К выбору профиля' : 'Выйти из аккаунта'}</button>
          <DeleteAccount />
        </div>
      </div>
    </div>
  )
}
