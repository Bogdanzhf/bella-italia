import { useApp } from '../state'
import { Castle } from '../components/Decor'

export default function About() {
  const { course } = useApp()
  const photos = Object.entries(course.images ?? {}).filter(([, v]) => v.kind === 'photo')
  return (
    <div className="about">
      <div className="page-head with-art">
        <div>
          <h1>О проекте 🌸</h1>
          <p>
            Bella Italia — платформа для самостоятельного изучения итальянского языка русскоговорящими по программе
            учебника <i>Nuovissimo Progetto italiano 1</i> (Edilingua): юниты 0–11, уровни A0–A2. Объяснения,
            диалоги, тексты и задания написаны для платформы по темам и грамматике учебника.
          </p>
        </div>
        <Castle size={150} />
      </div>
      <section className="card">
        <h2>Иллюстрации</h2>
        <p>
          3D-иллюстрации к словам — <a href="https://github.com/microsoft/fluentui-emoji" target="_blank" rel="noreferrer noopener">Microsoft Fluent Emoji</a>,
          лицензия MIT. Принцесса, замок, птички и цветы нарисованы специально для платформы.
        </p>
      </section>
      <section className="card">
        <h2>Фотографии</h2>
        <p className="muted small">Фотографии с Wikimedia Commons, распространяются по свободным лицензиям.</p>
        <ul className="credits">
          {photos.map(([key, p]) => (
            <li key={key}>
              <b>{p.alt}</b> — {p.credit}, {p.source ? <a href={p.source} target="_blank" rel="noreferrer noopener">{p.license}</a> : p.license}
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>Озвучка и шрифты</h2>
        <p>Озвучка — встроенный синтез речи браузера. Шрифты Nunito и Pacifico (SIL Open Font License).</p>
      </section>
    </div>
  )
}
