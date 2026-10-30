import { supabase } from './supabase'
import type { Prevzatie, Stav } from './model'

export type DenPolozka = {
  id: string
  nazov: string
  mnozstvo: number
  cena: number | null
  konfiguracia: string
  alergeny: number[]
  stav: Stav | null
  madeBy: string | null
}

export type DenObjednavka = {
  id: string
  cas: Date | null
  meno: string
  telefon: string
  prevzatie: Prevzatie | null
  stav: Stav
  doprava: number
  zlava: number
  completedBy: string | null
  polozky: DenPolozka[]
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
  scheduled_at: string | null
  customer_name: string | null
  phone: string | null
  fulfillment: Prevzatie | null
  status: Stav
  delivery_fee: number | string
  discount: number | string
  completed_by: string | null
  order_items: RiadokPolozky[] | null
}

export function zaciatokDna(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function posunDni(d: Date, dni: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dni)
}

export function naKluc(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const den = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${den}`
}

export function zKluca(kluc: string | null): Date | null {
  if (!kluc || !/^\d{4}-\d{2}-\d{2}$/.test(kluc)) return null
  const [r, m, d] = kluc.split('-').map(Number)
  const datum = new Date(r, m - 1, d)
  return datum.getMonth() === m - 1 ? datum : null
}

export async function nacitajDen(den: Date): Promise<DenObjednavka[]> {
  const od = zaciatokDna(den)
  const doDna = posunDni(od, 1)

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, scheduled_at, customer_name, phone, fulfillment, status, delivery_fee, discount, completed_by, order_items(id, position, name, quantity, unit_price, configuration, allergens, status, made_by)',
    )
    .gte('scheduled_at', od.toISOString())
    .lt('scheduled_at', doDna.toISOString())
    .order('scheduled_at')

  if (error) throw error

  return ((data ?? []) as RiadokObjednavky[]).map((o) => ({
    id: o.id,
    cas: o.scheduled_at ? new Date(o.scheduled_at) : null,
    meno: o.customer_name ?? '',
    telefon: o.phone ?? '',
    prevzatie: o.fulfillment,
    stav: o.status,
    doprava: Number(o.delivery_fee) || 0,
    zlava: Number(o.discount) || 0,
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
  }))
}

export async function nacitajMena(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('profiles').select('id, full_name')
  if (error) throw error
  return new Map((data ?? []).map((p) => [p.id as string, (p.full_name as string) ?? '']))
}

export function sumaObjednavky(o: DenObjednavka): number {
  const polozky = o.polozky.reduce((s, p) => s + (p.cena ?? 0) * p.mnozstvo, 0)
  return Math.max(0, polozky - o.zlava + o.doprava)
}

export function monogram(meno: string): string {
  const casti = meno.trim().split(/\s+/).filter(Boolean)
  if (casti.length === 0) return '?'
  if (casti.length === 1) return casti[0].slice(0, 2).toUpperCase()
  return (casti[0][0] + casti[1][0]).toUpperCase()
}

/** Slovenské tvary: 1 → jeden, 2–4 → dva, 0 a 5+ → pat */
export function tvar(n: number, jeden: string, dva: string, pat: string): string {
  if (n === 1) return jeden
  if (n >= 2 && n <= 4) return dva
  return pat
}
