// Подсказки по паролю в интерфейсе. Окончательная проверка — на сервере (passwords.py).

const COMMON = new Set(
  `password passwort qwerty qwertz azerty asdf admin root user login letmein welcome hello ciao amore tiamo iloveyou
  love princess principessa dragon monkey sunshine shadow master football calcio superman batman pokemon secret
  test tester prova demo guest default changeme abc abcd italia roma milano napoli juventus inter pizza gelato mamma
  papa tesoro cuore stella fiore farfalla unicorno gatto russia privet parol flower butterfly unicorn barbie angel`
    .split(/\s+/)
    .filter(Boolean),
)

export function passwordProblems(pwd, username = '') {
  const out = []
  const low = pwd.toLowerCase()
  const core = low.replace(/[\W_]+/g, '')
  const stem = core.replace(/[\d]+$/, '')
  if (pwd.length < 8) out.push('не короче 8 символов')
  if (COMMON.has(core) || COMMON.has(stem) || /^(.)\1+$/.test(low) || /^(0123|1234|2345|3456|4567|5678|6789|qwer|asdf|zxcv|abcd)/.test(core))
    out.push('слишком распространённый — такой пароль есть в базах утечек')
  if (/^\d+$/.test(pwd) && pwd.length < 12) out.push('только цифры — добавьте слова')
  if (username && username.length >= 3 && low.includes(username.toLowerCase())) out.push('не должен содержать логин')
  return out
}

export function passwordStrength(pwd) {
  if (!pwd || passwordProblems(pwd).length) return 0
  const classes = [/[a-zа-я]/, /[A-ZА-Я]/, /\d/, /[^\w]/].filter((r) => r.test(pwd)).length
  return Math.min(4, 1 + (pwd.length >= 12) + (pwd.length >= 16) + (classes >= 3))
}

const WORDS = `gelato stella nuvola fiore farfalla rondine luna sole mare cielo prato rosa giglio tulipano fragola ciliegia
  pesca limone arancia miele torta biscotto castello corona fata sirena drago perla cristallo arcobaleno farfalla
  conchiglia isola gondola piazza fontana lanterna violino chitarra melodia sorriso abbraccio bacio gattino coniglio
  cigno colomba pavone giardino primavera estate autunno inverno neve brezza tramonto alba stellina scarpetta`
  .split(/\s+/)
  .filter(Boolean)

/** Пароль-фраза из итальянских слов: легко запомнить, трудно подобрать (~45+ бит). */
export function generatePassphrase() {
  const rnd = new Uint32Array(5)
  crypto.getRandomValues(rnd)
  const pick = (i) => WORDS[rnd[i] % WORDS.length]
  const words = [pick(0), pick(1), pick(2)].map((w) => w[0].toUpperCase() + w.slice(1))
  return `${words.join('-')}-${10 + (rnd[3] % 90)}`
}
