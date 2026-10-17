import { useState } from 'react'
import { LEARN_STREAK, dictStatus, isLearned } from '../lib/progress'
import { useApp } from '../state'
import { Pic, SpeakButton, genderLabel } from './ui'

export const DICT_LABEL = { learning: '📖 Изучаю', learned: '✅ Выучено' }

/** Кнопка личного словаря: «＋ В словарь» или раздел слова с меню перемещения. */
export function DictButton({ id, row, compact = false }) {
  const app = useApp()
  const [open, setOpen] = useState(false)
  const status = dictStatus(row)
  const move = (s) => {
    setOpen(false)
    app.setDict(id, s).catch(() => {})
  }
  if (!status) {
    return (
      <button className="dict-btn add" onClick={() => move('learning')} title="Добавить в мой словарь — в раздел «Изучаю»">
        ＋{compact ? '' : ' В словарь'}
      </button>
    )
  }
  return (
    <span className="dict-menu">
      <button className={`dict-btn ${status}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Раздел в моём словаре">
        {DICT_LABEL[status]}
        {status === 'learning' && row?.streak > 0 && <small> {row.streak}/{LEARN_STREAK}</small>}
      </button>
      {open && (
        <span className="dict-pop" role="menu">
          {status !== 'learning' && <button role="menuitem" onClick={() => move('learning')}>📖 В «Изучаю»</button>}
          {status !== 'learned' && <button role="menuitem" onClick={() => move('learned')}>✅ В «Выучено»</button>}
          <button role="menuitem" onClick={() => move(null)}>✕ Убрать из словаря</button>
        </span>
      )}
    </span>
  )
}

export default function WordCard({ word, row, showUnit = false }) {
  const learned = isLearned(row)
  return (
    <div className={`word-card ${learned ? 'learned' : ''}`}>
      <div className="word-side">
        <div className="word-pic">{word.img ? <Pic id={word.img} size={52} /> : <span className="word-pic-empty">🌸</span>}</div>
        <SpeakButton text={word.it} small />
      </div>
      <div className="word-main">
        <div className="word-it" lang="it">{word.it}</div>
        <div className="word-tr">
          <span className="cyr">{word.cyr}</span>
          <span className="ipa">{word.ipa}</span>
        </div>
        <div className="word-ru">{word.ru}</div>
        <div className="word-tags">
          {word.gender && <span className="tag">{genderLabel[word.gender]}</span>}
          {word.note && <span className="tag">{word.note}</span>}
          {showUnit && <span className="tag tag-unit">юнит {word.unit_id}</span>}
        </div>
        <div className="word-dict"><DictButton id={word.id} row={row} /></div>
      </div>
    </div>
  )
}
