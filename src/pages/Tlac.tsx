import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { euro } from '../lib/model'
import {
  naKluc,
  nacitajRozsah,
  posunDni,
  sumaObjednavky,
  zKluca,
  zaciatokDna,
  zaciatokTyzdna,
  type DenObjednavka,
} from '../lib/den'
import './Tlac.css'

type Rozsah = 'den' | 'tyzden'

function velkePismeno(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function nadpisDna(d: Date): string {
  return velkePismeno(new Intl.DateTimeFormat('sk-SK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d))
}

function casText(d: Date | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('sk-SK', { hour: '2-digit', minute: '2-digit' }).format(d)
}

function mnozstvoText(n: number): string {
  return String(n).replace('.', ',')
}

type Vysledok = { kluc: string; objednavky: DenObjednavka[]; chyba: string | null }

export default function Tlac() {
  const [params, setParams] = useSearchParams()
  const rozsah: Rozsah = params.get('rozsah') === 'tyzden' ? 'tyzden' : 'den'
  const kotva = useMemo(() => zKluca(params.get('d')) ?? zaciatokDna(new Date()), [params])

  const { od, doDna, dni } = useMemo(() => {
    if (rozsah === 'den') return { od: kotva, doDna: posunDni(kotva, 1), dni: [kotva] }
    const zac = zaciatokTyzdna(kotva)
    return { od: zac, doDna: posunDni(zac, 7), dni: Array.from({ length: 7 }, (_, i) => posunDni(zac, i)) }
  }, [rozsah, kotva])

  const kluc = `${naKluc(od)}_${naKluc(doDna)}`
  const [vysledok, setVysledok] = useState<Vysledok | null>(null)

  useEffect(() => {
    let aktivne = true
    nacitajRozsah(od, doDna)
      .then((objednavky) => {
        if (aktivne) setVysledok({ kluc, objednavky, chyba: null })
      })
      .catch((e: unknown) => {
        if (aktivne) setVysledok({ kluc, objednavky: [], chyba: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      aktivne = false
    }
  }, [od, doDna, kluc])

  const nacitava = vysledok === null || vysledok.kluc !== kluc
  // zrušené objednávky sa netlačia
  const objednavky = useMemo(
    () => (nacitava || !vysledok ? [] : vysledok.objednavky.filter((o) => o.stav !== 'zrusena')),
    [nacitava, vysledok],
  )

  function nastav(zmena: Record<string, string>) {
    setParams((p) => {
      const n = new URLSearchParams(p)
      for (const [k, v] of Object.entries(zmena)) n.set(k, v)
      return n
    })
  }

  const nadpis =
    rozsah === 'den'
      ? `Objednávky – ${nadpisDna(kotva)}`
      : `Objednávky – týždeň ${new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric' }).format(od)} – ${new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(posunDni(od, 6))}`

  return (
    <section>
      <div className="no-print">
        <div className="page-head">
          <div>
            <div className="eyebrow">Tlač</div>
            <h1 className="page-title">Zoznam objednávok</h1>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={nacitava}>
            Tlačiť
          </button>
        </div>
        <div className="tl-controls">
          <div className="field">
            Rozsah
            <div className="seg" role="group" aria-label="Rozsah">
              <button type="button" aria-pressed={rozsah === 'den'} onClick={() => nastav({ rozsah: 'den' })}>
                Deň
              </button>
              <button type="button" aria-pressed={rozsah === 'tyzden'} onClick={() => nastav({ rozsah: 'tyzden' })}>
                Týždeň
              </button>
            </div>
          </div>
          <label className="field">
            {rozsah === 'den' ? 'Dátum' : 'Ktorýkoľvek deň v týždni'}
            <input
              className="input"
              type="date"
              value={naKluc(kotva)}
              onChange={(e) => {
                if (e.target.value) nastav({ d: e.target.value })
              }}
            />
          </label>
        </div>
        {vysledok?.chyba && !nacitava && (
          <div className="notice notice-error" style={{ marginBottom: 16 }}>
            Objednávky sa nepodarilo načítať: {vysledok.chyba}
          </div>
        )}
      </div>

      <article className="tl-paper">
        <h1>{nadpis}</h1>
        <p className="tl-sub">
          {nacitava ? 'Načítava sa…' : `${objednavky.length} objednávok · bez zrušených`}
        </p>

        {!nacitava &&
          dni.map((den) => {
            const zoznam = objednavky.filter((o) => o.cas && naKluc(o.cas) === naKluc(den))
            if (rozsah === 'tyzden' && zoznam.length === 0) return null
            let poslednaHodina = -1
            return (
              <section key={naKluc(den)} className="tl-day">
                {rozsah === 'tyzden' && <h2>{nadpisDna(den)}</h2>}
                {zoznam.length === 0 && <div className="tl-none">Žiadne objednávky.</div>}
                {zoznam.map((o) => {
                  const hodina = o.cas ? o.cas.getHours() : -1
                  const novaHodina = hodina !== poslednaHodina
                  poslednaHodina = hodina
                  return (
                    <div key={o.id}>
                      {novaHodina && hodina >= 0 && <div className="tl-hour">{String(hodina).padStart(2, '0')}:00</div>}
                      <div className="tl-order">
                        <div className="tl-order-head">
                          <span>
                            <strong>{casText(o.cas)}</strong> · {o.prevzatie === 'dorucenie' ? 'Doručenie' : o.prevzatie === 'odber' ? 'Osobný odber' : '—'} ·{' '}
                            <strong>{o.meno || 'Bez mena'}</strong>
                            {o.telefon && <> · {o.telefon}</>}
                          </span>
                          <strong>{euro(sumaObjednavky(o))}</strong>
                        </div>
                        {o.prevzatie === 'dorucenie' && o.adresaDorucenia && (
                          <div className="tl-order-addr">Adresa: {o.adresaDorucenia}</div>
                        )}
                        <ul className="tl-items">
                          {o.polozky.map((p) => (
                            <li key={p.id}>
                              <span className="tl-box" aria-hidden="true">
                                ☐
                              </span>
                              <span>
                                {mnozstvoText(p.mnozstvo)}× {p.nazov || 'Bez názvu'}
                                {p.konfiguracia && <span className="tl-conf"> – {p.konfiguracia}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )
                })}
              </section>
            )
          })}
        {!nacitava && rozsah === 'tyzden' && objednavky.length === 0 && <div className="tl-none">Žiadne objednávky.</div>}
      </article>
    </section>
  )
}
