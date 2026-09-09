# SARATHI — Backend Task Breakdown (prototype, Zero-DB)

Scope: backend only. Frontend excluded. No MongoDB. No PostGIS.
Stack: Node + Express 5 + Socket.io + axios + multer.
Demo window: 19 July 2026 (onset) → 27-28 July (peak) → 8-9 Aug 2026 (relief).
Corridor: Guwahati (26.1844,91.7458) → Golaghat (26.51,93.97) → Sivasagar (27.14,94.63) via NH27/NH37.

## How to run (when skeleton is built)

- `npm install` in `backend/`
- `npm run dev` (nodemon index.js)
- Env: `PORT`, `GOOGLE_MAPS_KEY` (Weather + Routes), `OPENMETEO_URL` (fallback), `OSRM_URL` (fallback), `IMD_BASE_URL` (fallback), `ML_URL` (Dhruv's service, default `http://localhost:8000`)

Decided integrations (locked):

- Live weather: Google Weather API primary → Open-Meteo / IMD fallback. 10-min cache.
- Routes + traffic: Google Maps Routes API (`TRAFFIC_AWARE`, `departureTime: now`) → OSRM fallback.
- Landslide chance (Dhruv, `ml-service/`): features = land gradient/slope, forestation level (forest cover/NDVI/loss), rainfall 24h + 3-day, elevation, lithology/soil, distance to river/fault, road-cut presence, district susceptibility class. Output = landslide probability 0-1 + level.

## File ownership (to avoid merge conflicts)

- Person A — Core + REST: `index.js`, `src/app.js`, `src/routes/*.js`, `src/middleware/*`
- Person B — Intelligence: `src/services/weather.service.js`, `src/services/routing.service.js`, `src/services/risk.service.js`
- Person C — Live + Incidents: `src/services/simulation.service.js`, `src/sockets/*.js`, `src/routes/incidents.js`, `data/incidents.json`
- Person D — Field + Reports: `src/routes/reports.js`, `src/services/pdf.service.js`, `uploads/`, `data/*`
- Shared (decide one owner): `frontend/public/data/*.geojson`, `backend/data/*.json`

---

## TRACK 1 — Core server + REST skeleton (Person A)

- [ ] 1.1 Create `index.js` + `src/app.js`: express, cors, helmet, morgan, json limit 1mb, static `/uploads`
- [ ] 1.2 Health: `GET /api/health` → `{ ok, time }`
- [ ] 1.3 Vehicles: `GET /api/vehicles` (in-memory Map, seeded by simulation)
- [ ] 1.4 Routes: `GET /api/routes?from=&to=` (proxy to routing.service, OSRM default)
- [ ] 1.5 Risk: `GET /api/risk?lat=&lng=&date=` (calls risk.service)
- [ ] 1.6 Weather: `GET /api/weather?lat=&lng=` (calls weather.service, 10-min cache)
- [ ] 1.7 Analyze: `POST /api/route/analyze { origin, destination, cargoType, eventDate }` → route + risk + alert
- [ ] 1.8 Central error handler + 404. No auth (single dashboard user per PROJECT.md §10).
- [ ] Done when: all above return JSON without crashing when services stubbed.

## TRACK 2 — Intelligence: live weather (Google) + routes/traffic (Google) + landslide risk (Dhruv ML) (Person B)

- [ ] 2.1 `weather.service.js`: Google Weather API primary (current + hourly: `precipitation.probability.percent`, `qpf.quantity` mm, type, wind). Fallback Open-Meteo / IMD district forecast. Cache 10 min, quota-guarded. Never throw — return `{ source: google|openmeteo|imd, rainfall_mm, probability }` or fallback zeros.
- [ ] 2.2 `routing.service.js`: Google Maps Routes API primary — `TRAFFIC_AWARE` + `departureTime: now` for main road + alternate + congestion level + ETA. Fallback OSRM `router.project-osrm.org/...?alternatives=true` when Google has no data (remote NER) or quota over. Return `{ primary, alternate, distance_km, duration_min, traffic_level, blocked }`.
- [ ] 2.3 `risk.service.js` (calls Dhruv's ML first): POST `ML_URL/predict` with `{ lat, lng, eventDate, slope_gradient, forestation_level, rainfall_24h, rainfall_3d, elevation, lithology, dist_to_river, road_cut, susceptibility }`. Output `{ landslide_prob 0-1, score 0-100, level: LOW/MEDIUM/HIGH/RED, reasons[] }`. Heuristic fallback `0.5*rain + 0.3*road + 0.2*flood_zone` only if ML down. Keep `predictRisk(features)` signature stable.
- [ ] 2.4 Blockage rule: if `landslide_prob ≥ 0.7` or score ≥ 75 OR point inside NDEM Assam polygon OR near ASDMA breach lat/lon OR Google reports road closed/heavy congestion → `blocked=true`, force alternate.
- [ ] Done when: `POST /api/route/analyze` for Guwahati→Sivasagar on `2026-07-28` returns HIGH/RED + alternate; on `2026-07-19` returns MEDIUM, no block.

## TRACK 3 — Simulation + Socket.io + Incidents (Person C)

- [ ] 3.1 `data/incidents.json`: 8-10 real rows from ASDMA 01.07.2024 breach table + Aug 2026 bulletin (road name, lat, lng, type: breach/landslide/overtop, severity, eventDate).
- [ ] 3.2 `data/scenario.json`: 3 trucks: `AS-01-FOOD-04 (rice+medicines, Guwahati→Golaghat camp)`, `AS-02-MED-11 (medicines, Guwahati→Sivasagar)`, `AS-03-FUEL-07 (fuel, Nagaon→Sivasagar)`. Each: origin, destination, cargoType, OSRM polyline file.
- [ ] 3.3 `simulation.service.js`: fetch OSRM polyline once per truck, interpolate 1 point / 2 sec, emit `vehicle:update { vehicleId, lat, lng, speed, status }`. At flood polygon index → `speed=0, status=blocked`, emit `alert:blockage`.
- [ ] 3.4 Sockets: `src/sockets/index.js` — on `client:subscribe` send current positions; tick 2s. Events: `vehicle:update`, `alert:risk`, `alert:blockage`.
- [ ] 3.5 Incidents API: `GET /api/incidents?date=2026-08-09`, `POST /api/incidents` (manual blockage for demo button).
- [ ] Done when: frontend can subscribe and watch truck stop at Nagaon/Golaghat on peak date.

## TRACK 4 — Field reporting + PDF bulletin (Person D)

- [ ] 4.1 `POST /api/reports` (multer single photo, ≤5MB, jpg/png): fields `lat, lng, type, severity, note, eventDate`. Save to `uploads/` + append to `data/field_reports.json`. Serve via `GET /uploads/:file`.
- [ ] 4.2 `GET /api/reports?date=` list with photo URLs.
- [ ] 4.3 `GET /api/bulletin.pdf?date=2026-08-09`: generate 1-page PDF — header `Flood Report as on: 09-08-2026`, footer `Replayed for demo on <today>`, body: affected districts (Golaghat 70k, Sivasagar 40k, Jorhat 16k), toll 100, rivers above danger (Dhansiri, Kushiyara), truck statuses, top 5 incidents. Use `pdfkit` (add dep) or plain HTML→print. Keep deps minimal.
- [ ] 4.4 Validation: reject lat/lng outside NER bbox (21-30N, 89-98E), reject empty note.
- [ ] Done when: photo upload → appears in list → appears in PDF.

## TRACK 5 — Data files + demo seed (whoever finishes first)

- [ ] 5.1 `frontend/public/data/ner_districts_simplified.geojson` (<5MB, LGD codes, focus Assam + neighbours)
- [ ] 5.2 `frontend/public/data/assam_floods_simplified.geojson` (from NDEM_AS, simplify with mapshaper to <5MB)
- [ ] 5.3 `backend/data/event_dates.json`: `[{ date: 2026-07-19, phase: onset }, { date: 2026-07-28, phase: peak }, { date: 2026-08-09, phase: relief }]`
- [ ] 5.4 Do NOT commit: `*.pbf`, `*.shp.zip`, `*.gpkg.zip`, full NIC 5GB, `uploads/*`. See `.gitignore`.
- [ ] Done when: repo stays <20MB, map loads 2 layers offline.

---

## Integration order (do in this sequence)

1. A finishes 1.1-1.4 → B plugs real services → C plugs simulation → D plugs reports/PDF.
2. Joint test: `POST /api/route/analyze` with `eventDate=2026-07-28` → expect RED + alternate.
3. Joint test: socket demo for 3 event dates, truck blocks on peak date only.
4. Freeze data files by demo eve; cache Google Weather/Routes calls (no live Google billing during judging).

## Dhruv handoff (ML input contract)

- Send him: ASDMA breach lat/lon + NDEM_AS polygons (label 1) + dry NH points (label 0) + IMD/Open-Meteo rainfall + SRTM slope/gradient + forest cover/NDVI + lithology + river distance.
- He returns: `POST /predict` with landslide probability. Minimum test: 19 July ~0.3, 28 July >0.8 at Golaghat, 9 Aug ~0.6.

## Out of scope for prototype

Auth/JWT, MongoDB/mongoose, PostGIS, Firestore, multilingual, offline PWA. ML stays in scope via Dhruv's `ml-service/`.
