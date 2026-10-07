// Звуки обратной связи: синтез через Web Audio — без файлов, мгновенно, работает офлайн и на iPad.
// На iPhone/iPad звук не слышен, если включён беззвучный режим переключателем на корпусе.

const KEY = 'bi:sound'
let ctx = null

export const soundOn = () => localStorage.getItem(KEY) !== 'off'
export const setSoundOn = (on) => localStorage.setItem(KEY, on ? 'on' : 'off')

function audio() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

/** Одна нота: частота, начало (с), длительность (с), тембр, громкость. */
function note(ac, freq, start, dur, type = 'sine', vol = 0.18, slideTo = null) {
  const t = ac.currentTime + start
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

const SOUNDS = {
  // светлый «дзинь»: две ноты вверх + обертон колокольчика
  correct(ac) {
    note(ac, 1046.5, 0, 0.18, 'sine', 0.16) // до
    note(ac, 1568, 0.08, 0.35, 'sine', 0.16) // соль
    note(ac, 3136, 0.08, 0.25, 'sine', 0.035)
  },
  // мягкая «маленькая неудача»: две ноты вниз, приглушённо
  wrong(ac) {
    note(ac, 392, 0, 0.16, 'triangle', 0.16)
    note(ac, 311, 0.13, 0.3, 'triangle', 0.15, 277)
  },
  // лёгкий щелчок — найдена буква, открыта карточка
  tap(ac) {
    note(ac, 1318.5, 0, 0.07, 'sine', 0.07)
  },
  // итог «пройдено»: короткое восходящее арпеджио
  success(ac) {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(ac, f, i * 0.09, 0.3, 'sine', 0.13))
    note(ac, 2093, 0.36, 0.5, 'sine', 0.04)
  },
  // итог «ещё немного практики»: спокойные две ноты, без грусти
  tryAgain(ac) {
    note(ac, 523.25, 0, 0.25, 'triangle', 0.12)
    note(ac, 440, 0.18, 0.4, 'triangle', 0.11)
  },
}

/** Проиграть звук: 'correct' | 'wrong' | 'tap' | 'success' | 'tryAgain'. */
export function play(name) {
  if (!soundOn()) return
  try {
    const ac = audio()
    if (ac) SOUNDS[name]?.(ac)
  } catch {
    // звук — не главное: при любой ошибке просто молчим
  }
}

/** Ответ проверен: верно или нет. */
export const feedback = (ok) => play(ok ? 'correct' : 'wrong')
