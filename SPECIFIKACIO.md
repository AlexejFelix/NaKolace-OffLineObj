# Telefonos rendeléskezelő – követelménylista (nakolace.sk)

## 1. Architektúra
- Különálló webes app (PWA), laptopon és telefonon azonos funkciókkal.
- Backend: Supabase. Frontend hosting: Netlify.
- A nakolace.sk Payload API-ból csak olvassa a termékeket, a weboldalon semmit nem módosít.

## 2. Beviteli űrlap (sorrendben)
1. Dátum + pontos idő. Azonnali ellenőrzés: ha ±30 percen belül már van rendelés, figyelmeztet és megmutatja. Csak jelez, nem tilt. Ha mindkét rendelés osobný odber, nincs figyelmeztetés.
2. Átvétel módja: osobný odber / doručenie.
3. Megrendelő: név, telefon, e-mail, lakcím, IČO; kiszállítási cím (csak doručenie esetén).
4. Tételek (katalógusból vagy egyedi): megnevezés, mennyiség, ár, konfiguráció (szabad szöveg), allergének (EU 14-es lista). Katalógusból betöltődik a név, az ár és az allergének.
5. Rendelés-szint: megjegyzés, szállítási díj, kedvezmény (€), végösszeg (automatikus), fizetési mód (készpénz / kártya / átutalás / QR-kód).

Szabályok:
- A felvétel időpontja automatikusan mentődik.
- Egyik mező sem kötelező, és minden mindig módosítható.
- Szállítási díj: 5,40 €. 70 €-tól (kedvezmény után számolva) ingyenes, osobný odber esetén 0 €. Mindig módosítható vagy törölhető.

## 3. Státuszok
- Rendelés (mindig kézzel állítva): felvett → ellenőrzött → elkészült, illetve törölt.
- Tétel (opcionális): státusz, ki készítette (a belépésből), eredet (friss / fagyasztóból).

## 4. Nézetek
- Napi lista, heti és havi naptár.
- Szűrés átvételi mód és státusz szerint.
- Keresés név és telefonszám alapján.

## 5. Jogosultságok
| | Admin | Felhasználó |
|---|---|---|
| Felvétel, módosítás | ✓ | – |
| „Ellenőrzött” | ✓ | – |
| „Törölt” | ✓ | – |
| „Elkészült” (saját névvel) | ✓ | ✓ |
| Napi/heti lista, nyomtatás | ✓ | ✓ |

Mindenkinek saját belépése van.

## 6. Nyomtatás
- Napi/heti lista: napokra és órákra bontva. Rendelésenként: időpont, átvétel módja, megrendelő neve, tételek a konfigurációval, ár.
- Átvételi lap (rendelésenként külön): eladói adatok, a rendelés adatai, allergének, átvevő aláírása.

Eladói adatok:
NEOFEN s.r.o. (nakolace.sk)
Námestie Andreja Hlinku 1, 831 06 Bratislava
IČO: 53795041 · IČ DPH: SK2121498016
Mestský súd Bratislava III, oddiel Sro, vložka 162570/B

## 7. Később / másik app
- Sütési napló és nyomonkövetés (fagyasztási készlet, alapanyagok): külön párhuzamos app lesz, és ezzel össze lesz kötve.

## 8. Nyitott teendők
- A Payload termék-collection neve (slug) és az olvasási jogosultság ellenőrzése.
- Aldomain vagy *.netlify.app cím.
