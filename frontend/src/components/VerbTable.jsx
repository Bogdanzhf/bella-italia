import { SpeakButton } from './ui'

const PERSONS = ['io', 'tu', 'lui / lei', 'noi', 'voi', 'loro']

export default function VerbTable({ verb }) {
  const rows = verb.forms.map((f, i) => ({ p: PERSONS[i], f })).filter((r) => r.f[0] !== '—')
  return (
    <div className="verb-card">
      <div className="verb-head">
        <div>
          <b>{verb.inf}</b> <span className="muted">— {verb.ru}</span>
        </div>
        <span className="tense-pill">{verb.tense}</span>
      </div>
      <table className="verb-table">
        <tbody>
          {rows.map((r) => (
            <tr key={r.p}>
              <td className="muted">{r.p}</td>
              <td>
                {r.f.join(' / ')}
                <SpeakButton text={r.f[0]} small />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
