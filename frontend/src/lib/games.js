// Генераторы для игр: кроссворд, поиск слов, слова для «Угадай слово».

import { shuffle, stripAccents, withoutArticle } from './quiz'

/** Одно итальянское слово без артикля и ударений, только буквы: CASA, GELATO. */
export function gameWord(w) {
  const bare = withoutArticle(w.it).split(' / ').pop()
  if (/\s|['’!?.,]/.test(bare)) return null
  const up = stripAccents(bare).toUpperCase()
  return /^[A-Z]{3,10}$/.test(up) ? up : null
}

export function gameWords(words, rand = Math.random) {
  const seen = new Set()
  return shuffle(words, rand)
    .map((w) => ({ w, key: gameWord(w) }))
    .filter(({ key }) => key && !seen.has(key) && seen.add(key))
}

// ---------- кроссворд ----------

export function buildCrossword(words, { max = 9, size = 15, rand = Math.random } = {}) {
  const cand = gameWords(words, rand).sort((a, b) => b.key.length - a.key.length).slice(0, 40)
  const grid = new Map() // "r,c" → буква
  const placed = []
  const at = (r, c) => grid.get(`${r},${c}`)
  const fits = (key, r, c, dir) => {
    const dr = dir === 'down' ? 1 : 0
    const dc = dir === 'across' ? 1 : 0
    if (at(r - dr, c - dc) || at(r + dr * key.length, c + dc * key.length)) return -1
    let crossings = 0
    for (let i = 0; i < key.length; i++) {
      const rr = r + dr * i
      const cc = c + dc * i
      const cell = at(rr, cc)
      if (cell) {
        if (cell !== key[i]) return -1
        crossings++
      } else if (at(rr + dc, cc + dr) || at(rr - dc, cc - dr)) {
        return -1 // соседняя параллельная буква — получилось бы лишнее слово
      }
    }
    return crossings
  }
  const place = (item, r, c, dir) => {
    for (let i = 0; i < item.key.length; i++) grid.set(`${r + (dir === 'down' ? i : 0)},${c + (dir === 'across' ? i : 0)}`, item.key[i])
    placed.push({ ...item, r, c, dir })
  }
  if (!cand.length) return null
  place(cand[0], 0, 0, 'across')
  for (const item of cand.slice(1)) {
    if (placed.length >= max) break
    let best = null
    for (const p of placed) {
      for (let i = 0; i < p.key.length; i++) {
        for (let j = 0; j < item.key.length; j++) {
          if (p.key[i] !== item.key[j]) continue
          const dir = p.dir === 'across' ? 'down' : 'across'
          const r = p.dir === 'across' ? p.r - j : p.r + i
          const c = p.dir === 'across' ? p.c + i : p.c - j
          const x = fits(item.key, r, c, dir)
          if (x > 0 && (!best || x > best.x)) best = { r, c, dir, x }
        }
      }
    }
    if (best) {
      const cells = [...grid.keys(), ...Array.from(item.key, (_, k) => `${best.r + (best.dir === 'down' ? k : 0)},${best.c + (best.dir === 'across' ? k : 0)}`)]
      const rs = cells.map((k) => Number(k.split(',')[0]))
      const cs = cells.map((k) => Number(k.split(',')[1]))
      if (Math.max(...rs) - Math.min(...rs) < size && Math.max(...cs) - Math.min(...cs) < size) place(item, best.r, best.c, best.dir)
    }
  }
  // нормализуем координаты и нумеруем
  const minR = Math.min(...placed.map((p) => p.r))
  const minC = Math.min(...placed.map((p) => p.c))
  const items = placed.map((p) => ({ ...p, r: p.r - minR, c: p.c - minC }))
  const rows = Math.max(...items.map((p) => p.r + (p.dir === 'down' ? p.key.length : 1)))
  const cols = Math.max(...items.map((p) => p.c + (p.dir === 'across' ? p.key.length : 1)))
  const starts = [...new Set(items.map((p) => `${p.r},${p.c}`))].sort((a, b) => {
    const [ar, ac] = a.split(',').map(Number)
    const [br, bc] = b.split(',').map(Number)
    return ar - br || ac - bc
  })
  for (const p of items) p.num = starts.indexOf(`${p.r},${p.c}`) + 1
  const solution = {}
  for (const p of items) for (let i = 0; i < p.key.length; i++) solution[`${p.r + (p.dir === 'down' ? i : 0)},${p.c + (p.dir === 'across' ? i : 0)}`] = p.key[i]
  return { rows, cols, items, solution }
}

// ---------- поиск слов ----------

const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1]]
const LETTERS = 'AAABCCDEEEFGGHIIILLMMNNOOOPPQRRSSTTUUVZ'

export function buildWordSearch(words, { size = 10, count = 8, rand = Math.random } = {}) {
  const grid = Array.from({ length: size }, () => Array(size).fill(null))
  const placed = []
  for (const item of gameWords(words, rand).filter((x) => x.key.length <= size)) {
    if (placed.length >= count) break
    for (let attempt = 0; attempt < 80; attempt++) {
      const [dr, dc] = DIRS[Math.floor(rand() * DIRS.length)]
      const r0 = Math.floor(rand() * size)
      const c0 = Math.floor(rand() * size)
      const r1 = r0 + dr * (item.key.length - 1)
      const c1 = c0 + dc * (item.key.length - 1)
      if (r1 < 0 || r1 >= size || c1 < 0 || c1 >= size) continue
      let ok = true
      for (let i = 0; i < item.key.length && ok; i++) {
        const cell = grid[r0 + dr * i][c0 + dc * i]
        if (cell && cell !== item.key[i]) ok = false
      }
      if (!ok) continue
      for (let i = 0; i < item.key.length; i++) grid[r0 + dr * i][c0 + dc * i] = item.key[i]
      placed.push({ ...item, cells: Array.from(item.key, (_, i) => `${r0 + dr * i},${c0 + dc * i}`) })
      break
    }
  }
  for (const row of grid) for (let c = 0; c < size; c++) if (!row[c]) row[c] = LETTERS[Math.floor(rand() * LETTERS.length)]
  return { grid, placed }
}

/** Клетки прямой линии между двумя точками (горизонталь, вертикаль, диагональ) или null. */
export function lineCells(a, b) {
  const [r0, c0] = a.split(',').map(Number)
  const [r1, c1] = b.split(',').map(Number)
  const dr = Math.sign(r1 - r0)
  const dc = Math.sign(c1 - c0)
  const len = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0))
  if (!(r0 === r1 || c0 === c1 || Math.abs(r1 - r0) === Math.abs(c1 - c0))) return null
  return Array.from({ length: len + 1 }, (_, i) => `${r0 + dr * i},${c0 + dc * i}`)
}
