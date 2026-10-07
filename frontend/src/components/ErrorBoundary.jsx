import { Component } from 'react'

/**
 * Страховка от белого экрана: если страница упала, показываем сообщение,
 * а меню и переходы продолжают работать. Сбрасывается при смене адреса (key в Layout).
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Ошибка на странице:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <section className="card crash">
        <h2>Ой, эта страница споткнулась 🥀</h2>
        <p className="muted">Попробуйте открыть её ещё раз или вернитесь на главную — прогресс сохранён.</p>
        <div className="row-gap">
          <button className="btn" onClick={() => this.setState({ error: null })}>Попробовать ещё раз</button>
          <a className="btn btn-ghost" href={import.meta.env.BASE_URL}>На главную</a>
        </div>
      </section>
    )
  }
}
