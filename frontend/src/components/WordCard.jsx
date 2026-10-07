import { isLearned } from '../lib/progress'
import { Pic, SpeakButton, genderLabel } from './ui'

export default function WordCard({ word, row, onFavorite, showUnit = false }) {
  const fav = Boolean(row?.favorite)
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
          {learned && <span className="tag tag-ok">выучено</span>}
        </div>
      </div>
      {onFavorite && (
        <button className={`fav ${fav ? 'on' : ''}`} onClick={onFavorite} aria-pressed={fav}
          aria-label={fav ? 'Убрать из избранного' : 'В избранное'} title={fav ? 'Убрать из избранного' : 'В избранное'}>
          {fav ? '♥' : '♡'}
        </button>
      )}
    </div>
  )
}
