# SARATHI — Backend Task Breakdown (prototype, Prisma + SQLite)

Scope: backend only. Frontend excluded. No MongoDB. No PostGIS (deferred — Prisma provider swap later).
Stack: Node + Express 5 + TypeScript + Prisma + SQLite + Socket.io + axios + multer.
Demo window: 19 July 2026 (onset) → 27-28 July (peak) → 8-9 Aug 2026 (relief).
Corridor: Guwahati (26.1844,91.7458) → Golaghat (26.51,93.97) → Sivasagar (27.14,94.63) via NH27/NH37.

## How to run on any laptop (clone-friendly)

- `npm install` in `backend/` (auto-runs `prisma generate`)
- `npx prisma migrate deploy` (creates tables from committed `prisma/migrations/`)
- `npm run db:seed` (loads 8 ASDMA incidents + 3 trucks + event dates)
- `npm run dev` (tsx `src/index.ts`)
- Env: `PORT`, `DATABASE_URL="file:./dev.db"`, `GOOGLE_MAPS_KEY` (Weather + Routes), `OPENMETEO_URL` (fallback), `OSRM_URL` (fallback), `IMD_BASE_URL` (fallback), `ML_URL` (Dhruv's service, default `http://localhost:8000`)

Decided integrations (locked):

- Persistence: Prisma + SQLite file (`prisma/dev.db`). No DB server, works offline. `dev.db` is gitignored — migrations + `prisma/seed.ts` recreate it on any clone. Swap `provider` to `postgresql` + change `DATABASE_URL` later for PostGIS without touching routes.
- Live weather: Google Weather API primary → Open-Meteo / IMD fallback. 10-min cache in `RiskCache` table.
- Routes + traffic: Google Maps Routes API (`TRAFFIC_AWARE`, `departureTime: now`) → OSRM fallback.
- Landslide chance (Dhruv, `ml-service/`): features = land gradient/slope, forestation level (forest cover/NDVI/loss), rainfall 24h + 3-day, elevation, lithology/soil, distance to river/fault, road-cut presence, district susceptibility class. Output = landslide probability 0-1 + level.

## Prisma contract (do this first, one owner)

- `prisma/schema.prisma`: 3 models only — `Incident`, `FieldReport`, `RiskCache` (lat/lng Float, eventDate String, severity String, no PostGIS types yet).
- `src/services/db.ts`: `export const prisma = new PrismaClient()` singleton. Everyone imports this, nobody news up a client.
- `prisma/seed.ts`: reads `data/incidents.json` + `data/scenario.json` + event dates → upserts. `package.json` → `"prisma": { "seed": "tsx prisma/seed.ts" }`.
- Commit: `prisma/schema.prisma` + `prisma/migrations/*` + `prisma/seed.ts`. Do NOT commit: `prisma/dev.db*`, `*.db-journal`, `uploads/*`, `*.pbf`, `*.shp.zip`.

## File ownership (to avoid merge conflicts)

- Person A (Naman) — Core + DB + Live: `src/index.ts`, `src/app.ts`, `src/services/db.ts`, `prisma/schema.prisma`, `prisma/seed.ts`, `src/routes/*.ts`, `src/middleware/*`, `src/services/simulation.service.ts`, `src/sockets/*.ts`, `src/routes/incidents.ts`
- Person B (Aryan) — Intelligence + Reports: `src/services/weather.service.ts`, `src/services/routing.service.js`, `src/services/risk.service.ts`, `src/routes/reports.ts`, `src/services/pdf.service.ts`, `uploads/`
- Shared (Naman owns, Aryan only reads): `prisma/migrations/*`, `backend/data/*.json` (seed source), `frontend/public/data/*.geojson`

---

## TRACK 1 — Core server + Prisma + REST skeleton (Person A)

- [ ] 1.1 Resolve `package.json` merge first (keep TS scripts: dev/build/start/typecheck/lint). Then add: `prisma`, `@prisma/client`.
- [ ] 1.2 `npx prisma init --datasource-provider sqlite` + 3-model schema + `npx prisma migrate dev --name init` + `src/services/db.ts` singleton. Add `DATABASE_URL="file:./dev.db"` to `.env.example`. Gitignore `prisma/dev.db*`.
- [ ] 1.3 `src/app.ts`: express, cors, helmet, morgan, json limit 1mb, static `/uploads`. Health: `GET /api/health` → `{ ok, time }`.
- [ ] 1.4 Vehicles: `GET /api/vehicles` (in-memory Map, seeded by simulation — stays in-memory, NOT in DB).
- [ ] 1.5 Routes: `GET /api/routes?from=&to=` (proxy to routing.service, OSRM default)
- [ ] 1.6 Risk: `GET /api/risk?lat=&lng=&date=` (calls risk.service, caches to `RiskCache`)
- [ ] 1.7 Weather: `GET /api/weather?lat=&lng=` (calls weather.service, 10-min cache in `RiskCache`)
- [ ] 1.8 Analyze: `POST /api/route/analyze { origin, destination, cargoType, eventDate }` → route + risk + alert (reads incidents from Prisma)
- [ ] 1.9 Central error handler + 404. No auth (single dashboard user per PROJECT.md §10).
- [ ] Done when: `npm install && npx prisma migrate deploy && npm run db:seed && npm run dev` works on a fresh clone; all routes return JSON with services stubbed.

## TRACK 2 — Intelligence: live weather (Google) + routes/traffic (Google) + landslide risk (Dhruv ML) (Person B)

- [ ] 2.1 `weather.service.ts`: Google Weather API primary (current + hourly: `precipitation.probability.percent`, `qpf.quantity` mm, type, wind). Fallback Open-Meteo / IMD district forecast. Cache 10 min in `RiskCache`, quota-guarded. Never throw — return `{ source: google|openmeteo|imd, rainfall_mm, probability }` or fallback zeros.
- [ ] 2.2 `routing.service.ts`: Google Maps Routes API primary — `TRAFFIC_AWARE` + `departureTime: now` for main road + alternate + congestion level + ETA. Fallback OSRM `router.project-osrm.org/...?alternatives=true` when Google has no data (remote NER) or quota over. Return `{ primary, alternate, distance_km, duration_min, traffic_level, blocked }`.
- [ ] 2.3 `risk.service.ts` (calls Dhruv's ML first): POST `ML_URL/predict` with `{ lat, lng, eventDate, slope_gradient, forestation_level, rainfall_24h, rainfall_3d, elevation, lithology, dist_to_river, road_cut, susceptibility }`. Output `{ landslide_prob 0-1, score 0-100, level: LOW/MEDIUM/HIGH/RED, reasons[] }`. Heuristic fallback `0.5*rain + 0.3*road + 0.2*flood_zone` only if ML down. Keep `predictRisk(features)` signature stable. Write result to `RiskCache`.
- [ ] 2.4 Blockage rule: if `landslide_prob ≥ 0.7` or score ≥ 75 OR `prisma.incident.findMany({ where: { eventDate } })` nearby OR Google reports road closed/heavy congestion → `blocked=true`, force alternate.
- [ ] Done when: `POST /api/route/analyze` for Guwahati→Sivasagar on `2026-07-28` returns HIGH/RED + alternate with `blocked=true`. Blockage always follows rule 2.4 (score ≥ 75 or `landslide_prob ≥ 0.7` → `blocked=true`): if any date (including `2026-07-19`) scores RED, it returns `blocked=true` with an alternate — never force MEDIUM/no-block for a date.

## TRACK 3 — Simulation + Socket.io + Incidents (Person A)

- [ ] 3.1 `data/incidents.json` (seed source, NOT runtime store): 8-10 real rows from ASDMA 01.07.2024 breach table + Aug 2026 bulletin (road name, lat, lng, type: breach/landslide/overtop, severity, eventDate). `prisma/seed.ts` loads these into `Incident` table.
- [ ] 3.2 `data/scenario.json`: 3 trucks: `AS-01-FOOD-04 (rice+medicines, Guwahati→Golaghat camp)`, `AS-02-MED-11 (medicines, Guwahati→Sivasagar)`, `AS-03-FUEL-07 (fuel, Guwahati→Sivasagar via Nagaon)`. Each: origin, destination, cargoType, OSRM polyline file. Trucks stay in-memory, seeded at boot.
- [ ] 3.3 `simulation.service.ts`: fetch OSRM polyline once per truck, interpolate 1 point / 2 sec, emit `vehicle:update { vehicleId, lat, lng, speed, status }`. Query `prisma.incident.findMany({ where: { eventDate } })` for block spots → at flood index `speed=0, status=blocked`, emit `alert:blockage`.
- [ ] 3.4 Sockets: `src/sockets/index.ts` — on `client:subscribe` send current positions; tick 2s. Events: `vehicle:update`, `alert:risk`, `alert:blockage`.
- [ ] 3.5 Incidents API via Prisma: `GET /api/incidents?date=2026-08-09` → `prisma.incident.findMany`, `POST /api/incidents` → `prisma.incident.create` (manual blockage for demo button). Restart-safe.
- [ ] Done when: fresh clone + seed → frontend can subscribe and watch truck stop at Nagaon/Golaghat on peak date; restart server, manual blocks persist.

## TRACK 4 — Field reporting + PDF bulletin (Person B, reads Prisma only)

- [ ] 4.1 `POST /api/reports` (multer single photo, ≤5MB, jpg/png): fields `lat, lng, type, severity, note, eventDate`. Save photo to `uploads/` + `prisma.fieldReport.create()`. Serve via `GET /uploads/:file`.
- [ ] 4.2 `GET /api/reports?date=` → `prisma.fieldReport.findMany` with photo URLs.
- [ ] 4.3 `GET /api/bulletin.pdf?date=2026-08-09`: query Prisma (`incidents`, `fieldReports`, `riskCache`) + in-memory truck status → 1-page PDF — header `Flood Report as on: 09-08-2026`, footer `Replayed for demo on <today>`, body: affected districts (Golaghat 70k, Sivasagar 40k, Jorhat 16k), toll 100, rivers above danger (Dhansiri, Kushiyara), truck statuses, top 5 incidents. Use `pdfkit` (add dep) or plain HTML→print. Keep deps minimal.
- [ ] 4.4 Validation: reject lat/lng outside NER bbox (21-30N, 89-98E), reject empty note.
- [ ] Done when: photo upload → appears in list → appears in PDF → survives restart.

## TRACK 5 — Data files + demo seed (Person A owns)

- [ ] 5.1 `frontend/public/data/ner_districts_simplified.geojson` (<5MB, LGD codes, focus Assam + neighbours)
- [ ] 5.2 `frontend/public/data/assam_floods_simplified.geojson` (from NDEM_AS, simplify with mapshaper to <5MB)
- [ ] 5.3 `backend/data/event_dates.json`: `[{ date: 2026-07-19, phase: onset }, { date: 2026-07-28, phase: peak }, { date: 2026-08-09, phase: relief }]` — loaded by `seed.ts`.
- [ ] 5.4 Commit: `prisma/schema.prisma`, `prisma/migrations/*`, `prisma/seed.ts`, `data/*.json`. Do NOT commit: `prisma/dev.db*`, `*.db-journal`, `*.pbf`, `*.shp.zip`, `*.gpkg.zip`, full NIC 5GB, `uploads/*`. See `.gitignore`.
- [ ] Done when: fresh clone stays <20MB, map loads 2 layers offline, `npm run db:seed` reproduces peak-day RED.

---

## Integration order (do in this sequence)

1. A resolves `package.json` merge → `prisma init + migrate + db.ts + seed` → 1.3-1.5 (health, vehicles).
2. B plugs weather/routes/risk (with `RiskCache`) → C logic (A) reads incidents from Prisma → D (B) writes reports to Prisma.
3. Joint test: `POST /api/route/analyze` with `eventDate=2026-07-28` → expect RED + alternate.
4. Joint test: socket demo for 3 event dates, truck blocks on peak date only. Restart server mid-demo to prove persistence.
5. Freeze seed files by demo eve; cache Google Weather/Routes calls (no live Google billing during judging).

## Dhruv handoff (ML input contract)

- Send him: ASDMA breach lat/lon (from `prisma.incident`) + NDEM_AS polygons (label 1) + dry NH points (label 0) + IMD/Open-Meteo rainfall + SRTM slope/gradient + forest cover/NDVI + lithology + river distance.
- He returns: `POST /predict` with landslide probability. Minimum test: 19 July ~0.3, 28 July >0.8 at Golaghat, 9 Aug ~0.6.

## Out of scope for prototype

MongoDB/mongoose, PostGIS spatial SQL (deferred — switch Prisma `provider` to `postgresql` post-demo), Firestore, multilingual, offline PWA. Auth/JWT is IN scope and implemented per `PROJECT.md` §6.4/§8.1 (login + `GET /me`, RBAC on all data routes). ML stays in scope via Dhruv's `ml-service/`.
