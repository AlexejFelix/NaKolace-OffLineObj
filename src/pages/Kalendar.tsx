import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { STAVY, type Stav } from '../lib/model'
import {
  naKluc,
  nacitajMena,
  nacitajRozsah,
  posunDni,
  rovnakyDen,
  tvar,
  zKluca,
  zaciatokDna,
  zaciatokTyzdna,
  type DenObjednavka,
} from '../lib/den'
import DetailPanel from '../components/DetailPanel'
import './Kalendar.css'

type Pohlad = 'tyzden' | 'mesiac'

const FARBY: Record<Stav, string> = {
  prijata: '#8a8291',
  skontrolovana: '#19caf2',
  hotova: '#2e9e6a',
  zrusena: '#c0392b',
}

const DNI_SKRATKY = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']

function velkePismeno(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function casText(d: Date | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('sk-SK', { hour: '2-digit', minute: '2-digit' }).format(d)
}

function datumKratko(d: Date): string {
  return new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric' }).format(d)
}

function nadpisTyzdna(zac: Date): string {
  const kon = posunDni(zac, 6)
  const f = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' })
  if (zac.getMonth() === kon.getMonth()) {
    return `${zac.getDate()}. – ${f.format(kon)}`
  }
  const bezRoka = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long' })
  return `${bezRoka.format(zac)} – ${f.format(kon)}`
}

function nadpisMesiaca(d: Date): string {
  return velkePismeno(new Intl.DateTimeFormat('sk-SK', { month: 'long', year: 'numeric' }).format(d))
}

type Vysledok = { kluc: string; objednavky: DenObjednavka[]; chyba: string | null }

function Polozka({ o, onOpen, kompakt }: { o: DenObjednavka; onOpen: (id: string) => void; kompakt?: boolean }) {
  return (
    <button
      type="button"
      className={`ka-order${kompakt ? ' is-compact' : ''}${o.stav === 'zrusena' ? ' is-zrusena' : ''}`}
      style={{ borderLeftColor: FARBY[o.stav] }}
      title={`${casText(o.cas)} · ${o.meno || 'Bez mena'} · ${STAVY[o.stav]}`}
      onClick={() => onOpen(o.id)}
    >
      <span className="ka-order-top">
        <strong>{casText(o.cas)}</strong>
        {!kompakt && o.prevzatie && (
          <span className={`tag ${o.prevzatie === 'dorucenie' ? 'ob-tag-dor' : 'ob-tag-odb'}`}>
            {o.prevzatie === 'dorucenie' ? 'Doručenie' : 'Odber'}
          </span>
        )}
      </span>
      <span className="ka-order-name">{o.meno || 'Bez mena'}</span>
      {!kompakt && (
        <span className="ka-order-meta">
          {o.polozky.length} {tvar(o.polozky.length, 'položka', 'položky', 'položiek')} · {STAVY[o.stav]}
        </span>
      )}
    </button>
  )
}

export default function Kalendar() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const pohlad: Pohlad = params.get('pohlad') === 'mesiac' ? 'mesiac' : 'tyzden'
  const kotva = useMemo(() => zKluca(params.get('d')) ?? zaciatokDna(new Date()), [params])
  const otvorena = params.get('o')

  const { od, doDna, dni } = useMemo(() => {
    if (pohlad === 'tyzden') {
      const zac = zaciatokTyzdna(kotva)
      return { od: zac, doDna: posunDni(zac, 7), dni: Array.from({ length: 7 }, (_, i) => posunDni(zac, i)) }
    }
    const prvy = new Date(kotva.getFullYear(), kotva.getMonth(), 1)
    const posledny = new Date(kotva.getFullYear(), kotva.getMonth() + 1, 0)
    const zac = zaciatokTyzdna(prvy)
    const kon = posunDni(zaciatokTyzdna(posledny), 7)
    const pocet = Math.round((kon.getTime() - zac.getTime()) / 86400000)
    return { od: zac, doDna: kon, dni: Array.from({ length: pocet }, (_, i) => posunDni(zac, i)) }
  }, [pohlad, kotva])

  const klucRozsahu = `${naKluc(od)}_${naKluc(doDna)}`
  const [verzia, setVerzia] = useState(0)
  const [vysledok, setVysledok] = useState<Vysledok | null>(null)
  const [mena, setMena] = useState<Map<string, string>>(new Map())
  const [ukazZrusene, setUkazZrusene] = useState(false)

  useEffect(() => {
    let aktivne = true
    nacitajRozsah(od, doDna)
      .then((objednavky) => {
        if (aktivne) setVysledok({ kluc: klucRozsahu, objednavky, chyba: null })
      })
      .catch((e: unknown) => {
        if (aktivne) setVysledok({ kluc: klucRozsahu, objednavky: [], chyba: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      aktivne = false
    }
  }, [od, doDna, klucRozsahu, verzia])

  useEffect(() => {
    let aktivne = true
    nacitajMena()
      .then((m) => {
        if (aktivne) setMena(m)
      })
      .catch(() => {})
    return () => {
      aktivne = false
    }
  }, [verzia])

  useEffect(() => {
    const kanal = supabase
      .channel('objednavky-kalendar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => setVerzia((v) => v + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => setVerzia((v) => v + 1))
      .subscribe()
    return () => {
      void supabase.removeChannel(kanal)
    }
  }, [])

  const nacitava = vysledok === null || vysledok.kluc !== klucRozsahu
  const objednavky = useMemo(
    () => (nacitava || !vysledok ? [] : vysledok.objednavky.filter((o) => ukazZrusene || o.stav !== 'zrusena')),
    [nacitava, vysledok, ukazZrusene],
  )
  const pocetZrusenych = nacitava || !vysledok ? 0 : vysledok.objednavky.filter((o) => o.stav === 'zrusena').length

  const poDnoch = useMemo(() => {
    const m = new Map<string, DenObjednavka[]>()
    for (const o of objednavky) {
      if (!o.cas) continue
      const k = naKluc(o.cas)
      const z = m.get(k) ?? []
      z.push(o)
      m.set(k, z)
    }
    return m
  }, [objednavky])

  const nastav = useCallback(
    (zmena: Record<string, string | null>) => {
      setParams((p) => {
        const n = new URLSearchParams(p)
        for (const [k, v] of Object.entries(zmena)) {
          if (v === null) n.delete(k)
          else n.set(k, v)
        }
        return n
      })
    },
    [setParams],
  )

  function posun(smer: number) {
    const nova =
      pohlad === 'tyzden' ? posunDni(kotva, 7 * smer) : new Date(kotva.getFullYear(), kotva.getMonth() + smer, 1)
    nastav({ d: naKluc(nova), o: null })
  }

  const otvor = useCallback((id: string) => nastav({ o: id }), [nastav])
  const zatvor = useCallback(() => nastav({ o: null }), [nastav])
  const poZmene = useCallback(() => setVerzia((v) => v + 1), [])
  const dnes = zaciatokDna(new Date())

  return (
    <section className="ka">
      <div className="ka-toolbar">
        <div className="ob-views" role="group" aria-label="Zobrazenie">
          <Link to={`/?d=${naKluc(kotva)}`} className="ob-view">
            Deň
          </Link>
          <button
            type="button"
            className={`ob-view ka-view-btn${pohlad === 'tyzden' ? ' is-on' : ''}`}
            aria-pressed={pohlad === 'tyzden'}
            onClick={() => nastav({ pohlad: 'tyzden', o: null })}
          >
            Týždeň
          </button>
          <button
            type="button"
            className={`ob-view ka-view-btn${pohlad === 'mesiac' ? ' is-on' : ''}`}
            aria-pressed={pohlad === 'mesiac'}
            onClick={() => nastav({ pohlad: 'mesiac', o: null })}
          >
            Mesiac
          </button>
        </div>
        <div className="ka-toolbar-right">
          {pocetZrusenych > 0 && (
            <label className="ka-check">
              <input type="checkbox" checked={ukazZrusene} onChange={(e) => setUkazZrusene(e.target.checked)} />
              Zobraziť zrušené ({pocetZrusenych})
            </label>
          )}
          {pohlad === 'tyzden' && (
            <Link to={`/tlac?rozsah=tyzden&d=${naKluc(od)}`} className="btn btn-secondary">
              Tlačiť týždeň
            </Link>
          )}
          {isAdmin && (
            <Link to="/nova" className="btn btn-primary ob-new">
              + Nová objednávka
            </Link>
          )}
        </div>
      </div>

      <div className="ka-head">
        <div>
          <div className="eyebrow">Kalendár</div>
          <h1 className="ka-title">{pohlad === 'tyzden' ? nadpisTyzdna(od) : nadpisMesiaca(kotva)}</h1>
        </div>
        <div className="ob-daynav">
          <button type="button" className="ob-circ" aria-label="Predchádzajúce obdobie" onClick={() => posun(-1)}>
            ‹
          </button>
          <button type="button" className="ob-circ" aria-label="Nasledujúce obdobie" onClick={() => posun(1)}>
            ›
          </button>
          <button type="button" className="ob-today ka-today" onClick={() => nastav({ d: null, o: null })}>
            Dnes
          </button>
        </div>
      </div>

      {vysledok?.chyba && !nacitava && (
        <div className="notice notice-error" role="alert">
          Objednávky sa nepodarilo načítať: {vysledok.chyba}
        </div>
      )}

      {nacitava ? (
        <div className="ob-empty">Načítava sa…</div>
      ) : pohlad === 'tyzden' ? (
        <div className="ka-week">
          {dni.map((den, i) => {
            const zoznam = poDnoch.get(naKluc(den)) ?? []
            return (
              <section key={naKluc(den)} className={`ka-day${rovnakyDen(den, dnes) ? ' is-today' : ''}`}>
                <button type="button" className="ka-day-head" onClick={() => navigate(`/?d=${naKluc(den)}`)}>
                  <span>
                    {DNI_SKRATKY[i]} <strong>{datumKratko(den)}</strong>
                  </span>
                  <span className="ob-count">{zoznam.length}</span>
                </button>
                {zoznam.map((o) => (
                  <Polozka key={o.id} o={o} onOpen={otvor} />
                ))}
                {zoznam.length === 0 && <div className="ka-empty">—</div>}
              </section>
            )
          })}
        </div>
      ) : (
        <div className="ka-month">
          {DNI_SKRATKY.map((d) => (
            <div key={d} className="ka-month-dow">
              {d}
            </div>
          ))}
          {dni.map((den) => {
            const zoznam = poDnoch.get(naKluc(den)) ?? []
            const mimo = den.getMonth() !== kotva.getMonth()
            return (
              <div
                key={naKluc(den)}
                className={`ka-cell${mimo ? ' is-out' : ''}${rovnakyDen(den, dnes) ? ' is-today' : ''}${zoznam.length ? ' has-orders' : ''}`}
              >
                <button type="button" className="ka-cell-head" onClick={() => navigate(`/?d=${naKluc(den)}`)}>
                  <span className="ka-cell-num">{den.getDate()}</span>
                  {zoznam.length > 0 && <span className="ob-count">{zoznam.length}</span>}
                </button>
                <div className="ka-cell-list">
                  {zoznam.slice(0, 3).map((o) => (
                    <Polozka key={o.id} o={o} onOpen={otvor} kompakt />
                  ))}
                  {zoznam.length > 3 && (
                    <button type="button" className="ka-more" onClick={() => navigate(`/?d=${naKluc(den)}`)}>
                      + {zoznam.length - 3} {tvar(zoznam.length - 3, 'ďalšia', 'ďalšie', 'ďalších')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {otvorena && (
        <DetailPanel id={otvorena} mena={mena} isAdmin={isAdmin} verzia={verzia} onClose={zatvor} onZmena={poZmene} />
      )}
    </section>
  )
}
