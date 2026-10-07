import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../state'
import { Crown, Garden } from './Decor'
import ErrorBoundary from './ErrorBoundary'

const NAV = [
  { to: '/', label: 'Главная', icon: '🏰', end: true },
  { to: '/course', label: 'Курс', icon: '📚' },
  { to: '/dictionary', label: 'Словарь', icon: '🌸' },
  { to: '/flashcards', label: 'Карточки', icon: '🃏' },
  { to: '/games', label: 'Игры', icon: '🎲' },
  { to: '/verbs', label: 'Глаголы', icon: '🦋' },
  { to: '/tests', label: 'Тесты', icon: '🏆' },
]
// на телефоне в нижней панели помещается 5 пунктов
const MOBILE = ['/', '/course', '/flashcards', '/games', '/tests']

export default function Layout() {
  const { user } = useApp()
  const loc = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])

  return (
    <div className="app">
      <Garden />
      <header className="topbar">
        <NavLink to="/" className="logo">
          <Crown size={32} />
          <span>Bella Italia</span>
        </NavLink>
        <nav className="nav" aria-label="Разделы">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
              <span className="nav-icon" aria-hidden="true">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/profile" className="me" title="Профиль">
          <span className="avatar">{user?.avatar}</span>
          <span className="me-name">{user?.display_name}</span>
        </NavLink>
      </header>
      <main className="page">
        <ErrorBoundary key={loc.pathname}><Outlet /></ErrorBoundary>
      </main>
      <footer className="footer">
        Fatto con 💗 по учебнику <i>Nuovissimo Progetto italiano 1</i> · <NavLink to="/about">О проекте и авторах картинок</NavLink>
      </footer>
      <nav className="tabbar" aria-label="Разделы">
        {NAV.filter((n) => MOBILE.includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="tab-link">
            <span className="tab-icon" aria-hidden="true">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
