import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { euro, type Stav } from '../lib/model'
import {
  monogram,
  naKluc,
  nacitajDen,
  nacitajMena,
  posunDni,
  sumaObjednavky,
  tvar,
  zKluca,
  zaciatokDna,
  type DenObjednavka,
} from '../lib/den'
import './Objednavky.css'

function nadpisDna(datum: Date): string {
  const den = new Intl.DateTimeFormat('sk-SK', { weekday: 'long' }).format(datum)
  const zvysok = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long' }).format(datum)
  return `${den.charAt(0).toUpperCase()}${den.slice(1)}, ${zvysok}`
}

function casText(d: Date | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('sk-SK', { hour: '2-digit', minute: '2-digit' }).format(d)
}

function bezDiakritiky(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const STLPCE: { stav: Exclude<Stav, 'zrusena'>; nazov: string; kratko: string; farba: string; popis: string }[] = [
  { stav: 'prijata', nazov: 'Prijatá', kratko: 'Prijatá', farba: '#8a8291', popis: 'čaká na kontrolu' },
  { stav: 'skontrolovana', nazov: 'Skontrolovaná', kratko: 'Kontrola', farba: '#19caf2', popis: 'vo výrobe' },
  { stav: 'hotova', nazov: 'Hotová', kratko: 'Hotová', farba: '#2e9e6a', popis: 'pripravené na odovzdanie' },
]

type Vysledok = { kluc: string; objednavky: DenObjednavka[]; chyba: string | null }

function Karta({ o, mena }: { o: DenObjednavka; mena: Map<string, string> }) {
  const hotove = o.polozky.filter((p) => p.stav === 'hotova').length
  const spolu = o.polozky.length
  const percento = spolu ? Math.round((hotove / spolu) * 100) : 0
  const alergeny = [...new Set(o.polozky.flatMap((p) => p.alergeny))].sort((a, b) => a - b)
  const zvysne = spolu - 3
  const tvorcovia = [
    ...new Set([o.completedBy, ...o.polozky.map((p) => p.madeBy)].filter((x): x is string => Boolean(x))),
  ]
    .map((id) => mena.get(id) ?? '')
    .filter(Boolean)
    .slice(0, 2)

  return (
    <article className={`ob-card${o.stav === 'zrusena' ? ' is-zrusena' : ''}`}>
      <div className="ob-card-top">
        <span className="ob-time">{casText(o.cas)}</span>
        {o.prevzatie && (
          <span className={`tag ${o.prevzatie === 'dorucenie' ? 'ob-tag-dor' : 'ob-tag-odb'}`}>
            {o.prevzatie === 'dorucenie' ? 'Doručenie' : 'Osobný odber'}
          </span>
        )}
      </div>
      <div className="ob-name">{o.meno || 'Bez mena'}</div>
      {spolu > 0 && (
        <div className="ob-items">
          {o.polozky.slice(0, 3).map((p) => (
            <div key={p.id} className="ob-item">
              <strong>{String(p.mnozstvo).replace('.', ',')}×</strong> {p.nazov || 'Bez názvu'}
              {p.konfiguracia && <span className="ob-item-conf"> · {p.konfiguracia}</span>}
            </div>
          ))}
          {zvysne > 0 && (
            <div className="ob-more">
              + {zvysne} {tvar(zvysne, 'ďalšia položka', 'ďalšie položky', 'ďalších položiek')}
            </div>
          )}
        </div>
      )}
      {alergeny.length > 0 && (
        <div className="ob-algs">
          {alergeny.map((a) => (
            <span key={a} className="alg ob-alg">
              {a}
            </span>
          ))}
        </div>
      )}
      {spolu > 0 && (
        <div>
          <div className="ob-progress-head">
            <span>Položky hotové</span>
            <strong>
              {hotove} / {spolu}
            </strong>
          </div>
          <div className="ob-progress">
            <div
              className="ob-progress-bar"
              style={{ width: `${percento}%`, background: percento === 100 ? '#2e9e6a' : 'var(--brand)' }}
            />
          </div>
        </div>
      )}
      <div className="ob-card-foot">
        <span className="ob-sum">{euro(sumaObjednavky(o))}</span>
        <span className="ob-makers">
          {tvorcovia.map((m) => (
            <span key={m} className="ob-maker" title={m}>
              {monogram(m)}
            </span>
          ))}
        </span>
      </div>
    </article>
  )
}

export default function Objednavky() {
  const { isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const den = useMemo(() => zKluca(params.get('d')) ?? zaciatokDna(new Date()), [params])
  const kluc = naKluc(den)

  const [verzia, setVerzia] = useState(0)
  const [vysledok, setVysledok] = useState<Vysledok | null>(null)
  const [mena, setMena] = useState<Map<string, string>>(new Map())
  const [hladanie, setHladanie] = useState('')
  const [mobilStav, setMobilStav] = useState<Exclude<Stav, 'zrusena'>>('prijata')
  const [ukazZrusene, setUkazZrusene] = useState(false)

  useEffect(() => {
    let aktivne = true
    nacitajDen(den)
      .then((objednavky) => {
        if (aktivne) setVysledok({ kluc, objednavky, chyba: null })
      })
      .catch((e: unknown) => {
        if (aktivne) setVysledok({ kluc, objednavky: [], chyba: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      aktivne = false
    }
  }, [den, kluc, verzia])

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
      .channel('objednavky-den')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => setVerzia((v) => v + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => setVerzia((v) => v + 1))
      .subscribe()
    return () => {
      void supabase.removeChannel(kanal)
    }
  }, [])

  const nacitava = vysledok === null || vysledok.kluc !== kluc
  const vsetky = useMemo(() => (nacitava || !vysledok ? [] : vysledok.objednavky), [nacitava, vysledok])

  const filtrovane = useMemo(() => {
    const q = bezDiakritiky(hladanie.trim())
    if (!q) return vsetky
    const qCisla = q.replace(/\D/g, '')
    return vsetky.filter(
      (o) => bezDiakritiky(o.meno).includes(q) || (qCisla.length >= 3 && o.telefon.replace(/\D/g, '').includes(qCisla)),
    )
  }, [vsetky, hladanie])

  const aktivne = filtrovane.filter((o) => o.stav !== 'zrusena')
  const zrusene = filtrovane.filter((o) => o.stav === 'zrusena')
  const pocetOdber = aktivne.filter((o) => o.prevzatie === 'odber').length
  const pocetDorucenie = aktivne.filter((o) => o.prevzatie === 'dorucenie').length
  const sumaDna = aktivne.reduce((s, o) => s + sumaObjednavky(o), 0)

  function nastavDen(d: Date) {
    const dnes = naKluc(zaciatokDna(new Date()))
    const novy = naKluc(d)
    setParams(novy === dnes ? {} : { d: novy })
  }

  return (
    <section className="ob">
      <div className="ob-toolbar">
        <label className="ob-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            aria-label="Hľadať"
            placeholder="Hľadať meno alebo telefón…"
            value={hladanie}
            onChange={(e) => setHladanie(e.target.value)}
          />
        </label>
        <div className="ob-actions">
          <div className="ob-views" role="group" aria-label="Zobrazenie">
            <span className="ob-view is-on" aria-current="page">
              Deň
            </span>
            <Link to="/kalendar" className="ob-view">
              Týždeň
            </Link>
            <Link to="/kalendar" className="ob-view">
              Mesiac
            </Link>
          </div>
          <Link to="/tlac" className="btn btn-secondary">
            Tlačiť deň
          </Link>
          {isAdmin && (
            <Link to="/nova" className="btn btn-primary ob-new">
              + Nová objednávka
            </Link>
          )}
        </div>
      </div>

      <div className="ob-head">
        <div>
          <div className="eyebrow">Objednávky</div>
          <div className="ob-title-row">
            <h1 className="ob-title">{nadpisDna(den)}</h1>
            <div className="ob-daynav">
              <button type="button" className="ob-circ" aria-label="Predchádzajúci deň" onClick={() => nastavDen(posunDni(den, -1))}>
                ‹
              </button>
              <button type="button" className="ob-circ" aria-label="Nasledujúci deň" onClick={() => nastavDen(posunDni(den, 1))}>
                ›
              </button>
              <button type="button" className="ob-today" onClick={() => nastavDen(new Date())}>
                Dnes
              </button>
            </div>
          </div>
        </div>
        <div className="ob-stats">
          <div className="ob-stat">
            <div className="ob-stat-label">Objednávky</div>
            <div className="ob-stat-value">{aktivne.length}</div>
          </div>
          <div className="ob-stat">
            <div className="ob-stat-label">Osobný odber</div>
            <div className="ob-stat-value">{pocetOdber}</div>
          </div>
          <div className="ob-stat">
            <div className="ob-stat-label">Doručenie</div>
            <div className="ob-stat-value">{pocetDorucenie}</div>
          </div>
          <div className="ob-stat">
            <div className="ob-stat-label">Spolu</div>
            <div className="ob-stat-value">{euro(sumaDna)}</div>
          </div>
        </div>
      </div>

      {vysledok?.chyba && !nacitava && (
        <div className="notice notice-error" role="alert">
          Objednávky sa nepodarilo načítať: {vysledok.chyba}
        </div>
      )}

      <div className="ob-tabs seg" role="tablist" aria-label="Stav">
        {STLPCE.map((s) => (
          <button
            key={s.stav}
            type="button"
            role="tab"
            aria-selected={mobilStav === s.stav}
            aria-pressed={mobilStav === s.stav}
            onClick={() => setMobilStav(s.stav)}
          >
            {s.kratko} · {aktivne.filter((o) => o.stav === s.stav).length}
          </button>
        ))}
      </div>

      {nacitava ? (
        <div className="ob-empty">Načítava sa…</div>
      ) : aktivne.length === 0 && zrusene.length === 0 ? (
        <div className="ob-empty">
          {hladanie.trim() ? 'Hľadaniu nezodpovedá žiadna objednávka.' : 'Na tento deň zatiaľ nie sú žiadne objednávky.'}
        </div>
      ) : (
        <div className="ob-board">
          {STLPCE.map((s) => {
            const karty = aktivne.filter((o) => o.stav === s.stav)
            return (
              <section key={s.stav} className={`ob-col${mobilStav === s.stav ? ' is-active' : ''}`} aria-label={s.nazov}>
                <div className="ob-col-head">
                  <div className="ob-col-title">
                    <span className="ob-dot" style={{ background: s.farba }} />
                    <h2>{s.nazov}</h2>
                    <span className="ob-count">{karty.length}</span>
                  </div>
                  <span className="ob-col-hint">{s.popis}</span>
                </div>
                <div className="ob-col-bar" style={{ background: s.farba }} />
                {karty.map((o) => (
                  <Karta key={o.id} o={o} mena={mena} />
                ))}
                {karty.length === 0 && <div className="ob-col-empty">Žiadne objednávky</div>}
              </section>
            )
          })}
        </div>
      )}

      {!nacitava && zrusene.length > 0 && (
        <div className="ob-cancelled">
          <button type="button" className="ob-link" onClick={() => setUkazZrusene((v) => !v)}>
            {ukazZrusene ? 'Skryť zrušené' : `Zobraziť zrušené (${zrusene.length})`}
          </button>
          {ukazZrusene && (
            <div className="ob-cancelled-list">
              {zrusene.map((o) => (
                <Karta key={o.id} o={o} mena={mena} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
