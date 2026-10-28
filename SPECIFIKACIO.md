# Telefonos rendeléskezelő – követelménylista (nakolace.sk)

## 1. Architektúra
- Különálló webes app (PWA), laptopon és telefonon azonos funkciókkal.
- Backend: Supabase (Central EU, Frankfurt). Frontend hosting: Netlify.
- A nakolace.sk Payload API-ból csak olvassa a termékeket, a weboldalon semmit nem módosít.
- Felület nyelve: szlovák.

## 2. Beviteli űrlap (sorrendben)
1. Dátum + pontos idő. Azonnali ellenőrzés: ha ±30 percen belül már van rendelés, figyelmeztet és megmutatja. Csak jelez, nem tilt. Ha mindkét rendelés osobný odber, nincs figyelmeztetés.
2. Átvétel módja: osobný odber / doručenie. Doručenie esetén közvetlenül alatta: kiszállítási cím + „Rovnaká ako adresa bydliska” jelölő.
3. Megrendelő: név, telefon, e-mail, lakcím, IČO.
4. Tételek (katalógusból vagy egyedi): megnevezés, mennyiség, ár, konfiguráció (szabad szöveg), allergének (EU 14-es lista). Katalógusból betöltődik a név, az ár és az allergének.
5. Rendelés-szint: megjegyzés, szállítási díj, kedvezmény (€), végösszeg (automatikus), fizetési mód (készpénz / kártya / átutalás / QR-kód).

Szabályok:
- A felvétel időpontja automatikusan mentődik.
- Egyik mező sem kötelező, és minden mindig módosítható.
- Szállítási díj: 5,40 €. 70 €-tól (kedvezmény után számolva) ingyenes, osobný odber esetén 0 €. Mindig módosítható vagy törölhető.

## 3. Státuszok
- Rendelés (mindig kézzel állítva): Prijatá → Skontrolovaná → Hotová, illetve Zrušená.
- Tétel (opcionális): státusz és ki készítette (a bejelentkezett felhasználó neve, automatikusan).

## 4. Nézetek
- Napi lista, heti és havi naptár.
- Szűrés átvételi mód és státusz szerint.
- Keresés név és telefonszám alapján.
- Rendelés részletei: adatok, tételek, státuszkezelés, üzenetküldés, nyomtatás, napló.

## 5. Jogosultságok
| | Admin | Felhasználó |
|---|---|---|
| Felvétel, módosítás | ✓ | – |
| „Skontrolovaná” | ✓ | – |
| „Zrušená” | ✓ | – |
| „Hotová” (saját névvel) | ✓ | ✓ |
| Napi/heti lista, nyomtatás | ✓ | ✓ |

Mindenkinek saját belépése van, nyilvános regisztráció nincs.

## 6. Nyomtatás
- Napi/heti lista: napokra és órákra bontva. Rendelésenként: időpont, átvétel módja, megrendelő neve (+ cím doručenie esetén), tételek a konfigurációval, ár. Minden tétel előtt ☐ jelölőnégyzet. A zrušená rendelések nem szerepelnek.
- Átvételi lap (Preberací protokol, rendelésenként külön): eladói adatok, a rendelés adatai, allergének teljes névvel, átvevő aláírása.
- Nyilatkozat a lapon: „Podpisom potvrdzujem prevzatie objednávky v uvedenom rozsahu a oboznámenie sa s uvedenými alergénmi.”

Eladói adatok:
NEOFEN s.r.o. (nakolace.sk)
Námestie Andreja Hlinku 1, 831 06 Bratislava
IČO: 53795041 · IČ DPH: SK2121498016
Mestský súd Bratislava III, oddiel Sro, vložka 162570/B

## 7. Arculat
- Fő szín: #860f7a. Másodlagos (kiemelő) szín: #19caf2. Szövegszín: #6b6472.
- Betűtípus: Source Serif 4 (normál 400, címek félkövér).
- Fő gombok: #860f7a alapon fehér szöveg; a türkiz csak kiemelésre.
- Mobilon a képernyők egy oszlopba rendeződnek, ugyanazzal a tartalommal.

## 8. Később / másik app
- Sütési napló és nyomonkövetés (fagyasztási készlet, alapanyagok): külön párhuzamos app lesz, és ezzel össze lesz kötve.

## 9. Kommunikáció a megrendelővel
- Három üzenet: visszaigazolás, elkészült-értesítés, emlékeztető.
- Csatorna: e-mail és WhatsApp. Nyelv: szlovák.
- Kézi küldés: a gomb megnyitja az előre kitöltött üzenetet (WhatsApp: wa.me link, e-mail: mailto link), a küldést a felhasználó végzi.
- Személyes átvétel helye: Námestie Andreja Hlinku 1, 831 06 Bratislava – Rača.

### Potvrdenie objednávky
Tárgy: Potvrdenie objednávky – Na Koláče

Dobrý deň, {meno},

ďakujeme za Vašu objednávku. Potvrdzujeme:

{zoznam položiek}
Spolu: {suma} €

[odber] Osobný odber: {dátum} o {čas}, Námestie Andreja Hlinku 1, 831 06 Bratislava – Rača
[doručenie] Doručenie: {dátum} o {čas}, na adresu {adresa doručenia}

Ak by ste potrebovali niečo zmeniť, kontaktujte nás.

S pozdravom
Tím Na Koláče

### Objednávka je pripravená
Tárgy: Vaša objednávka je pripravená – Na Koláče

Dobrý deň, {meno},

Vaša objednávka je pripravená.
[odber] Môžete si ju vyzdvihnúť {dátum} o {čas}, Námestie Andreja Hlinku 1, 831 06 Bratislava – Rača.
[doručenie] Doručíme Vám ju {dátum} o {čas}.

S pozdravom
Tím Na Koláče

### Pripomienka
Tárgy: Pripomienka objednávky – Na Koláče

Dobrý deň, {meno},

pripomíname Vašu objednávku na {dátum} o {čas}.
[odber] Tešíme sa na Vás, Námestie Andreja Hlinku 1, 831 06 Bratislava – Rača.
[doručenie] Doručenie na adresu {adresa doručenia}.

S pozdravom
Tím Na Koláče

## 10. Nyitott teendők
- A Payload termék-collection neve (slug) és az olvasási jogosultság ellenőrzése.
- Aldomain vagy *.netlify.app cím.
- Adatbázis: az order_items.origin mező (friss / fagyasztott) megmarad, de a felületen nem jelenik meg; a párhuzamos nyomonkövetési apphoz később elővehető.
