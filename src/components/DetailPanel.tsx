import { useEffect, useState } from 'react'
import { ALERGENY, PLATBY, STAVY, euro, type Stav } from '../lib/model'
import { monogram, tvar } from '../lib/den'
import {
  SPRAVY,
  nacitajDetail,
  nastavStav,
  odosliEmail,
  odkazWhatsApp,
  oznacObjednavkuHotovu,
  oznacPolozkuHotovu,
  sumaSpolu,
  zostavSpravu,
  type Detail,
  type TypSpravy,
  type ZaznamHistorie,
} from '../lib/detail'
import './DetailPanel.css'

type Props = {
  id: string
  mena: Map<string, string>
  isAdmin: boolean
  verzia: number
  onClose: () => void
  onZmena: () => void
}

type Stav3 = Exclude<Stav, 'zrusena'>
const KROKY: Stav3[] = ['prijata', 'skontrolovana', 'hotova']

function datumCas(d: Date | null): string {
  if (!d) return 'bez termínu'
  const den = new Intl.DateTimeFormat('sk-SK', { weekday: 'short', day: 'numeric', month: 'numeric' }).format(d)
  const cas = new Intl.DateTimeFormat('sk-SK', { hour: '2-digit', minute: '2-digit' }).format(d)
  return `${den} · ${cas}`
}

function kratkyCas(d: Date): string {
  const den = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric' }).format(d)
  const cas = new Intl.DateTimeFormat('sk-SK', { hour: '2-digit', minute: '2-digit' }).format(d)
  return `${den} ${cas}`
}

function nazovAlergenu(c: number): string {
  return ALERGENY.find((a) => a.cislo === c)?.nazov ?? String(c)
}

type Nacitanie = { id: string; verzia: number; detail: Detail | null; chyba: string | null }

export default function DetailPanel({ id, mena, isAdmin, verzia, onClose, onZmena }: Props) {
  const [nacitanie, setNacitanie] = useState<Nacitanie | null>(null)
  const [pracujem, setPracujem] = useState(false)
  const [chybaAkcie, setChybaAkcie] = useState<string | null>(null)
  const [potvrdZrusenie, setPotvrdZrusenie] = useState(false)
  const [koncept, setKoncept] = useState<{ typ: TypSpravy; predmet: string; text: string } | null>(null)
  const [odosielam, setOdosielam] = useState(false)
  const [chybaOdoslania, setChybaOdoslania] = useState<string | null>(null)
  const [odoslane, setOdoslane] = useState<string | null>(null)

  useEffect(() => {
    let aktivne = true
    nacitajDetail(id)
      .then((detail) => {
        if (aktivne) setNacitanie({ id, verzia, detail, chyba: null })
      })
      .catch((e: unknown) => {
        if (aktivne) setNacitanie({ id, verzia, detail: null, chyba: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      aktivne = false
    }
  }, [id, verzia])

  useEffect(() => {
    function naKlaves(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (koncept) {
        if (!odosielam) setKoncept(null)
      } else {
        onClose()
      }
    }
    window.addEventListener('keydown', naKlaves)
    return () => window.removeEventListener('keydown', naKlaves)
  }, [onClose, koncept, odosielam])

  const aktualne = nacitanie !== null && nacitanie.id === id
  const d = aktualne ? nacitanie.detail : null

  async function vykonaj(akcia: () => Promise<void>) {
    setPracujem(true)
    setChybaAkcie(null)
    try {
      await akcia()
      setPotvrdZrusenie(false)
      onZmena()
    } catch (e) {
      setChybaAkcie(e instanceof Error ? e.message : String(e))
    } finally {
      setPracujem(false)
    }
  }

  const meno = (uid: string | null) => (uid ? mena.get(uid) || '—' : '—')

  function otvorKoncept(typ: TypSpravy) {
    if (!d) return
    const s = zostavSpravu(typ, d)
    setChybaOdoslania(null)
    setOdoslane(null)
    setKoncept({ typ, predmet: s.predmet, text: s.text })
  }

  async function odosli() {
    if (!d || !koncept) return
    setOdosielam(true)
    setChybaOdoslania(null)
    try {
      await odosliEmail(d.id, koncept.typ, koncept.predmet, koncept.text)
      setKoncept(null)
      setOdoslane(`E-mail bol odoslaný na ${d.email}.`)
      onZmena()
    } catch (e) {
      setChybaOdoslania(e instanceof Error ? e.message : String(e))
      onZmena()
    } finally {
      setOdosielam(false)
    }
  }

  const nazovSpravy = (t: TypSpravy) => SPRAVY.find((s) => s.typ === t)?.nazov ?? t

  const historia = d
    ? [
        ...d.historia.map((h) => ({ kluc: `s${h.id}`, kedy: h.kedy, text: popisHistorie(h), chyba: false })),
        ...d.spravy.map((m) => ({
          kluc: `m${m.id}`,
          kedy: m.kedy,
          text: `${m.kto ? `${meno(m.kto)} · ` : ''}✉ ${nazovSpravy(m.typ)} → ${m.komu}${m.ok ? '' : ' (neodoslané)'}`,
          chyba: !m.ok,
        })),
      ].sort((a, b) => a.kedy.getTime() - b.kedy.getTime())
    : []

  function popisHistorie(h: ZaznamHistorie): string {
    const kto = h.kto ? `${meno(h.kto)} · ` : ''
    if (h.polozkaId) {
      const p = d?.polozky.find((x) => x.id === h.polozkaId)
      return `${kto}${p?.nazov || 'položka'} → ${STAVY[h.novy]}`
    }
    return `${kto}→ ${STAVY[h.novy]}`
  }

  return (
    <div className="dp-root">
      <div className="dp-overlay" onClick={onClose} aria-hidden="true" />
      <aside className="dp-panel" role="dialog" aria-modal="true" aria-label="Detail objednávky">
        {!aktualne && <div className="dp-loading">Načítava sa…</div>}

        {aktualne && nacitanie.chyba && (
          <div className="dp-body">
            <div className="notice notice-error">Objednávku sa nepodarilo načítať: {nacitanie.chyba}</div>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Zavrieť
            </button>
          </div>
        )}

        {aktualne && !nacitanie.chyba && !d && (
          <div className="dp-body">
            <div className="notice notice-warn">Objednávka sa nenašla (možno bola vymazaná).</div>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Zavrieť
            </button>
          </div>
        )}

        {d && (
          <>
            <header className="dp-head">
              <div className="dp-head-top">
                <div>
                  <div className="eyebrow">Objednávka · prijatá {kratkyCas(d.vytvorena)}</div>
                  <h2 className="dp-name">{d.meno || 'Bez mena'}</h2>
                  <div className="dp-when">
                    <strong>{datumCas(d.cas)}</strong>
                    {d.prevzatie && (
                      <span className={`tag ${d.prevzatie === 'dorucenie' ? 'ob-tag-dor' : 'ob-tag-odb'}`}>
                        {d.prevzatie === 'dorucenie' ? 'Doručenie' : 'Osobný odber'}
                      </span>
                    )}
                  </div>
                </div>
                <button type="button" className="dp-close" aria-label="Zavrieť" onClick={onClose}>
                  ×
                </button>
              </div>

              {d.stav === 'zrusena' ? (
                <div className="notice notice-error dp-cancelled">Táto objednávka je zrušená.</div>
              ) : (
                <div className="dp-steps">
                  {KROKY.map((k, i) => {
                    const aktualnyIndex = KROKY.indexOf(d.stav as Stav3)
                    const trieda = i < aktualnyIndex ? 'is-done' : i === aktualnyIndex ? 'is-current' : ''
                    const znak = i < aktualnyIndex ? '✓ ' : i === aktualnyIndex ? '● ' : ''
                    return isAdmin ? (
                      <button
                        key={k}
                        type="button"
                        className={`dp-step ${trieda}`}
                        title="Nastaviť tento stav"
                        disabled={pracujem || i === aktualnyIndex}
                        onClick={() => void vykonaj(() => (k === 'hotova' ? oznacObjednavkuHotovu(d.id) : nastavStav(d.id, k)))}
                      >
                        {znak}
                        {STAVY[k]}
                      </button>
                    ) : (
                      <span key={k} className={`dp-step ${trieda}`}>
                        {znak}
                        {STAVY[k]}
                      </span>
                    )
                  })}
                </div>
              )}

              <div className="dp-actions">
                {isAdmin && d.stav === 'prijata' && (
                  <button type="button" className="btn btn-primary dp-grow" disabled={pracujem} onClick={() => void vykonaj(() => nastavStav(d.id, 'skontrolovana'))}>
                    Označiť ako skontrolovanú
                  </button>
                )}
                {(d.stav === 'skontrolovana' || (!isAdmin && d.stav === 'prijata')) && (
                  <button type="button" className="btn btn-primary dp-grow" disabled={pracujem} onClick={() => void vykonaj(() => oznacObjednavkuHotovu(d.id))}>
                    Označiť ako hotovú
                  </button>
                )}
                {isAdmin && d.stav !== 'zrusena' && !potvrdZrusenie && (
                  <button type="button" className="btn btn-secondary dp-danger" disabled={pracujem} onClick={() => setPotvrdZrusenie(true)}>
                    Zrušiť
                  </button>
                )}
                {isAdmin && d.stav === 'zrusena' && (
                  <button type="button" className="btn btn-secondary" disabled={pracujem} onClick={() => void vykonaj(() => nastavStav(d.id, 'prijata'))}>
                    Obnoviť objednávku
                  </button>
                )}
              </div>

              {potvrdZrusenie && (
                <div className="notice notice-warn dp-confirm">
                  <span>Naozaj zrušiť túto objednávku?</span>
                  <span className="dp-confirm-btns">
                    <button type="button" className="btn btn-secondary dp-danger" disabled={pracujem} onClick={() => void vykonaj(() => nastavStav(d.id, 'zrusena'))}>
                      Áno, zrušiť
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={pracujem} onClick={() => setPotvrdZrusenie(false)}>
                      Nie
                    </button>
                  </span>
                </div>
              )}

              {chybaAkcie && <div className="notice notice-error">Zmena sa nepodarila: {chybaAkcie}</div>}
            </header>

            <div className="dp-body">
              <dl className="dp-info">
                <div>
                  <dt>Telefón</dt>
                  <dd>{d.telefon ? <a href={`tel:${d.telefon.replace(/[^\d+]/g, '')}`}>{d.telefon}</a> : '—'}</dd>
                </div>
                <div>
                  <dt>E-mail</dt>
                  <dd>{d.email ? <a href={`mailto:${d.email}`}>{d.email}</a> : '—'}</dd>
                </div>
                {d.prevzatie === 'dorucenie' && (
                  <div className="dp-span-2">
                    <dt>Adresa doručenia</dt>
                    <dd>{d.adresaDorucenia || '—'}</dd>
                  </div>
                )}
                <div className="dp-span-2">
                  <dt>Adresa bydliska</dt>
                  <dd>{d.adresaBydliska || '—'}</dd>
                </div>
                <div>
                  <dt>Platba</dt>
                  <dd>{PLATBY.find((p) => p.kod === d.platba)?.nazov ?? '—'}</dd>
                </div>
                <div>
                  <dt>IČO</dt>
                  <dd>{d.ico || '—'}</dd>
                </div>
                {d.poznamka && (
                  <div className="dp-span-2">
                    <dt>Poznámka</dt>
                    <dd className="dp-note">{d.poznamka}</dd>
                  </div>
                )}
              </dl>

              <section className="dp-section">
                <div className="dp-section-head">
                  <h3>Položky</h3>
                  <span className="dp-muted">
                    hotové{' '}
                    <strong>
                      {d.polozky.filter((p) => p.stav === 'hotova').length} / {d.polozky.length}
                    </strong>
                  </span>
                </div>
                {d.polozky.length === 0 && <div className="dp-muted">Objednávka nemá žiadne položky.</div>}
                {d.polozky.map((p) => (
                  <div key={p.id} className="dp-item">
                    <div className="dp-item-main">
                      <div className="dp-item-name">
                        {String(p.mnozstvo).replace('.', ',')}× {p.nazov || 'Bez názvu'}
                      </div>
                      {p.konfiguracia && <div className="dp-item-conf">{p.konfiguracia}</div>}
                      <div className="dp-item-algs">
                        {p.alergeny.length === 0 ? (
                          <span className="dp-muted">Alergény: žiadne</span>
                        ) : (
                          p.alergeny.map((a) => (
                            <span key={a} className="alg ob-alg" title={nazovAlergenu(a)}>
                              {a}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <span className="dp-item-sum">{euro((p.cena ?? 0) * p.mnozstvo)}</span>
                    {p.stav === 'hotova' ? (
                      <span className="dp-done" title={meno(p.madeBy)}>
                        ✓ Hotová{p.madeBy ? ` · ${monogram(meno(p.madeBy))}` : ''}
                      </span>
                    ) : d.stav !== 'zrusena' ? (
                      <button type="button" className="dp-mark" disabled={pracujem} onClick={() => void vykonaj(() => oznacPolozkuHotovu(p.id))}>
                        Označiť hotové
                      </button>
                    ) : null}
                  </div>
                ))}
                <div className="dp-totals">
                  <span>Doprava {euro(d.doprava)}</span>
                  <span>Zľava {euro(d.zlava)}</span>
                  <strong>
                    Spolu <span className="dp-total">{euro(sumaSpolu(d))}</span>
                  </strong>
                </div>
              </section>

              <div className="dp-grid">
                <section className="dp-section">
                  <h3>Správa zákazníkovi</h3>
                  {odoslane && <div className="notice notice-ok">{odoslane}</div>}
                  {SPRAVY.map((s) => {
                    const sprava = zostavSpravu(s.typ, d)
                    const wa = odkazWhatsApp(d.telefon, `${sprava.text}`)
                    return (
                      <div key={s.typ} className="dp-msg">
                        <span>{s.nazov}</span>
                        <span className="dp-msg-btns">
                          {wa ? (
                            <a className="dp-chip dp-wa" href={wa} target="_blank" rel="noreferrer">
                              WhatsApp
                            </a>
                          ) : (
                            <span className="dp-chip is-off" title="Chýba telefónne číslo">
                              WhatsApp
                            </span>
                          )}
                          {d.email.trim() ? (
                            <button type="button" className="dp-chip" onClick={() => otvorKoncept(s.typ)}>
                              E-mail
                            </button>
                          ) : (
                            <span className="dp-chip is-off" title="Chýba e-mail">
                              E-mail
                            </span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </section>

                <section className="dp-section">
                  <h3>Tlač</h3>
                  <button type="button" className="btn btn-outline" disabled title="Tlač sa pripravuje">
                    Preberací protokol
                  </button>
                  <h3 className="dp-history-title">História</h3>
                  <div className="dp-history">
                    <span>{kratkyCas(d.vytvorena)} · prijatá</span>
                    {historia.map((h) => (
                      <span key={h.kluc} className={h.chyba ? 'dp-history-err' : undefined}>
                        {kratkyCas(h.kedy)} · {h.text}
                      </span>
                    ))}
                  </div>
                </section>
              </div>

              {d.polozky.some((p) => p.stav !== 'hotova') && d.stav === 'hotova' && (
                <p className="dp-muted dp-foot-note">
                  Objednávka je hotová, ale{' '}
                  {(() => {
                    const n = d.polozky.filter((p) => p.stav !== 'hotova').length
                    return `${n} ${tvar(n, 'položka nie je označená', 'položky nie sú označené', 'položiek nie je označených')}`
                  })()}{' '}
                  ako hotová.
                </p>
              )}
            </div>
          </>
        )}

        {d && koncept && (
          <div className="dp-compose-wrap">
            <div className="dp-compose" role="dialog" aria-modal="true" aria-label="E-mail zákazníkovi">
              <div className="dp-compose-head">
                <h3>E-mail: {nazovSpravy(koncept.typ)}</h3>
                <button type="button" className="dp-close" aria-label="Zavrieť" disabled={odosielam} onClick={() => setKoncept(null)}>
                  ×
                </button>
              </div>
              <div className="dp-compose-meta">
                <span>
                  Od: <strong>Na Koláče &lt;objednavky@nakolace.sk&gt;</strong>
                </span>
                <span>
                  Komu: <strong>{d.email}</strong>
                </span>
              </div>
              <label className="field">
                Predmet
                <input
                  className="input"
                  type="text"
                  value={koncept.predmet}
                  maxLength={200}
                  onChange={(e) => setKoncept({ ...koncept, predmet: e.target.value })}
                />
              </label>
              <label className="field dp-compose-text">
                Text
                <textarea
                  className="input"
                  rows={14}
                  value={koncept.text}
                  onChange={(e) => setKoncept({ ...koncept, text: e.target.value })}
                />
              </label>
              {chybaOdoslania && <div className="notice notice-error">E-mail sa nepodarilo odoslať: {chybaOdoslania}</div>}
              <div className="dp-compose-actions">
                <button type="button" className="btn btn-secondary" disabled={odosielam} onClick={() => setKoncept(null)}>
                  Zrušiť
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={odosielam || !koncept.predmet.trim() || !koncept.text.trim()}
                  onClick={() => void odosli()}
                >
                  {odosielam ? 'Odosiela sa…' : 'Odoslať'}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
