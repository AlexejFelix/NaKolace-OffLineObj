import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ALERGENY, PLATBY, euro } from '../lib/model'
import { naKluc } from '../lib/den'
import { nacitajDetail, sumaPoloziek, sumaSpolu, type Detail } from '../lib/detail'
import './Tlac.css'

const PREDAVAJUCI = [
  'NEOFEN s.r.o. (nakolace.sk)',
  'Námestie Andreja Hlinku 1, 831 06 Bratislava',
  'IČO: 53795041 · IČ DPH: SK2121498016',
  'Mestský súd Bratislava III, oddiel Sro, vložka 162570/B',
]

const VYHLASENIE =
  'Podpisom potvrdzujem prevzatie objednávky v uvedenom rozsahu a oboznámenie sa s uvedenými alergénmi.'

function datumCas(d: Date | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('sk-SK', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function mnozstvoText(n: number): string {
  return String(n).replace('.', ',')
}

type Nacitanie = { id: string; detail: Detail | null; chyba: string | null }

export default function Protokol() {
  const { id = '' } = useParams()
  const [nacitanie, setNacitanie] = useState<Nacitanie | null>(null)

  useEffect(() => {
    let aktivne = true
    nacitajDetail(id)
      .then((detail) => {
        if (aktivne) setNacitanie({ id, detail, chyba: null })
      })
      .catch((e: unknown) => {
        if (aktivne) setNacitanie({ id, detail: null, chyba: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      aktivne = false
    }
  }, [id])

  const d = nacitanie && nacitanie.id === id ? nacitanie.detail : null
  const spat = d ? `/?${d.cas ? `d=${naKluc(d.cas)}&` : ''}o=${d.id}` : '/'
  const alergeny = d ? [...new Set(d.polozky.flatMap((p) => p.alergeny))].sort((a, b) => a - b) : []

  return (
    <section>
      <div className="no-print page-head">
        <div>
          <Link to={spat} className="back-link">
            ‹ Späť na objednávku
          </Link>
          <h1 className="page-title">Preberací protokol</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={!d}>
          Tlačiť
        </button>
      </div>

      {(!nacitanie || nacitanie.id !== id) && <p className="no-print">Načítava sa…</p>}
      {nacitanie?.chyba && <div className="notice notice-error no-print">Objednávku sa nepodarilo načítať: {nacitanie.chyba}</div>}
      {nacitanie && nacitanie.id === id && !nacitanie.chyba && !d && (
        <div className="notice notice-warn no-print">Objednávka sa nenašla.</div>
      )}

      {d && (
        <article className="tl-paper pp-paper">
          <div className="pp-top">
            <div className="pp-seller">
              <strong>{PREDAVAJUCI[0]}</strong>
              {PREDAVAJUCI.slice(1).map((r) => (
                <div key={r}>{r}</div>
              ))}
            </div>
            <div className="pp-title">
              <h1>Preberací protokol</h1>
              <div>Objednávka prijatá {new Intl.DateTimeFormat('sk-SK').format(d.vytvorena)}</div>
            </div>
          </div>

          <dl className="pp-grid">
            <div>
              <dt>Zákazník</dt>
              <dd>{d.meno || '—'}</dd>
            </div>
            <div>
              <dt>Telefón</dt>
              <dd>{d.telefon || '—'}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{d.email || '—'}</dd>
            </div>
            <div>
              <dt>IČO</dt>
              <dd>{d.ico || '—'}</dd>
            </div>
            <div>
              <dt>Termín</dt>
              <dd>{datumCas(d.cas)}</dd>
            </div>
            <div>
              <dt>Prevzatie</dt>
              <dd>{d.prevzatie === 'dorucenie' ? 'Doručenie' : d.prevzatie === 'odber' ? 'Osobný odber' : '—'}</dd>
            </div>
            {d.prevzatie === 'dorucenie' && (
              <div className="pp-span-2">
                <dt>Adresa doručenia</dt>
                <dd>{d.adresaDorucenia || '—'}</dd>
              </div>
            )}
            <div>
              <dt>Platba</dt>
              <dd>{PLATBY.find((p) => p.kod === d.platba)?.nazov ?? '—'}</dd>
            </div>
            {d.poznamka && (
              <div className="pp-span-2">
                <dt>Poznámka</dt>
                <dd>{d.poznamka}</dd>
              </div>
            )}
          </dl>

          <table className="pp-table">
            <thead>
              <tr>
                <th>Položka</th>
                <th className="pp-num">Množstvo</th>
                <th className="pp-num">Cena/ks</th>
                <th className="pp-num">Spolu</th>
                <th>Alergény</th>
              </tr>
            </thead>
            <tbody>
              {d.polozky.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.nazov || 'Bez názvu'}</strong>
                    {p.konfiguracia && <div>{p.konfiguracia}</div>}
                  </td>
                  <td className="pp-num">{mnozstvoText(p.mnozstvo)}</td>
                  <td className="pp-num">{p.cena === null ? '—' : euro(p.cena)}</td>
                  <td className="pp-num">{euro((p.cena ?? 0) * p.mnozstvo)}</td>
                  <td>{p.alergeny.length ? p.alergeny.join(', ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pp-totals">
            <span>Položky {euro(sumaPoloziek(d))}</span>
            <span>Doprava {euro(d.doprava)}</span>
            <span>Zľava {euro(d.zlava)}</span>
            <strong>Spolu {euro(sumaSpolu(d))}</strong>
          </div>

          <section className="pp-allergens">
            <h2>Alergény v objednávke</h2>
            {alergeny.length === 0 ? (
              <div>Žiadne uvedené alergény.</div>
            ) : (
              <ul>
                {alergeny.map((a) => (
                  <li key={a}>
                    {a} – {ALERGENY.find((x) => x.cislo === a)?.nazov ?? ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="pp-declaration">{VYHLASENIE}</p>

          <div className="pp-signs">
            <div className="pp-sign">Dátum a čas prevzatia</div>
            <div className="pp-sign">Meno a podpis preberajúceho</div>
          </div>
        </article>
      )}
    </section>
  )
}
