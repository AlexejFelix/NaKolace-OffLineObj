// Odošle e-mail zákazníkovi z adresy objednavky@nakolace.sk cez SMTP Websupportu
// a zapíše výsledok do tabuľky order_messages (história objednávky).
// Volať môže len prihlásený používateľ aplikácie.
import { withSupabase } from 'npm:@supabase/server@1'
import { posliEmail } from './smtp.ts'

const ODOSIELATEL_EMAIL = 'objednavky@nakolace.sk'
const ODOSIELATEL_MENO = 'Na Koláče'
const SMTP_HOST = 'smtp.m1.websupport.sk'
const SMTP_PORT = 465
const TYPY = ['potvrdenie', 'pripravena', 'pripomienka']

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'Metóda nie je povolená' }, { status: 405 })

    let vstup: { orderId?: unknown; typ?: unknown; predmet?: unknown; text?: unknown }
    try {
      vstup = await req.json()
    } catch {
      return Response.json({ error: 'Neplatné údaje' }, { status: 400 })
    }

    const { orderId, typ, predmet, text } = vstup
    if (
      typeof orderId !== 'string' ||
      typeof typ !== 'string' ||
      !TYPY.includes(typ) ||
      typeof predmet !== 'string' ||
      typeof text !== 'string' ||
      !predmet.trim() ||
      !text.trim() ||
      predmet.length > 200 ||
      text.length > 20000
    ) {
      return Response.json({ error: 'Neplatné údaje' }, { status: 400 })
    }

    // Adresu príjemcu berieme z databázy, nie od prehliadača.
    const { data: objednavka, error: chybaCitania } = await ctx.supabase
      .from('orders')
      .select('id, email')
      .eq('id', orderId)
      .maybeSingle()
    if (chybaCitania) return Response.json({ error: chybaCitania.message }, { status: 500 })
    if (!objednavka) return Response.json({ error: 'Objednávka sa nenašla' }, { status: 404 })

    const komu = String(objednavka.email ?? '').trim()
    if (!komu) return Response.json({ error: 'Objednávka nemá e-mail' }, { status: 400 })

    const heslo = Deno.env.get('SMTP_PASS')
    if (!heslo) return Response.json({ error: 'Chýba nastavenie SMTP_PASS' }, { status: 500 })

    let ok = true
    let chyba: string | null = null
    try {
      await posliEmail(
        { host: SMTP_HOST, port: SMTP_PORT, tls: true, pouzivatel: ODOSIELATEL_EMAIL, heslo },
        {
          odosielatelEmail: ODOSIELATEL_EMAIL,
          odosielatelMeno: ODOSIELATEL_MENO,
          komu,
          skrytaKopia: ODOSIELATEL_EMAIL,
          predmet: predmet.trim(),
          text,
        },
      )
    } catch (e) {
      ok = false
      chyba = e instanceof Error ? e.message : String(e)
    }

    const { error: chybaZapisu } = await ctx.supabaseAdmin.from('order_messages').insert({
      order_id: objednavka.id,
      kind: typ,
      channel: 'email',
      recipient: komu,
      subject: predmet.trim(),
      sent_by: ctx.userClaims?.id ?? null,
      ok,
      error: chyba,
    })

    if (!ok) return Response.json({ error: chyba }, { status: 502 })
    return Response.json({ ok: true, ulozeneDoHistorie: !chybaZapisu })
  }),
}
