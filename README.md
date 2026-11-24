# Lazy Dog Surf — mini rezervačný systém

Zjednodušená verzia Surf Wala projektu — len surfové lekcie + požičanie dosiek,
bez ubytovania. Postavené na Next.js, dáta sa ukladajú do `data/db.json`
(žiadna databáza netreba nastavovať).

## Spustenie

```bash
npm install
npm run dev
```

Otvorí sa na http://localhost:3000

- **Zákaznícka rezervačná stránka**: `/`
- **Admin dashboard**: `/admin` (heslo `lazydog`, dá sa zmeniť cez `ADMIN_PASSWORD` v `.env.local`)

## Čo je zachované z pôvodného projektu

- **Cenová logika lekcií** (`lib/pricing.ts`) — presne tá istá logika ako v Surf
  Wala (`lib/surf-pricing.ts`): každý plavec si môže vybrať iný kurz, neplavci
  idú automaticky na Súkromnú lekciu, deti sa platia na lekciu, skupinová
  zľava 10 % pri 3+ dospelých. (Sezónne "Peak Holiday" obdobie z ubytovania
  bolo vynechané, keďže Lazy Dog ubytovanie nemá.)
- **Logika požičiavania dosiek** (`lib/board-rental.ts`) — prenesená 1:1:
  cena na hodinu vs. na deň (nikdy viac ako celodenná cena), dostupnosť podľa
  počtu kusov, časy vyzdvihnutia.

## Čo je zjednodušené oproti pôvodnému projektu

- Žiadne ubytovanie, housekeeping, izby.
- Žiadne priraďovanie viacerých inštruktorov — len jeden inštruktor, preto
  jednoduchý denný limit (predvolene **8 žiakov/deň**, upraviteľný v
  Nastaveniach).
- Jedno jednoduché admin heslo namiesto systému rolí.
- Žiadne emaily / Google Calendar synchronizácia.
- Dáta v JSON súbore namiesto Supabase (ľahké na spustenie; pri väčšom
  prevádzke sa dá neskôr nahradiť reálnou databázou).

## Admin dashboard

- **Kalendár** (`/admin/calendar`) — mesačný prehľad, pri každom dni badge
  `x/8`, kliknutím na deň sa zobrazí zoznam rezervácií a požičaní dosiek s
  možnosťou potvrdiť/zrušiť.
- **Nastavenia** (`/admin/settings`) — úprava cien lekcií, cien a počtu
  dosiek, denného limitu žiakov a časov požičiavania.
