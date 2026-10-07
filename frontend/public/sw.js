// Service worker: офлайн-доступ к платформе.
// Статика (скрипты, стили, шрифты, картинки) — из кэша; курс и страница — сначала сеть,
// при её отсутствии — кэш. Запросы к API никогда не кэшируются.
const CACHE = 'bella-italia-v2'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './data/course.json', './manifest.webmanifest'])).catch(() => {}))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return

  const immutable = /\/(assets|img|icons)\//.test(url.pathname)
  if (immutable) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()))
        return res
      })),
    )
    return
  }
  // страница и course.json: сеть, а без сети — кэш
  const key = req.mode === 'navigate' ? './index.html' : req
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(key, res.clone()))
        return res
      })
      .catch(() => caches.match(key)),
  )
})
