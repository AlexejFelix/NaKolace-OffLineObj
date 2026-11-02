// Jednoduchý SMTP klient (RFC 5321) cez implicitné TLS (port 465) s AUTH PLAIN.
// Text správy je v UTF-8, kódovaný base64 (RFC 2045), predmet a meno odosielateľa
// ako „encoded-word“ (RFC 2047). DKIM podpis pridáva server Websupportu.

export type SmtpNastavenia = {
  host: string
  port: number
  tls: boolean
  pouzivatel: string
  heslo: string
}

export type Sprava = {
  odosielatelEmail: string
  odosielatelMeno: string
  komu: string
  skrytaKopia?: string
  predmet: string
  text: string
}

const enc = new TextEncoder()
const dec = new TextDecoder()

function b64(s: string): string {
  const bajty = enc.encode(s)
  let bin = ''
  for (const b of bajty) bin += String.fromCharCode(b)
  return btoa(bin)
}

function zalomit76(s: string): string {
  return s.replace(/(.{76})/g, '$1\r\n')
}

function encodedWord(s: string): string {
  // Krátky ASCII text ostáva tak, inak =?UTF-8?B?…?= po častiach (max. 45 bajtov),
  // aby riadok hlavičky nepresiahol odporúčanú dĺžku (RFC 2047, časť 2).
  if (/^[\x20-\x7e]*$/.test(s) && s.length <= 60) return s
  const casti: string[] = []
  let aktualna = ''
  for (const znak of s) {
    if (enc.encode(aktualna + znak).length > 45) {
      casti.push(aktualna)
      aktualna = ''
    }
    aktualna += znak
  }
  if (aktualna) casti.push(aktualna)
  return casti.map((c) => `=?UTF-8?B?${b64(c)}?=`).join('\r\n ')
}

function overAdresu(a: string): string {
  const t = a.trim()
  if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(t)) throw new Error(`Neplatná e-mailová adresa: ${a}`)
  return t
}

export function zostavMime(s: Sprava, datum = new Date(), id = crypto.randomUUID()): string {
  const od = overAdresu(s.odosielatelEmail)
  const komu = overAdresu(s.komu)
  const domena = od.split('@')[1]
  const text = s.text.replace(/\r?\n/g, '\r\n')
  const hlavicky = [
    `From: ${encodedWord(s.odosielatelMeno)} <${od}>`,
    `To: <${komu}>`,
    `Reply-To: <${od}>`,
    `Subject: ${encodedWord(s.predmet)}`,
    `Date: ${datum.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${id}@${domena}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ]
  return `${hlavicky.join('\r\n')}\r\n\r\n${zalomit76(b64(text))}\r\n`
}

class Spojenie {
  #conn: Deno.Conn
  #buffer = ''

  constructor(conn: Deno.Conn) {
    this.#conn = conn
  }

  async #citajRiadok(): Promise<string> {
    while (!this.#buffer.includes('\r\n')) {
      const buf = new Uint8Array(4096)
      const n = await this.#conn.read(buf)
      if (n === null) throw new Error('SMTP server ukončil spojenie')
      this.#buffer += dec.decode(buf.subarray(0, n))
    }
    const i = this.#buffer.indexOf('\r\n')
    const riadok = this.#buffer.slice(0, i)
    this.#buffer = this.#buffer.slice(i + 2)
    return riadok
  }

  /** Prečíta (aj viacriadkovú) odpoveď a overí očakávaný kód. */
  async odpoved(ocakavany: number): Promise<string> {
    const riadky: string[] = []
    for (;;) {
      const r = await this.#citajRiadok()
      riadky.push(r)
      if (/^\d{3} /.test(r) || /^\d{3}$/.test(r)) break
      if (!/^\d{3}-/.test(r)) throw new Error(`Neočakávaná odpoveď SMTP: ${r}`)
    }
    const posledny = riadky[riadky.length - 1]
    const kod = Number(posledny.slice(0, 3))
    if (kod !== ocakavany) throw new Error(`SMTP chyba (očakávané ${ocakavany}): ${riadky.join(' | ')}`)
    return riadky.join('\n')
  }

  async posli(riadok: string): Promise<void> {
    const data = enc.encode(riadok + '\r\n')
    let odoslane = 0
    while (odoslane < data.length) odoslane += await this.#conn.write(data.subarray(odoslane))
  }

  zavri() {
    try {
      this.#conn.close()
    } catch {
      // už zatvorené
    }
  }
}

async function sCasovymLimitom<T>(p: Promise<T>, ms: number, popis: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined
  const limit = new Promise<never>((_, nie) => {
    t = setTimeout(() => nie(new Error(`Časový limit vypršal: ${popis}`)), ms)
  })
  try {
    return await Promise.race([p, limit])
  } finally {
    clearTimeout(t)
  }
}

export async function posliEmail(n: SmtpNastavenia, s: Sprava): Promise<void> {
  const mime = zostavMime(s)
  const pripojenie: Promise<Deno.Conn> = n.tls
    ? Deno.connectTls({ hostname: n.host, port: n.port })
    : Deno.connect({ hostname: n.host, port: n.port })
  const conn = await sCasovymLimitom(
    pripojenie,
    15000,
    'pripojenie k SMTP serveru',
  )
  const sp = new Spojenie(conn)
  try {
    await sCasovymLimitom(
      (async () => {
        await sp.odpoved(220)
        await sp.posli(`EHLO ${s.odosielatelEmail.split('@')[1]}`)
        await sp.odpoved(250)
        await sp.posli(`AUTH PLAIN ${b64(`\0${n.pouzivatel}\0${n.heslo}`)}`)
        await sp.odpoved(235)
        await sp.posli(`MAIL FROM:<${overAdresu(s.odosielatelEmail)}>`)
        await sp.odpoved(250)
        await sp.posli(`RCPT TO:<${overAdresu(s.komu)}>`)
        await sp.odpoved(250)
        if (s.skrytaKopia) {
          await sp.posli(`RCPT TO:<${overAdresu(s.skrytaKopia)}>`)
          await sp.odpoved(250)
        }
        await sp.posli('DATA')
        await sp.odpoved(354)
        // base64 telo nikdy nezačína bodkou, hlavičky tiež nie – bodky netreba zdvojovať
        await sp.posli(mime + '.')
        await sp.odpoved(250)
        await sp.posli('QUIT')
      })(),
      60000,
      'odosielanie e-mailu',
    )
  } finally {
    sp.zavri()
  }
}
