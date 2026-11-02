# Projekttérkép – Telefonické objednávky (nakolace.sk)

Mi hol van, mi mivel kapcsolódik, és milyen tanulságokat vontunk le. A funkcionális követelmények a `SPECIFIKACIO.md`-ben vannak; ez a fájl a működés és a környezet leírása.
Utolsó frissítés: 2026-11-02.

## Munkaszabályok (a tulajdonos kérése)
- Magyarul, tegezve, tömören. Találgatni tilos: ha valami nem biztos, kérdezni kell, vagy elsődleges forrásból ellenőrizni.
- **Egy üzenet = egy lépés**, böngészős kattintásnál is. Utána meg kell várni a választ.
- Minden terminálos lépésnél meg kell adni a **gépet** és a **teljes mappa-útvonalat**, a parancs után pedig egyszerű magyarázatot is (mit csinál, mit jelentenek a rövidítések).
- Mindig a legjobban működő megoldás kell, nem a legegyszerűbb.
- A GitHub-repókat a tulajdonos maga hozza létre a github.com-on.
- Az app felülete szlovák nyelvű.

## Gépek és mappák
| Gép | Projektmappa | Megjegyzés |
|---|---|---|
| Mac mini (`mikimini2`, Peters-Mac-mini) | `/Users/mikimini2/NaKolace-OffLineObj` | Fő fejlesztőgép. Node 26. A git HTTPS-belépés működik. A git név/e-mail nincs beállítva (TODO). |
| MacBook Pro (`admin`) | `/Users/admin/NaKolace-OffLineObj` | Node 22.15, Homebrew. A GitHub-belépés `gh auth login`-nal van beállítva (2026-10-30). |

- Új terminálablak mindig a home mappában (`~`) nyílik, ezért a parancsok elején legyen `cd <teljes út> &&`.
- Dev szerver: `npm run dev`, a cím: `http://localhost:5173`. Külön ablakban fut, Ctrl+C-vel áll le.
- Új csomag érkezése után (`git pull` / `git switch` után) futtatni kell: `npm install`.

## Kód és verziókezelés
- Repó: **AlexejFelix/NaKolace-OffLineObj** (privát), a `main` a stabil ág.
- **Munkamenet:** Claude a kódot egy `claude/<téma>` ágra tölti fel, a tulajdonos lehúzza (`git fetch origin && git switch <ág>`), kipróbálja, utána Claude előretekeri a `main`-t (fast-forward), a gépeken pedig `git pull` következik.
  - Ehhez a Claude GitHub-app telepítve van, de csak erre a repóra.
- **Hosszú kódot nem illesztünk be a terminálba** (heredoc). Elvágódik, és `heredoc>` állapotban marad. Ha mégis muszáj: legfeljebb kb. 150 sor egy darabban, és a végén `shasum -a 256` ellenőrzés.
- Ellenőrzés commit előtt: `npm run build` (tsc + vite). Az `npm run lint` jelenleg 1 régi hibát jelez az `src/lib/auth.tsx`-ben (react-refresh/only-export-components); ez ismert, és nem blokkol.
- A weboldal (nakolace.sk, Payload CMS) forráskódja: **AlexejFelix/NaKolace-sk**. A rendelések és termékek gyűjteményének neve (slug) és az olvasási jogosultság még nincs ellenőrizve.

## Frontend (Vite 8 + React 19 + TypeScript, react-router-dom 7)
| Fájl | Szerep |
|---|---|
| `src/main.tsx` | Betöltés: Source Serif 4 betűtípus (fontsource), `index.css`, `ui.css` |
| `src/index.css` | Színek és betűk (`--brand #860f7a`, `--accent #19caf2` stb.) |
| `src/ui.css` | Közös osztályok: `.btn*`, `.card`, `.field`, `.input`, `.seg`, `.choice`, `.tag`, `.alg`, `.notice*` |
| `src/App.tsx` | Útvonalak: `/prihlasenie`; védett: `/` (napi nézet), `/nova` (csak admin), `/kalendar` és `/tlac` (még üres) |
| `src/components/Layout.*` | Oldalsáv (desktop), alsó sáv + „+” gomb (mobil, ≤760px) |
| `src/lib/supabase.ts` | Supabase kliens a `.env.local`-ból (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) |
| `src/lib/auth.tsx` | `useAuth()`: session, profil, `isAdmin`, kijelentkezés |
| `src/lib/model.ts` | Allergének (EU 14), fizetési módok, státuszok, szállítás: 5,40 €, 70 €-tól ingyenes |
| `src/lib/objednavky.ts` | ±30 perces ütközésellenőrzés, mentés `create_order` RPC-vel |
| `src/lib/den.ts` | Egy nap rendeléseinek betöltése, segédfüggvények, szlovák számalakok (`tvar`) |
| `src/lib/detail.ts` | Egy rendelés részletei + napló + elküldött üzenetek; státuszműveletek; üzenetsablonok; WhatsApp-link; `odosliEmail` |
| `src/pages/NovaObjednavka.*` | Új rendelés űrlapja |
| `src/pages/Objednavky.*` | Napi Kanban-nézet. A `?d=YYYY-MM-DD` választja a napot, a `?o=<id>` nyitja meg a részletek panelt. Élő frissítés Supabase Realtime-mal. |
| `src/components/DetailPanel.*` | Részletek oldalpanel, e-mail-ablak (előnézet + küldés) |

- `.env.local` minden gépen külön van (gitignore), és nincs a GitHubon.
- WhatsApp: `wa.me` link, kézi küldés. A 0-val kezdődő számot szlovák számnak veszi (0905… → 421905…).

## Supabase (backend)
- Projekt: **NaKolace-Objednavky**, ref `neymfrficyfktiiemstg`, NEOFEN szervezet, **ingyenes csomag**.
  - Egy hét használat nélkül szünetel; a dashboardon kell újraindítani.
- Dashboard: `https://supabase.com/dashboard/project/neymfrficyfktiiemstg`
- Az SQL-t a dashboard **SQL Editorában** futtatjuk. Lefutott: `0001_alap_sema.sql`, `0002_create_order.sql`, `0003_order_messages.sql`.

**Táblák**
- `profiles`
- `products`
- `orders`
- `order_items`
- `order_status_log` (trigger tölti)
- `order_messages` (elküldött e-mailek; csak a szerverfüggvény ír bele)

**RLS:** olvasni minden bejelentkezett felhasználó tud. Írni csak admin, kivéve:
- `mark_order_done` és `mark_item_done`: minden felhasználó (security definer, a saját nevével);
- `create_order`: csak admin.

**Szerverfüggvény (Edge Function) – e-mail-küldés**
- Slug: **`quick-endpoint`**. A dashboard automatikusan adta ezt a nevet, és utólag nem módosítható. A kód: `supabase/functions/quick-endpoint/` (`index.ts` + `smtp.ts`). Az app így hívja: `supabase.functions.invoke('quick-endpoint')`.
- „Verify JWT with legacy secret”: **KI**. A hitelesítést a kód végzi: `withSupabase({ auth: 'user' })` az `npm:@supabase/server@1` csomagból, ez a CORS-t is kezeli.
- Titkos beállítás (Secrets): **`SMTP_PASS`**, az `objednavky@nakolace.sk` postafiók jelszava. Soha nem kerül a kódba.
- Működés:
  - a címzettet az adatbázisból veszi;
  - a feladó `Na Koláče <objednavky@nakolace.sk>`;
  - rejtett másolatot (BCC) küld az `objednavky@` címre, hogy ott is megmaradjon a levél;
  - az eredményt beírja az `order_messages` táblába.
- Dashboard-telepítés tanulságai:
  - a **Function name** mezőt *telepítés előtt* kell kitölteni;
  - minden fájlnak benne kell lennie (Add File), különben „Module not found”.
- A `SMTP_Test` próbafüggvény törölhető (a 465-ös port elérhetőségét bizonyította).

## E-mail (WebSupport)
- SMTP: **`smtp.m1.websupport.sk`, 465-ös port, SSL (implicit TLS)**, a belépéshez a teljes e-mail-cím kell.
  - A Supabase Edge Functions nem engedi a kimenő kapcsolatot a **25-ös és az 587-es** portra (hivatalos limit), a 465-ös működik (2026-11-02, a szerver válasza: „220 … ESMTP”).
- A nakolace.sk DNS-e a **WebSupport Webadminban** van (Služby → yndex_3 → nakolace.sk → DNS → DNS nastavenia; e-mail-beállítások: Emaily → Bezpečnosť domény).
- A kézbesíthetőség ellenőrizve (2026-11-02):
  - **SPF:** `v=spf1 a mx ip4:109.74.144.8 ip6:2a01:390:b:0::/64 ip6:2a01:390:1:5::/64 include:_spf.m1.websupport.sk include:spf.brevo.com ~all`
  - **DKIM:** az aláírás be van kapcsolva, a kulcs a `mail._domainkey`-ben van.
  - **DMARC:** `v=DMARC1; p=none; …`
  - Az `spf2.0/pra…` sor régi (Sender ID), nem kell hozzányúlni.
- Hátravan: az első éles levél fejlécében ellenőrizni, hogy az SPF, a DKIM és a DMARC is „pass”.

## Állapot (2026-11-02)
- `main`: bejelentkezés, új rendelés űrlapja, napi Kanban-nézet, részletek panel.
- `claude/email-smtp`: szerveroldali e-mail-küldés. A függvény telepítve van (`quick-endpoint`), az éles próba még hátravan, utána jön a beolvasztás.
- Teendők: rendelés szerkesztése (Upraviť), heti/havi nézet, nyomtatás (napi lista, Preberací protokol), katalógus a Payloadból, a specifikáció frissítése.
- Élesítés előtt:
  - naptárszinkron a kollégáknak (ICS vagy közös Google-naptár);
  - Netlify és domain;
  - a cukrászok fiókjai;
  - a kód feldarabolása (az 500 kB-os figyelmeztetés miatt).
- Nyitott kérdések:
  - automatikus levélküldés (melyik levél, mikor);
  - a webes rendelések áthozása a nakolace.sk-ból (egyszeri vagy folyamatos; mindegyik vagy csak a jövőbeli).
