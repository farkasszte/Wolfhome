# 🐺 WolfHome - Prémium Kezdőlap és Személyes Dashboard

A **WolfHome** egy rendkívül letisztult, modern és funkciókban gazdag böngészőbővítmény (Chrome és Firefox támogatással), amely lecseréli az új lap (New Tab) oldalt egy prémium, személyre szabható és magával ragadó produktivitási dashboardra.

A projekt a legmodernebb webdizájn trendeket (üveghatás / *glassmorphic* kártyák, egyéni színvilág, sötét mód, finom mikro-animációk) ötvözi a mindennapi hasznos funkciókkal.

---

## 🌟 Főbb Jellemzők

### 1. Dinamikus Információs Fejléc (Widgets)
*   **Időjárás és Csillagászat:** Aktuális hőmérséklet, szöveges előrejelzés és részletes ikonok (wttr.in alapú), valamint napkelte és napnyugta időpontjai.
*   **3 Napos Mini Előrejelzés (Hover):** Az időjárás widget fölé vive az egeret azonnal megjelenik egy elegáns lebegő panel a következő napok időjárásával és hőmérsékleteivel.
*   **Valós Idejű Árfolyamok:** Automatikusan frissülő EUR/HUF és USD/HUF MNB középárfolyam kijelzés.
*   **Magyar Névnapok:** A mai napon ünneplő nevek kijelzése külső API lekérdezéssel és offline helyi adatbázis-fallbackkel.
*   **Óra és Dátum:** Testreszabható óra kijelzés (másodpercekkel vagy anélkül).

### 2. Integrált Naptár Kártya (Calendar)
*   **Több Google Naptár Támogatása:** Tetszőleges számú Google Naptár (iCal / ICS) szinkronizációja egyedi nevekkel és színekkel.
*   **"Ma" (Today) Gomb:** Egyetlen kattintással visszaugrik az aktuális hónapra és mai napra.
*   **Részletes Lebegő Tooltip:** Események előnézete a hozzárendelt naptár színével, időponttal, helyszínnel és leírás részlettel.
*   **Ismétlődő Események Kezelése:** Képes feldolgozni a napi, heti, havi és éves ismétlődő mintákat.
*   **Rugalmas Nézetek:** Váltás a klasszikus havi nézet és a kompakt 2 hetes sávos nézet között.
*   **Beépített Szinkronizáló Gomb:** Dinamikus frissítés és állapotkijelzés (sikeres kapcsolat esetén kiemelt szín, hiba esetén pulzáló narancssárga figyelmeztetés).

### 3. Kanban Tábla (Kanban Board)
*   **Teendők Kezelése & Prioritások:** Háromoszlopos elrendezés (Teendő, Folyamatban, Kész) választható prioritási szintekkel (Alacsony, Közepes, Sürgős) és színkódolt címkékkel.
*   **Oszlop Számlálók:** Dinamikusan frissülő kártyaszámlálók minden oszlop fejlécében.
*   **Drag-and-Drop:** Interaktív és zökkenőmentes kártyamozgatás a SortableJS segítségével.

### 4. Testreszabható Hírcsatorna (RSS Feed)
*   **Több Forrás Támogatása:** Tetszőleges RSS hírforrások (pl. Telex, HVG, Index) hozzáadása és menedzselése.
*   **Képek és Limit:** Opcionálisan be- és kikapcsolható cikk-illusztrációk, valamint a megjelenített hírek darabszámának finomhangolása.

### 5. e-Kréta Órarend Integráció
*   **Iskolai Órarend:** Az e-Kréta felületének beágyazása egy intelligensen skálázott, kattintás-átengedő és dizájnba illeszkedő iframe-en keresztül.

### 6. Könyvjelzők és Kedvencek (Bookmarks Sidebar)
*   **Csoportosított Linkek:** Csoportokba rendezhető és drag-and-drop módon átrendezhető könyvjelzők.
*   **Szerkesztési Zár:** Biztonsági lakat ikon a véletlen törlések vagy áthelyezések megakadályozására.

### 7. Vizuális Személyre Szabás és Beállítások
*   **Kiemelő Szín:** Bármilyen RGB kiemelőszín (accent) választható az egész felülethez.
*   **Háttér Típusok:** Fekete alap, egyszínű háttér, színátmenet (szöggel és színekkel), saját kép feltöltése (automatikus kép-tömörítéssel), vagy véletlenszerű Unsplash képek témakörök szerinti szűréssel és frissítési gyakorisággal.
*   **Háttér Effektek:** Finomhangolható sötétítés (brightness) és elmosás (blur) a jobb olvashatóságért.
*   **Háttér Rögzítése/Mentése:** Az Unsplash képek letölthetők vagy egyetlen kattintással saját képként véglegesen lementhetők.

### 8. Teljes Képernyős Fókusz Mód (Focus Mode)
*   **Minimalista Élmény:** A Szem ikonra kattintva a felület **minden elemet elrejt** (a naptárt, a híreket, a könyvjelzőket, a fejlécet, de még a vezérlősávot is).
*   **Egyszerű Visszalépés:** A képernyőn **bárhova történő kattintással** a fókusz mód azonnal kikapcsol, és minden widget visszatér a korábbi állapotába.

---

## 📂 Fájlstruktúra és Architektúra

A bővítmény moduláris ES6 modulokat használ, nincs szükség fordítási vagy építési folyamatra (Zero-Build). A kód tiszta, ember által olvasható és könnyen bővíthető.

```text
Wolfhome/
├── index.html               # A fő dashboard HTML váza
├── style.css                # Globális stíluslap, üveghatás és egyedi legördülő stílusok
├── main.js                  # Fő belépési pont, eseménykezelők és nézetek koordinációja
├── manifest.json            # WebExtension Manifest (V3)
├── js/                      # JS Modulok
│   ├── config.js            # Felhasználói beállítások betöltése, mentése és exportja
│   ├── ui.js                # Custom dropdownok és a Fókusz Mód kezelése
│   ├── utils.js             # Lucide ikon generátor, DOM segédfüggvények és kép-tömörítés
│   ├── widgets.js           # Óra, dátum, árfolyamok, időjárás és névnap frissítések
│   ├── calendar.js          # Google Naptár iCal parser és eseménynézet-generátor
│   ├── nameday-db.js        # Magyar névnap statikus adatbázis (offline fallback)
│   ├── links.js             # Könyvjelzők mentése, csoportosítása és rendezése
│   ├── kanban.js            # Kanban feladatok és oszlopok frissítése
│   ├── news.js              # RSS hírek lekérése és renderelése a háttérben
│   ├── storage-actions.js   # Konfiguráció export/import funkciók
│   └── background-service.js# MV3 Service Worker a CORS-mentes hálózati kérésekhez
└── *min.js                  # Harmadik féltől származó lokális könyvtárak (Tailwind, Lucide, Sortable)
```

---

## 🛠️ Telepítés és Használat

A bővítmény közvetlenül betölthető bármely Chromium alapú böngészőbe (Chrome, Edge, Brave, Opera) fejlesztői módban:

1.  Töltsd le vagy klónozd ezt a tárhelyet.
2.  Nyisd meg a böngésződben a bővítmények kezelőfelületét (`chrome://extensions/`).
3.  Kapcsold be a **Fejlesztői módot** (Developer mode) a jobb felső sarokban.
4.  Kattints a **Kicsomagolt bővítmény betöltése** (Load unpacked) gombra a bal felső sarokban.
5.  Válaszd ki a kicsomagolt `Wolfhome` mappát.
6.  Nyiss egy új lapot, és élvezd az új dashboardot!

---

## 📚 Felhasznált Külső Könyvtárak

Az adatbiztonság és a maximális sebesség érdekében minden könyvtár lokálisan, minifikált formában van jelen, távoli kódfuttatás nélkül:
*   [Tailwind CSS](tailwind.compiled.css) – Optimalizált, pre-compiled CSS a reszponzív, modern stílusokért.
*   [Lucide Icons](lucide.min.js) – A letisztult és modern vektoros ikonokért.
*   [SortableJS](sortable.min.js) – A Kanban tábla és könyvjelzők zökkenőmentes drag-and-drop élményéért.

---

## 📜 Licenc és Fejlesztés

Ez a projekt nyílt forráskódú. Bármilyen egyéni módosítás vagy új funkció (pl. újabb widgetek, integrációk) könnyedén beépíthető a moduláris felépítésnek köszönhetően.
