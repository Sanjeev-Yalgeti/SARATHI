# NAMAN (alone) — get the project moving without Aryan (Prisma + SQLite)

You cover Core + DB + Live + stubs for Intelligence so Sanjeev (frontend) and Dhruv (ML) are never blocked.
Do in this exact order. Plain tasks, no API jargon.

## 0. Database first so any laptop works (30 min, once)

- Add `prisma` + `@prisma/client`, run `prisma init --datasource-provider sqlite`.
- 3 tables only: `Incident`, `FieldReport`, `RiskCache` (lat/lng numbers, date text, severity text).
- One file `src/services/db.ts` shares the connection. Everyone imports it.
- `prisma/seed.ts` loads your 8 flood breaks + event dates. Run `migrate deploy + db:seed` on every fresh clone.
- Never commit `prisma/dev.db`. Commit `schema.prisma + migrations + seed.ts`.

## 1. Start the server so map can connect

- Blank Express server runs, health check answers.
- `npm install && npx prisma migrate deploy && npm run db:seed && npm run dev` works first try.
- Frontend can connect today.

## 2. Fake truck list (3 trucks at Guwahati depot, in-memory)

- Truck 1: rice + medicines → Golaghat relief camp
- Truck 2: medicines → Sivasagar
- Truck 3: fuel → Nagaon → Sivasagar
- Fixed starting points: Guwahati (26.1844, 91.7458).
- Trucks stay in a `Map` (not in DB — they move every 2 sec, no need to save each dot).
- Sanjeev can render dots today via `GET /api/vehicles`.

## 3. Play button mover (fake GPS)

- Drive trucks step-by-step toward Golaghat / Sivasagar.
- 1 move every 2 seconds over OSRM road line.
- Corridor: Guwahati → Golaghat (26.51, 93.97) → Sivasagar (27.14, 94.63) via NH27/NH37.

## 4. Flood break list from Assam reports (seeded into DB, not hardcoded)

- 8 road breaks with lat/lon + damage note in `data/incidents.json`.
- Sources: ASDMA breach table + 9 Aug 2026 bulletin (Golaghat 70k, Sivasagar 40k, toll 100).
- `seed.ts` puts them into the `Incident` table. API reads via `prisma.incident.findMany({ where: { eventDate } })`.
- Peak day (28 July): spots = blocked. Other days = passable.
- Restart-safe: judge's manual block via `POST /api/incidents` survives restart.

## 5. Stop rule (temporary brains until Aryan returns)

- If truck reaches flood spot from DB on 28 July → stop it + fire danger alert.
- On 19 July and 9 Aug → keep moving (DB query returns no block for those dates).
- Simple rule only. Real logic later: Dhruv's landslide probability (gradient + forestation + rain) + Google traffic block, cached in `RiskCache`.
- Expose `GET /api/incidents?date=` so Dhruv/Aryan can test without touching your mover.

## 6. Backup road stub

- Return same road twice, label second one "via Bongaigaon village roads".
- Aryan replaces with Google Routes alternate + traffic later. Dhruv's model decides which one is safer.

## 7. Photo inbox stub (DB-backed from day one)

- Accept photo + location + note, save photo to `uploads/`, row to `FieldReport` table via Prisma.
- List back via `GET /api/reports?date=`.
- No NER validation yet (Aryan adds 21-30N, 89-98E check later).

## 8. Bulletin stub for 09-08-2026 (reads from DB)

- 1-page text/PDF built from Prisma queries: incidents + field reports + truck status.
- Static lines: districts affected, deaths, rivers over danger (Dhansiri, Kushiyara).
- Leave one line for landslide probability + live weather snapshot (`RiskCache`) — Aryan fills it.
- Real PDF design later with Aryan.

## Done when

- Fresh clone runs 4 commands and works: `npm install → migrate deploy → db:seed → dev`.
- Map shows 3 dots moving, 1 stops at flood on peak date, alert pops. Restart server, data stays.
- Sanjeev unblocked after step 2. Dhruv can test against your stubs after step 5.
- When Aryan returns: switch to naman.md + aryan.md, delete this flow. DB files (`db.ts`, schema, seed) stay as-is — no rewrite.
