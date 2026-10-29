import { supabase } from './supabase'
import type { Platba, PolozkaFormular, Prevzatie } from './model'

export type Kolizia = {
  id: string
  cas: Date
  meno: string | null
  prevzatie: Prevzatie | null
}

const POL_HODINY_MS = 30 * 60 * 1000

export async function najdiKolizie(termin: Date, prevzatie: Prevzatie): Promise<Kolizia[]> {
  const od = new Date(termin.getTime() - POL_HODINY_MS).toISOString()
  const do_ = new Date(termin.getTime() + POL_HODINY_MS).toISOString()

  const { data, error } = await supabase
    .from('orders')
    .select('id, scheduled_at, customer_name, fulfillment')
    .gte('scheduled_at', od)
    .lte('scheduled_at', do_)
    .neq('status', 'zrusena')
    .order('scheduled_at')

  if (error) throw error

  return (data ?? [])
    .filter((o) => !(prevzatie === 'odber' && o.fulfillment === 'odber'))
    .map((o) => ({
      id: o.id as string,
      cas: new Date(o.scheduled_at as string),
      meno: o.customer_name as string | null,
      prevzatie: o.fulfillment as Prevzatie | null,
    }))
}

export type NovaObjednavka = {
  termin: Date | null
  prevzatie: Prevzatie
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
  polozky: PolozkaFormular[]
}

export async function ulozObjednavku(o: NovaObjednavka): Promise<string> {
  const objednavka = {
    scheduled_at: o.termin ? o.termin.toISOString() : '',
    fulfillment: o.prevzatie,
    customer_name: o.meno.trim(),
    phone: o.telefon.trim(),
    email: o.email.trim(),
    home_address: o.adresaBydliska.trim(),
    delivery_address: o.prevzatie === 'dorucenie' ? o.adresaDorucenia.trim() : '',
    ico: o.ico.trim(),
    note: o.poznamka.trim(),
    delivery_fee: o.prevzatie === 'dorucenie' ? o.doprava : 0,
    discount: o.zlava,
    payment_method: o.platba ?? '',
  }

  const polozky = o.polozky.map((p) => ({
    product_id: p.productId ?? '',
    name: p.nazov.trim(),
    quantity: p.mnozstvo,
    unit_price: p.cena ?? '',
    configuration: p.konfiguracia.trim(),
    allergens: p.alergeny,
  }))

  const { data, error } = await supabase.rpc('create_order', { p_order: objednavka, p_items: polozky })
  if (error) throw error
  return data as string
}
