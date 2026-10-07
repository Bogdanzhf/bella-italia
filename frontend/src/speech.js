// Озвучка итальянского через встроенный в браузер синтез речи (Web Speech API).
// На iPhone/iPad работает в Safari; голос выбирается автоматически.

let voices = []

function pickVoices() {
  const all = window.speechSynthesis?.getVoices() ?? []
  const it = all.filter((v) => v.lang?.toLowerCase().startsWith('it'))
  const good = it.filter((v) => /google|natural|online|enhanced|premium|alice|federica|luca|paola/i.test(v.name))
  voices = [...good, ...it.filter((v) => !good.includes(v))]
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  pickVoices()
  window.speechSynthesis.onvoiceschanged = pickVoices
}

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export function hasItalianVoice() {
  pickVoices()
  return voices.length > 0
}

const clean = (t) => String(t).replace(/[*_#>]/g, '').replace(/\s+/g, ' ').trim()

function utterance(text, { rate = 0.9, pitch = 1, voiceIndex = 0 } = {}) {
  const u = new SpeechSynthesisUtterance(clean(text))
  u.lang = 'it-IT'
  u.rate = rate
  u.pitch = pitch
  if (voices.length) u.voice = voices[voiceIndex % voices.length]
  return u
}

export function stop() {
  if (canSpeak()) window.speechSynthesis.cancel()
}

export function speak(text, opts = {}) {
  if (!canSpeak() || !text) return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance(text, opts))
}

/**
 * Читает диалог по ролям: у каждого персонажа своя высота голоса (и свой голос,
 * если в системе их несколько). onLine(i) вызывается перед каждой репликой.
 */
export function speakDialogue(lines, { onLine, onEnd, rate = 0.9 } = {}) {
  if (!canSpeak()) return
  window.speechSynthesis.cancel()
  const speakers = [...new Set(lines.map((l) => l.speaker))]
  const pitches = [1.15, 0.85, 1.0, 1.3, 0.7]
  lines.forEach((line, i) => {
    const k = speakers.indexOf(line.speaker)
    const u = utterance(line.it, { rate, pitch: pitches[k % pitches.length], voiceIndex: k })
    u.onstart = () => onLine?.(i)
    if (i === lines.length - 1) u.onend = () => onEnd?.()
    window.speechSynthesis.speak(u)
  })
}
