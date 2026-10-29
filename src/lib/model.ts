export const ALERGENY: { cislo: number; nazov: string }[] = [
  { cislo: 1, nazov: 'Obilniny obsahujúce lepok' },
  { cislo: 2, nazov: 'Kôrovce' },
  { cislo: 3, nazov: 'Vajcia' },
  { cislo: 4, nazov: 'Ryby' },
  { cislo: 5, nazov: 'Arašidy' },
  { cislo: 6, nazov: 'Sójové zrná' },
  { cislo: 7, nazov: 'Mlieko' },
  { cislo: 8, nazov: 'Orechy' },
  { cislo: 9, nazov: 'Zeler' },
  { cislo: 10, nazov: 'Horčica' },
  { cislo: 11, nazov: 'Sezamové semená' },
  { cislo: 12, nazov: 'Oxid siričitý a siričitany' },
  { cislo: 13, nazov: 'Vlčí bôb' },
  { cislo: 14, nazov: 'Mäkkýše' },
]

export type Prevzatie = 'odber' | 'dorucenie'
export type Platba = 'hotovost' | 'karta' | 'prevod' | 'qr'
export type Stav = 'prijata' | 'skontrolovana' | 'hotova' | 'zrusena'

export const PLATBY: { kod: Platba; nazov: string }[] = [
  { kod: 'hotovost', nazov: 'Hotovosť' },
  { kod: 'karta', nazov: 'Karta' },
  { kod: 'prevod', nazov: 'Prevod' },
  { kod: 'qr', nazov: 'QR kód' },
]

export const STAVY: Record<Stav, string> = {
  prijata: 'Prijatá',
  skontrolovana: 'Skontrolovaná',
  hotova: 'Hotová',
  zrusena: 'Zrušená',
}

export const DOPRAVA_CENA = 5.4
export const DOPRAVA_ZDARMA_OD = 70

export type PolozkaFormular = {
  kluc: string
  productId: string | null
  nazov: string
  mnozstvo: number
  cena: number | null
  konfiguracia: string
  alergeny: number[]
}

export function suma(polozky: PolozkaFormular[]): number {
  return polozky.reduce((s, p) => s + (p.cena ?? 0) * p.mnozstvo, 0)
}

export function euro(hodnota: number): string {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(hodnota)
}
