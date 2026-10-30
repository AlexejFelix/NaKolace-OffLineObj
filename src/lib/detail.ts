import { supabase } from './supabase'
import { euro, type Platba, type Prevzatie, type Stav } from './model'

export type DetailPolozka = {
  id: string
  nazov: string
  mnozstvo: number
  cena: number | null
  konfiguracia: string
  alergeny: number[]
  stav: Stav | null
  madeBy: string | null
}

export type ZaznamHistorie = {
  id: number
  kedy: Date
  kto: string | null
  polozkaId: string | null
  stary: Stav | null
  novy: Stav
}

export type Detail = {
  id: string
  vytvorena: Date
  cas: Date | null
  prevzatie: Prevzatie | null
  meno: string
  telefon: string
  email: string
  adresaBydliska: string
  adresaDorucenia: string
  ico: string
  poznamka: string
  doprava: number
  zlava: number
  platba: Platba | null
  stav: Stav
  completedBy: string | null
  polozky: DetailPolozka[]
  historia: ZaznamHistorie[]
}

type RiadokPolozky = {
  id: string
  position: number
  name: string | null
  quantity: number | string
  unit_price: number | string | null
  configuration: string | null
  allergens: number[] | null
  status: Stav | null
  made_by: string | null
}

type RiadokObjednavky = {
  id: string
  created_at: string
  scheduled_at: string | null
  fulfillment: Prevzatie | null
  customer_name: string | null
  phone: string | null
  email: string | null
  home_address: string | null
  delivery_address: string | null
  ico: string | null
  note: string | null
  delivery_fee: number | string
  discount: number | string
  payment_method: Platba | null
  status: Stav
  completed_by: string | null
  order_items: RiadokPolozky[] | null
}

type RiadokHistorie = {
  id: number
  item_id: string | null
  old_status: Stav | null
  new_status: Stav
  changed_by: string | null
  changed_at: string
}

export async function nacitajDetail(id: string): Promise<Detail | null> {
  const [obj, hist] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, created_at, scheduled_at, fulfillment, customer_name, phone, email, home_address, delivery_address, ico, note, delivery_fee, discount, payment_method, status, completed_by, order_items(id, position, name, quantity, unit_price, configuration, allergens, status, made_by)',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('order_status_log')
      .select('id, item_id, old_status, new_status, changed_by, changed_at')
      .eq('order_id', id)
      .order('changed_at'),
  ])

  if (obj.error) throw obj.error
  if (hist.error) throw hist.error
  if (!obj.data) return null

  const o = obj.data as RiadokObjednavky
  return {
    id: o.id,
    vytvorena: new Date(o.created_at),
    cas: o.scheduled_at ? new Date(o.scheduled_at) : null,
    prevzatie: o.fulfillment,
    meno: o.customer_name ?? '',
    telefon: o.phone ?? '',
    email: o.email ?? '',
    adresaBydliska: o.home_address ?? '',
    adresaDorucenia: o.delivery_address ?? '',
    ico: o.ico ?? '',
    poznamka: o.note ?? '',
    doprava: Number(o.delivery_fee) || 0,
    zlava: Number(o.discount) || 0,
    platba: o.payment_method,
    stav: o.status,
    completedBy: o.completed_by,
    polozky: [...(o.order_items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((p) => ({
        id: p.id,
        nazov: p.name ?? '',
        mnozstvo: Number(p.quantity) || 0,
        cena: p.unit_price === null ? null : Number(p.unit_price),
        konfiguracia: p.configuration ?? '',
        alergeny: p.allergens ?? [],
        stav: p.status,
        madeBy: p.made_by,
      })),
    historia: ((hist.data ?? []) as RiadokHistorie[]).map((h) => ({
      id: h.id,
      kedy: new Date(h.changed_at),
      kto: h.changed_by,
      polozkaId: h.item_id,
      stary: h.old_status,
      novy: h.new_status,
    })),
  }
}

/** Admin: ľubovoľná zmena stavu objednávky (RLS povolí len administrátorovi). */
export async function nastavStav(id: string, stav: Stav): Promise<void> {
  const { error } = await supabase.from('orders').update({ status: stav }).eq('id', id)
  if (error) throw error
}

/** Každý prihlásený: objednávka „Hotová“ pod vlastným menom. */
export async function oznacObjednavkuHotovu(id: string): Promise<void> {
  const { error } = await supabase.rpc('mark_order_done', { p_order_id: id })
  if (error) throw error
}

/** Každý prihlásený: položka „Hotová“ pod vlastným menom. */
export async function oznacPolozkuHotovu(id: string): Promise<void> {
  const { error } = await supabase.rpc('mark_item_done', { p_item_id: id })
  if (error) throw error
}

export function sumaPoloziek(d: Detail): number {
  return d.polozky.reduce((s, p) => s + (p.cena ?? 0) * p.mnozstvo, 0)
}

export function sumaSpolu(d: Detail): number {
  return Math.max(0, sumaPoloziek(d) - d.zlava + d.doprava)
}

// ---------- Správy zákazníkovi (text podľa SPECIFIKACIO.md, časť 9) ----------

const ADRESA_ODBERU = 'Námestie Andreja Hlinku 1, 831 06 Bratislava – Rača'

export type TypSpravy = 'potvrdenie' | 'pripravena' | 'pripomienka'

export const SPRAVY: { typ: TypSpravy; nazov: string }[] = [
  { typ: 'potvrdenie', nazov: 'Potvrdenie' },
  { typ: 'pripravena', nazov: 'Je pripravená' },
  { typ: 'pripomienka', nazov: 'Pripomienka' },
]

function datumText(d: Date | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(d)
}

function casText(d: Date | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('sk-SK', { hour: '2-digit', minute: '2-digit' }).format(d)
}

function mnozstvoText(n: number): string {
  return String(n).replace('.', ',')
}

export function zostavSpravu(typ: TypSpravy, d: Detail): { predmet: string; text: string } {
  const oslovenie = d.meno.trim() ? `Dobrý deň, ${d.meno.trim()},` : 'Dobrý deň,'
  const datum = datumText(d.cas)
  const cas = casText(d.cas)
  const dorucenie = d.prevzatie === 'dorucenie'
  const podpis = 'S pozdravom\nTím Na Koláče'

  if (typ === 'potvrdenie') {
    const zoznam = d.polozky
      .map((p) => `• ${mnozstvoText(p.mnozstvo)}× ${p.nazov}${p.konfiguracia ? ` (${p.konfiguracia})` : ''}`)
      .join('\n')
    const prevzatie = dorucenie
      ? `Doručenie: ${datum} o ${cas}, na adresu ${d.adresaDorucenia || '—'}`
      : `Osobný odber: ${datum} o ${cas}, ${ADRESA_ODBERU}`
    return {
      predmet: 'Potvrdenie objednávky – Na Koláče',
      text: [
        oslovenie,
        '',
        'ďakujeme za Vašu objednávku. Potvrdzujeme:',
        '',
        zoznam,
        `Spolu: ${euro(sumaSpolu(d))}`,
        '',
        prevzatie,
        '',
        'Ak by ste potrebovali niečo zmeniť, kontaktujte nás.',
        '',
        podpis,
      ].join('\n'),
    }
  }

  if (typ === 'pripravena') {
    const veta = dorucenie
      ? `Doručíme Vám ju ${datum} o ${cas}.`
      : `Môžete si ju vyzdvihnúť ${datum} o ${cas}, ${ADRESA_ODBERU}.`
    return {
      predmet: 'Vaša objednávka je pripravená – Na Koláče',
      text: [oslovenie, '', 'Vaša objednávka je pripravená.', veta, '', podpis].join('\n'),
    }
  }

  const veta = dorucenie ? `Doručenie na adresu ${d.adresaDorucenia || '—'}.` : `Tešíme sa na Vás, ${ADRESA_ODBERU}.`
  return {
    predmet: 'Pripomienka objednávky – Na Koláče',
    text: [oslovenie, '', `pripomíname Vašu objednávku na ${datum} o ${cas}.`, veta, '', podpis].join('\n'),
  }
}

/**
 * Telefónne číslo v medzinárodnom tvare bez „+“ pre wa.me.
 * +421…/00421… → 421…, slovenský národný tvar 0… → 421… (bez úvodnej 0).
 */
export function telefonPreWhatsApp(telefon: string): string | null {
  const t = telefon.trim()
  if (!t) return null
  let cisla = t.replace(/\D/g, '')
  if (t.startsWith('+')) {
    // už medzinárodný tvar
  } else if (cisla.startsWith('00')) {
    cisla = cisla.slice(2)
  } else if (cisla.startsWith('0')) {
    cisla = '421' + cisla.slice(1)
  }
  return cisla.length >= 9 ? cisla : null
}

export function odkazWhatsApp(telefon: string, text: string): string | null {
  const cislo = telefonPreWhatsApp(telefon)
  return cislo ? `https://wa.me/${cislo}?text=${encodeURIComponent(text)}` : null
}

export function odkazEmail(email: string, predmet: string, text: string): string | null {
  const e = email.trim()
  if (!e) return null
  return `mailto:${e}?subject=${encodeURIComponent(predmet)}&body=${encodeURIComponent(text)}`
}
