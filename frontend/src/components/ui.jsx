import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { canSpeak, speak } from '../speech'
import { useApp } from '../state'
import { Flower } from './Decor'

export function SpeakButton({ text, small = false, title = 'Послушать', slow = false }) {
  if (!canSpeak() || !text) return null
  return (
    <button
      type="button"
      className={`speak ${small ? 'speak-sm' : ''}`}
      title={title}
      aria-label={`${title}: ${text}`}
      onClick={(e) => {
        e.stopPropagation()
        speak(text, slow ? { rate: 0.65 } : {})
      }}
    >
      {slow ? '🐢' : '🔊'}
    </button>
  )
}

/** Картинка курса по ключу из images.yaml (иллюстрация или фото). */
export function Pic({ id, size = 64, className = '', photo = false, caption = false }) {
  const { course } = useApp()
  const img = course?.image(id)
  if (!img) return null
  const src = `${import.meta.env.BASE_URL}${img.src}`
  if (img.kind === 'photo' || photo) {
    return (
      <figure className={`photo ${className}`}>
        <img src={src} alt={img.alt} loading="lazy" decoding="async" />
        {caption && (
          <figcaption>
            {img.alt}
            {img.credit && <span className="credit"> · фото: {img.credit}, {img.license}</span>}
          </figcaption>
        )}
      </figure>
    )
  }
  return <img className={`pic ${className}`} src={src} alt="" width={size} height={size} loading="lazy" decoding="async" />
}

const mdComponents = {
  table: ({ node, ...props }) => (
    <div className="table-wrap">
      <table {...props} />
    </div>
  ),
}

export function Md({ children, className = 'md' }) {
  return (
    <div className={className}>
      <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{children}</Markdown>
    </div>
  )
}

export function MdInline({ children }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={{ p: ({ children: c }) => <>{c}</> }}>
      {String(children ?? '')}
    </Markdown>
  )
}

export function ProgressBar({ value, max = 100, label }) {
  const pct = max ? Math.round((value * 100) / max) : 0
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Ring({ value, max, size = 64, children }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const pct = max ? value / max : 0
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--pink-100)" strokeWidth="7" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="url(#ringGrad)" strokeWidth="7" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" x2="1">
            <stop offset="0" stopColor="#ff9fc2" />
            <stop offset="1" stopColor="#b79cf0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  )
}

export function Loading({ text = 'Загружаем…' }) {
  return (
    <div className="loading">
      <Flower className="spin" size={42} />
      <span>{text}</span>
    </div>
  )
}

export function ErrorBox({ error }) {
  if (!error) return null
  return <div className="alert" role="alert">🥀 {String(error.message ?? error)}</div>
}

export function Stars({ percent }) {
  const n = percent >= 90 ? 3 : percent >= 70 ? 2 : percent >= 40 ? 1 : 0
  return (
    <div className="stars" aria-label={`${n} из 3 звёзд`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? 'star on' : 'star'}>★</span>
      ))}
    </div>
  )
}

export const LEVELS = [
  { level: 1, name: 'Лёгкий', icon: '🌱', hint: 'выбор ответа, картинки, аудирование' },
  { level: 2, name: 'Средний', icon: '🌷', hint: 'сопоставление, порядок слов, спряжения' },
  { level: 3, name: 'Сложный', icon: '👑', hint: 'ввод с клавиатуры, диктант, перевод на итальянский' },
]

export const genderLabel = { m: 'м. р.', f: 'ж. р.' }

export function plural(n, one, few, many) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
