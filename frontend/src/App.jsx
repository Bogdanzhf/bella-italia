import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Garden } from './components/Decor'
import Layout from './components/Layout'
import { ErrorBox, Loading } from './components/ui'
import Course from './pages/Course'
import Dashboard from './pages/Dashboard'
import Lesson from './pages/Lesson'
import Login from './pages/Login'
import Unit from './pages/Unit'
import { useApp } from './state'

// редкие разделы грузятся по требованию — первая страница открывается быстрее
const Dictionary = lazy(() => import('./pages/Dictionary'))
const Flashcards = lazy(() => import('./pages/Flashcards'))
const Games = lazy(() => import('./pages/Games'))
const Verbs = lazy(() => import('./pages/Verbs'))
const Tests = lazy(() => import('./pages/Tests'))
const ProgressTest = lazy(() => import('./pages/ProgressTest'))
const Profile = lazy(() => import('./pages/Profile'))
const About = lazy(() => import('./pages/About'))

export default function App() {
  const { user, ready, error, course } = useApp()

  if (!ready) return <Loading text="Открываем ворота замка…" />
  if (error || !course) {
    return (
      <div className="app center-screen">
        <ErrorBox error={error ?? new Error('Курс не загрузился')} />
        <button className="btn" onClick={() => window.location.reload()}>Обновить страницу</button>
      </div>
    )
  }
  if (!user) {
    return (
      <div className="app">
        <Garden />
        <Login />
      </div>
    )
  }

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="course" element={<Course />} />
          <Route path="unit/:unitId" element={<Unit />} />
          <Route path="lesson/:unitId/:slug" element={<Lesson />} />
          <Route path="dictionary" element={<Dictionary />} />
          <Route path="flashcards" element={<Flashcards />} />
          <Route path="games" element={<Games />} />
          <Route path="games/:game" element={<Games />} />
          <Route path="verbs" element={<Verbs />} />
          <Route path="tests" element={<Tests />} />
          <Route path="tests/progress/:testId" element={<ProgressTest />} />
          <Route path="profile" element={<Profile />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
