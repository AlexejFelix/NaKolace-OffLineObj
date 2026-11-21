import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ALERGENY,
  DOPRAVA_CENA,
  DOPRAVA_ZDARMA_OD,
  PLATBY,
  euro,
  suma,
  type Platba,
  type PolozkaFormular,
  type Prevzatie,
} from '../lib/model'
import { najdiKolizie, ulozObjednavku, upravObjednavku, type Kolizia } from '../lib/objednavky'
import { nacitajDetail, type Detail } from '../lib/detail'
import { naKluc } from '../lib/den'
import './NovaObjednavka.css'

function novyKluc(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function prazdnaPolozka(): PolozkaFormular {
  return { kluc: novyKluc(), productId: null, nazov: '', mnozstvo: 1, cena: null, konfiguracia: '', alergeny: [] }
}

function naCislo(text: string): number | null {
  const t = text.replace(/\s/g, '').replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function naText(n: number | null): string {
  return n === null ? '' : String(n).replace('.', ',')
}

function casText(d: Date): string {
  return new Intl.DateTimeFormat('sk-SK', { hour: '2-digit', minute: '2-digit' }).format(d)
}

type StavKontroly =
  | { typ: 'nic' }
  | { typ: 'kontrola' }
  | { typ: 'volne' }
  | { typ: 'kolizie'; zoznam: Kolizia[] }
  | { typ: 'chyba' }

function dvojmiestne(n: number): string {
  return String(n).padStart(2, '0')
}

export default function NovaObjednavka() {
  const { id } = useParams()
  const [nacitanie, setNacitanie] = useState<{ id: string; detail: Detail | null; chyba: string | null } | null>(null)

  useEffect(() => {
    if (!id) return
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

  if (!id) return <Formular />
  if (!nacitanie || nacitanie.id !== id) return <p className="dp-muted">Načítava sa…</p>
  if (nacitanie.chyba) return <div className="notice notice-error">Objednávku sa nepodarilo načítať: {nacitanie.chyba}</div>
  if (!nacitanie.detail) return <div className="notice notice-warn">Objednávka sa nenašla.</div>
  return <Formular key={id} povodna={nacitanie.detail} />
}

function Formular({ povodna }: { povodna?: Detail }) {
  const navigate = useNavigate()
  const upravujem = Boolean(povodna)
  const [datum, setDatum] = useState(() =>
    povodna?.cas ? `${povodna.cas.getFullYear()}-${dvojmiestne(povodna.cas.getMonth() + 1)}-${dvojmiestne(povodna.cas.getDate())}` : '',
  )
  const [cas, setCas] = useState(() =>
    povodna?.cas ? `${dvojmiestne(povodna.cas.getHours())}:${dvojmiestne(povodna.cas.getMinutes())}` : '',
  )
  const [prevzatie, setPrevzatie] = useState<Prevzatie>(povodna?.prevzatie ?? 'odber')
  const [adresaDorucenia, setAdresaDorucenia] = useState(povodna?.adresaDorucenia ?? '')
  const [rovnakaAdresa, setRovnakaAdresa] = useState(false)

  const [meno, setMeno] = useState(povodna?.meno ?? '')
  const [telefon, setTelefon] = useState(povodna?.telefon ?? '')
  const [email, setEmail] = useState(povodna?.email ?? '')
  const [adresaBydliska, setAdresaBydliska] = useState(povodna?.adresaBydliska ?? '')
  const [ico, setIco] = useState(povodna?.ico ?? '')

  const [polozky, setPolozky] = useState<PolozkaFormular[]>(() =>
    povodna && povodna.polozky.length
      ? povodna.polozky.map((p) => ({
          kluc: p.id,
          id: p.id,
          productId: null,
          nazov: p.nazov,
          mnozstvo: p.mnozstvo,
          cena: p.cena,
          konfiguracia: p.konfiguracia,
          alergeny: [...p.alergeny],
        }))
      : [prazdnaPolozka()],
  )
  const [otvoreneAlergeny, setOtvoreneAlergeny] = useState<string | null>(null)

  const [poznamka, setPoznamka] = useState(povodna?.poznamka ?? '')
  const [platba, setPlatba] = useState<Platba | null>(povodna?.platba ?? null)
  const [zlavaText, setZlavaText] = useState(povodna && povodna.zlava ? naText(povodna.zlava) : '')
  // pri úprave ponecháme uložené dopravné tak, ako je (dá sa vrátiť na automatický výpočet)
  const [dopravaRucne, setDopravaRucne] = useState<string | null>(
    povodna && povodna.prevzatie === 'dorucenie' ? naText(povodna.doprava) : null,
  )

  const [kontrola, setKontrola] = useState<StavKontroly>({ typ: 'nic' })
  const [ukladam, setUkladam] = useState(false)
  const [vysledok, setVysledok] = useState<{ ok: boolean; text: string } | null>(null)

  const termin = useMemo(() => {
    if (!datum || !cas) return null
    const d = new Date(`${datum}T${cas}`)
    return Number.isNaN(d.getTime()) ? null : d
  }, [datum, cas])

  useEffect(() => {
    if (!termin) return
    let aktivne = true
    const casovac = window.setTimeout(() => {
      setKontrola({ typ: 'kontrola' })
      najdiKolizie(termin, prevzatie, povodna?.id)
        .then((zoznam) => {
          if (!aktivne) return
          setKontrola(zoznam.length ? { typ: 'kolizie', zoznam } : { typ: 'volne' })
        })
        .catch(() => {
          if (aktivne) setKontrola({ typ: 'chyba' })
        })
    }, 300)
    return () => {
      aktivne = false
      window.clearTimeout(casovac)
    }
  }, [termin, prevzatie, povodna?.id])

  const medzisucet = suma(polozky)
  const zlava = naCislo(zlavaText) ?? 0
  const dopravaAuto =
    prevzatie === 'dorucenie' && medzisucet - zlava < DOPRAVA_ZDARMA_OD ? DOPRAVA_CENA : 0
  const doprava = prevzatie === 'odber' ? 0 : dopravaRucne !== null ? (naCislo(dopravaRucne) ?? 0) : dopravaAuto
  const spolu = Math.max(0, medzisucet - zlava + doprava)
  const efektivnaAdresa = rovnakaAdresa ? adresaBydliska : adresaDorucenia

  function upravPolozku(kluc: string, zmena: Partial<PolozkaFormular>) {
    setPolozky((zoznam) => zoznam.map((p) => (p.kluc === kluc ? { ...p, ...zmena } : p)))
  }

  function prepniAlergen(kluc: string, cislo: number) {
    setPolozky((zoznam) =>
      zoznam.map((p) => {
        if (p.kluc !== kluc) return p
        const ma = p.alergeny.includes(cislo)
        const nove = ma ? p.alergeny.filter((a) => a !== cislo) : [...p.alergeny, cislo]
        return { ...p, alergeny: nove.sort((a, b) => a - b) }
      }),
    )
  }

  function vycistit() {
    setDatum('')
    setCas('')
    setPrevzatie('odber')
    setAdresaDorucenia('')
    setRovnakaAdresa(false)
    setMeno('')
    setTelefon('')
    setEmail('')
    setAdresaBydliska('')
    setIco('')
    setPolozky([prazdnaPolozka()])
    setOtvoreneAlergeny(null)
    setPoznamka('')
    setPlatba(null)
    setZlavaText('')
    setDopravaRucne(null)
    setKontrola({ typ: 'nic' })
  }

  async function ulozit() {
    setUkladam(true)
    setVysledok(null)
    try {
      const udaje = {
        termin,
        prevzatie,
        meno,
        telefon,
        email,
        adresaBydliska,
        adresaDorucenia: efektivnaAdresa,
        ico,
        poznamka,
        doprava,
        zlava,
        platba,
        polozky: polozky.filter((p) => p.id || p.nazov.trim() !== '' || p.cena !== null),
      }
      if (povodna) {
        await upravObjednavku(povodna.id, udaje)
        const den = termin ? `d=${naKluc(termin)}&` : ''
        navigate(`/?${den}o=${povodna.id}`)
        return
      }
      await ulozObjednavku(udaje)
      vycistit()
      setVysledok({ ok: true, text: 'Objednávka bola uložená.' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      const sprava = e instanceof Error ? e.message : String(e)
      setVysledok({ ok: false, text: `Objednávku sa nepodarilo uložiť: ${sprava}` })
    } finally {
      setUkladam(false)
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <Link to="/" className="back-link">
            ‹ Objednávky
          </Link>
          <h1 className="page-title">{upravujem ? 'Upraviť objednávku' : 'Nová objednávka'}</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to={povodna ? `/?${povodna.cas ? `d=${naKluc(povodna.cas)}&` : ''}o=${povodna.id}` : '/'} className="btn btn-secondary">
            Zrušiť
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => void ulozit()} disabled={ukladam}>
            {ukladam ? 'Ukladám…' : upravujem ? 'Uložiť zmeny' : 'Uložiť objednávku'}
          </button>
        </div>
      </div>

      {vysledok && (
        <div className={`notice ${vysledok.ok ? 'notice-ok' : 'notice-error'}`} role="status" style={{ marginBottom: 18 }}>
          {vysledok.text}
        </div>
      )}

      <div className="no-layout">
        <div className="no-main">
          <section className="card">
            <h2 className="card-title">
              <span className="step-num">1</span>Termín a prevzatie
            </h2>
            <div className="no-grid-termin">
              <label className="field">
                Dátum
                <input className="input" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
              </label>
              <label className="field">
                Čas
                <input className="input" type="time" step={300} value={cas} onChange={(e) => setCas(e.target.value)} />
              </label>
              <div className="field">
                Spôsob prevzatia
                <div className="seg" role="group" aria-label="Spôsob prevzatia">
                  <button type="button" aria-pressed={prevzatie === 'odber'} onClick={() => setPrevzatie('odber')}>
                    Osobný odber
                  </button>
                  <button type="button" aria-pressed={prevzatie === 'dorucenie'} onClick={() => setPrevzatie('dorucenie')}>
                    Doručenie
                  </button>
                </div>
              </div>
            </div>

            {prevzatie === 'dorucenie' && (
              <div className="no-dorucenie">
                <label className="field">
                  Adresa doručenia
                  <input
                    className="input"
                    type="text"
                    value={efektivnaAdresa}
                    disabled={rovnakaAdresa}
                    onChange={(e) => setAdresaDorucenia(e.target.value)}
                  />
                </label>
                <label className="no-check">
                  <input type="checkbox" checked={rovnakaAdresa} onChange={(e) => setRovnakaAdresa(e.target.checked)} />
                  Rovnaká ako adresa bydliska
                </label>
              </div>
            )}

            {termin && (
              <div style={{ marginTop: 14 }}>
                {kontrola.typ === 'kontrola' && <div className="notice" style={{ background: '#f5f4f7', color: 'var(--text-muted)' }}>Kontrolujem termín…</div>}
                {kontrola.typ === 'volne' && <div className="notice notice-ok">V rozmedzí ±30 min nie je žiadna iná objednávka.</div>}
                {kontrola.typ === 'chyba' && <div className="notice notice-error">Termín sa nepodarilo skontrolovať.</div>}
                {kontrola.typ === 'kolizie' && (
                  <div className="notice notice-warn" role="status">
                    <span aria-hidden="true">⚠</span>
                    <span>
                      <strong>
                        V rozmedzí ±30 min {kontrola.zoznam.length === 1 ? 'je 1 objednávka' : `sú ${kontrola.zoznam.length} objednávky`}:
                      </strong>{' '}
                      {kontrola.zoznam
                        .map((k) => `${casText(k.cas)} · ${k.prevzatie === 'dorucenie' ? 'Doručenie' : 'Osobný odber'} · ${k.meno ?? '—'}`)
                        .join('; ')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="card-title">
              <span className="step-num">2</span>Zákazník
            </h2>
            <div className="no-grid-3">
              <label className="field">
                Meno a priezvisko
                <input className="input" type="text" autoComplete="off" value={meno} onChange={(e) => setMeno(e.target.value)} />
              </label>
              <label className="field">
                Telefón
                <input className="input" type="tel" autoComplete="off" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
              </label>
              <label className="field">
                E-mail
                <input className="input" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="field no-span-2">
                Adresa bydliska
                <input className="input" type="text" autoComplete="off" value={adresaBydliska} onChange={(e) => setAdresaBydliska(e.target.value)} />
              </label>
              <label className="field">
                IČO
                <input className="input" type="text" inputMode="numeric" autoComplete="off" value={ico} onChange={(e) => setIco(e.target.value)} />
              </label>
            </div>
          </section>

          <section className="card">
            <div className="no-items-head">
              <h2 className="card-title">
                <span className="step-num">3</span>Položky
              </h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-outline" disabled title="Katalóg nakolace.sk sa ešte pripája">
                  + Z katalógu
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setPolozky((z) => [...z, prazdnaPolozka()])}>
                  + Vlastná položka
                </button>
              </div>
            </div>

            {polozky.map((p) => (
              <div className="no-item" key={p.kluc}>
                <div className="no-item-row">
                  <label className="field no-name">
                    Názov
                    <input className="input" type="text" value={p.nazov} onChange={(e) => upravPolozku(p.kluc, { nazov: e.target.value })} />
                  </label>
                  <div className="field">
                    Množstvo
                    <div className="no-qty">
                      <button type="button" aria-label="Menej" onClick={() => upravPolozku(p.kluc, { mnozstvo: Math.max(1, p.mnozstvo - 1) })}>
                        −
                      </button>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label="Množstvo"
                        value={naText(p.mnozstvo)}
                        onChange={(e) => upravPolozku(p.kluc, { mnozstvo: naCislo(e.target.value) ?? 0 })}
                      />
                      <button type="button" aria-label="Viac" onClick={() => upravPolozku(p.kluc, { mnozstvo: p.mnozstvo + 1 })}>
                        +
                      </button>
                    </div>
                  </div>
                  <label className="field">
                    Cena / ks (€)
                    <input
                      className="input"
                      type="text"
                      inputMode="decimal"
                      value={naText(p.cena)}
                      onChange={(e) => upravPolozku(p.kluc, { cena: naCislo(e.target.value) })}
                    />
                  </label>
                  <div className="no-line-sum">{euro((p.cena ?? 0) * p.mnozstvo)}</div>
                  <button
                    type="button"
                    className="no-remove"
                    aria-label="Odstrániť položku"
                    onClick={() => setPolozky((z) => (z.length > 1 ? z.filter((x) => x.kluc !== p.kluc) : [prazdnaPolozka()]))}
                  >
                    ×
                  </button>
                </div>
                <label className="field">
                  Konfigurácia a želania
                  <input
                    className="input"
                    type="text"
                    placeholder="napr. 20 cm, nápis „Všetko najlepšie“"
                    value={p.konfiguracia}
                    onChange={(e) => upravPolozku(p.kluc, { konfiguracia: e.target.value })}
                  />
                </label>
                <div className="no-alg-row">
                  <span className="no-alg-label">Alergény</span>
                  {otvoreneAlergeny === p.kluc ? (
                    <>
                      {ALERGENY.map((a) => (
                        <button
                          type="button"
                          key={a.cislo}
                          className="alg"
                          aria-pressed={p.alergeny.includes(a.cislo)}
                          title={a.nazov}
                          onClick={() => prepniAlergen(p.kluc, a.cislo)}
                        >
                          {a.cislo}
                        </button>
                      ))}
                      <button type="button" className="btn btn-secondary" style={{ minHeight: 30, padding: '0 12px' }} onClick={() => setOtvoreneAlergeny(null)}>
                        Hotovo
                      </button>
                    </>
                  ) : (
                    <>
                      {p.alergeny.length === 0 && <span className="no-hint">žiadne</span>}
                      {p.alergeny.map((c) => (
                        <span key={c} className="alg" title={ALERGENY.find((a) => a.cislo === c)?.nazov}>
                          {c}
                        </span>
                      ))}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ minHeight: 30, padding: '0 12px' }}
                        onClick={() => setOtvoreneAlergeny(p.kluc)}
                      >
                        Upraviť
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            <p className="no-hint" style={{ margin: 0 }}>
              Alergény podľa prílohy II nariadenia (EÚ) č. 1169/2011. Podržaním myši nad číslom sa zobrazí názov.
            </p>
          </section>
        </div>

        <aside className="no-side">
          <section className="card">
            <h2 className="card-title">
              <span className="step-num">4</span>Objednávka
            </h2>
            <label className="field" style={{ marginBottom: 16 }}>
              Poznámka
              <textarea className="input" rows={3} value={poznamka} onChange={(e) => setPoznamka(e.target.value)} />
            </label>
            <div className="field">
              Spôsob platby
              <div className="no-pay">
                {PLATBY.map((pl) => (
                  <button
                    type="button"
                    key={pl.kod}
                    className="choice"
                    aria-pressed={platba === pl.kod}
                    onClick={() => setPlatba(platba === pl.kod ? null : pl.kod)}
                  >
                    {pl.nazov}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="no-sum-row">
              <span>Položky</span>
              <span>{euro(medzisucet)}</span>
            </div>
            <div className="no-sum-row">
              <span>Zľava (€)</span>
              <input className="input no-sum-input" type="text" inputMode="decimal" aria-label="Zľava v eurách" value={zlavaText} onChange={(e) => setZlavaText(e.target.value)} />
            </div>
            {prevzatie === 'dorucenie' && (
              <div className="no-sum-row">
                <span>
                  Doprava{' '}
                  <span className="tag" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                    zdarma od {euro(DOPRAVA_ZDARMA_OD)}
                  </span>
                </span>
                <input
                  className="input no-sum-input"
                  type="text"
                  inputMode="decimal"
                  aria-label="Doprava v eurách"
                  value={dopravaRucne ?? naText(dopravaAuto)}
                  onChange={(e) => setDopravaRucne(e.target.value)}
                />
              </div>
            )}
            {prevzatie === 'dorucenie' && dopravaRucne !== null && (
              <button type="button" className="no-hint" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setDopravaRucne(null)}>
                Vrátiť automatický výpočet dopravy
              </button>
            )}
            <div className="no-total">
              <span style={{ fontSize: 16, fontWeight: 700 }}>Spolu</span>
              <span className="no-total-value">{euro(spolu)}</span>
            </div>
            <button type="button" className="btn btn-primary no-save" onClick={() => void ulozit()} disabled={ukladam}>
              {ukladam ? 'Ukladám…' : upravujem ? 'Uložiť zmeny' : 'Uložiť objednávku'}
            </button>
          </section>
        </aside>
      </div>
    </section>
  )
}
