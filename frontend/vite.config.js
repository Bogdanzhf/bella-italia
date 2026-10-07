import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// npm run build         — версия для сервера FastAPI (адреса от корня сайта)
// npm run build:static  — статический сайт для GitHub Pages: прогресс хранится на устройстве,
//                         относительные пути (сайт может жить в подпапке), маршруты через #
export default defineConfig(({ mode }) => ({
  base: mode === 'static' ? './' : '/',
  plugins: [react()],
  define: mode === 'static' ? { 'import.meta.env.VITE_STATIC': JSON.stringify('1') } : {},
  build: { outDir: mode === 'static' ? 'dist-static' : 'dist' },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8765' },
  },
}))
