import { useEffect, useState } from 'react'
import { generatePassphrase, passwordProblems, passwordStrength } from '../lib/password'
import { store } from '../lib/store'
import { useApp } from '../state'
import { Bird, Butterfly, Castle, Crown, Flower, Princess, Rainbow } from '../components/Decor'
import { ErrorBox } from '../components/ui'

const AVATARS = ['👸', '🧚', '🦄', '🐦', '🌸', '🦋', '🌷', '🐰', '🦢', '🍓']
const STRENGTH = ['', 'слабый', 'нормальный', 'хороший', 'отличный']

function Art() {
  return (
    <div className="login-art">
      <Rainbow size={200} className="login-rainbow" />
      <Bird className="float f1" size={58} style={{ position: 'absolute', top: 40, left: 20 }} />
      <Butterfly className="float f2" size={40} style={{ position: 'absolute', top: 70, right: 30 }} />
      <div className="login-scene">
        <Castle size={250} />
        <Princess size={120} className="login-princess" />
      </div>
      <h1 className="brand">Bella Italia <Crown size={36} /></h1>
      <p className="tagline">Итальянский по учебнику — урок за уроком, от нуля до A2</p>
      <ul className="features">
        <li><Flower size={20} /> 12 юнитов: диалоги, правила, культура Италии</li>
        <li><Flower size={20} petal="#d7c2ff" /> ~1500 слов с картинками, транскрипцией и озвучкой</li>
        <li><Flower size={20} petal="#bdf0da" /> тесты, аудирование, игры и карточки</li>
      </ul>
    </div>
  )
}

function PasswordField({ value, onChange, username, isNew }) {
  const [show, setShow] = useState(false)
  const problems = isNew && value ? passwordProblems(value, username) : []
  const strength = passwordStrength(value)
  return (
    <div className="field">
      <label htmlFor="pwd">Пароль</label>
      <div className="pwd-wrap">
        <input id="pwd" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} required
          autoComplete={isNew ? 'new-password' : 'current-password'} minLength={isNew ? 8 : 1} maxLength={128} />
        <button type="button" className="pwd-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}>
          {show ? '🙈' : '👁️'}
        </button>
      </div>
      {isNew && (
        <>
          <div className={`strength s${strength}`} aria-live="polite">
            <span /><span /><span /><span />
            <small>{value ? (problems.length ? `Пароль ${problems[0]}` : `Надёжность: ${STRENGTH[strength]}`) : 'Минимум 8 символов. Лучше всего — фраза из нескольких слов.'}</small>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onChange(generatePassphrase()); setShow(true) }}>
            ✨ Придумать надёжный пароль
          </button>
        </>
      )}
    </div>
  )
}

function ServerLogin() {
  const { signedIn } = useApp()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', password: '', display_name: '', avatar: '👸' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const isNew = mode === 'register'

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (isNew && passwordProblems(form.password, form.username).length) {
      setError(new Error(`Пароль ${passwordProblems(form.password, form.username)[0]}`))
      return
    }
    setBusy(true)
    try {
      const user = isNew ? await store.register(form) : await store.login(form.username, form.password)
      await signedIn(user)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="login-card card" onSubmit={submit}>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={!isNew} className={!isNew ? 'tab active' : 'tab'} onClick={() => { setMode('login'); setError(null) }}>Вход</button>
        <button type="button" role="tab" aria-selected={isNew} className={isNew ? 'tab active' : 'tab'} onClick={() => { setMode('register'); setError(null) }}>Регистрация</button>
      </div>
      <div className="field">
        <label htmlFor="login">Логин</label>
        <input id="login" value={form.username} onChange={set('username')} autoComplete="username" required minLength={3} maxLength={40}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={isNew ? 'латиница: alice, sofia_23…' : ''} />
      </div>
      <PasswordField value={form.password} onChange={(v) => setForm({ ...form, password: v })} username={form.username} isNew={isNew} />
      {isNew && (
        <>
          <div className="field">
            <label htmlFor="dname">Как к вам обращаться?</label>
            <input id="dname" value={form.display_name} onChange={set('display_name')} placeholder="Например, Алиса" maxLength={60} autoComplete="nickname" />
          </div>
          <div className="avatar-pick">
            <span>Выберите аватар</span>
            <div className="avatars">
              {AVATARS.map((a) => (
                <button type="button" key={a} className={form.avatar === a ? 'av active' : 'av'} onClick={() => setForm({ ...form, avatar: a })} aria-label={`Аватар ${a}`}>{a}</button>
              ))}
            </div>
          </div>
        </>
      )}
      <ErrorBox error={error} />
      <button className="btn btn-big" disabled={busy}>{isNew ? 'Начать учиться 👑' : 'Войти 🌸'}</button>
      <p className="muted small center">
        🔒 Пароль хранится только в виде криптографического хэша, вход защищён от подбора.
      </p>
    </form>
  )
}

function LocalProfiles() {
  const { signedIn } = useApp()
  const [profiles, setProfiles] = useState([])
  const [form, setForm] = useState({ display_name: '', avatar: '👸' })
  const [error, setError] = useState(null)

  useEffect(() => {
    store.listProfiles().then(setProfiles)
  }, [])

  async function create(e) {
    e.preventDefault()
    try {
      await signedIn(await store.createProfile(form))
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="login-card card">
      {profiles.length > 0 && (
        <>
          <h2>Кто учится сегодня?</h2>
          <div className="profiles">
            {profiles.map((p) => (
              <button key={p.id} className="profile-btn" onClick={async () => signedIn(await store.switchProfile(p.id))}>
                <span className="avatar big">{p.avatar}</span>
                <span>{p.display_name}</span>
              </button>
            ))}
          </div>
          <hr />
        </>
      )}
      <form onSubmit={create} className="stack">
        <h2>{profiles.length ? 'Новый профиль' : 'Создайте профиль'}</h2>
        <div className="field">
          <label htmlFor="pname">Как вас зовут?</label>
          <input id="pname" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} maxLength={60} required placeholder="Например, Алиса" />
        </div>
        <div className="avatars">
          {AVATARS.map((a) => (
            <button type="button" key={a} className={form.avatar === a ? 'av active' : 'av'} onClick={() => setForm({ ...form, avatar: a })} aria-label={`Аватар ${a}`}>{a}</button>
          ))}
        </div>
        <ErrorBox error={error} />
        <button className="btn btn-big">Начать учиться 👑</button>
        <p className="muted small center">Прогресс сохраняется на этом устройстве. Его можно выгрузить в файл в профиле.</p>
      </form>
    </div>
  )
}

export default function Login() {
  const { mode } = useApp()
  return (
    <div className="login">
      <Art />
      {mode === 'local' ? <LocalProfiles /> : <ServerLogin />}
    </div>
  )
}
