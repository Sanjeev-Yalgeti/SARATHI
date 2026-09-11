# SARATHI — Teammate Guide: Features & How It Works

> **One-liner:** SARATHI doesn't stop trucks. It moves relief *around* the flood — and when the flood makes a road impossible, it says so *before* a driver gets there.
> **Corridor:** Guwahati → Nagaon → Kaziranga → Jorhat → Golaghat / Sivasagar (NH-27 / NH-715, Assam).
> **Stack:** Frontend React 19 + Vite + Tailwind + Leaflet (`:5173`) · Backend Node + Express 5 + TypeScript + Prisma + SQLite (`:5001`) · ML sidecar FastAPI + scikit-learn (`:8000`, optional).
> **Remember one number:** **5.1 km** — Golaghat relief camp to the Barichuwa culvert breach (ASDMA-04). That is why a truck honestly stops.

---

## 1. Run it in 5 minutes

**You need:** Node 20+, npm, Python 3.12+ (only for the optional ML sidecar). No database server — SQLite file is created automatically. Use **3 terminals**.

> **Windows?** Skip the `.sh` scripts — PowerShell can't run bash. One-time setup: `.\setup.ps1`. Daily run: `.\dev.ps1`. If PowerShell blocks scripts, run once per window: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`. (Git Bash users can use `./setup.sh` + `./dev.sh` instead.)
> Never run `npm run dev` from the **repo root** — root has no `dev` script (it now prints this hint). `dev` lives in `backend/` (`nodemon`) and `frontend/` (`vite`) only.

```bash
# Terminal 1 — backend API on http://localhost:5001
cd backend
cp .env.example .env   # once per machine, then edit (see below)
npm install
npx prisma migrate deploy   # creates tables (once per clone)
npm run db:seed             # 8 incidents + 6 users + 5 trips (rerun anytime)
npm run dev
```

`.env` checklist (each machine uses its **own** values — never commit `.env`):

- `PORT=5001` (macOS AirPlay squats on 5000)
- `JWT_SECRET=` your own long random string — `openssl rand -base64 48` (login breaks without it)
- `GOOGLE_MAPS_API_KEY=` optional — without it, routes/weather use free OSRM + Open-Meteo fallbacks automatically
- Everything else can stay as in `.env.example`

```bash
# Terminal 2 — disaster-ML sidecar on http://localhost:8000 (recommended)
cd backend/disaster-ml
pip install -r requirements.txt
uvicorn serve:app --port 8000 --app-dir src
curl localhost:8000/health   # expect "model_loaded": true
# If the sidecar is down, the backend still works — risk answers degrade to
# a labelled heuristic fallback ("source": "heuristic"), nothing crashes.

# Terminal 3 — frontend on http://localhost:5173
cd frontend
npm install
npm run dev -- --port 5173   # VITE_API_URL=http://localhost:5001 is preset
```

**Log in** (`:5173` → landing → Get Started → Login). Role toggle: Admin / Driver.

| userId | password | role | sees |
|---|---|---|---|
| `admin` | `sarathi@123` | ADMIN | all 8 tabs, trip CRUD, simulation clock |
| `AS-01-FOOD-04` | `driver123` | DRIVER | Live Map / Alerts / Reports — own corridor only |
| `AS-02-MED-11` | `driver123` | DRIVER | same, Sivasagar trip |
| `AS-03-FUEL-07` | `driver123` | DRIVER | same, Sivasagar-via-Nagaon trip |
| `AS-04-WATER-09` | `driver123` | DRIVER | same, Sivasagar-via-Jorhat water tanker |
| `AS-05-SHELTER-12` | `driver123` | DRIVER | same, Golaghat-via-Kakatigaon shelter kits |

**3-minute golden path:**

1. Login as `admin`. Open **Live Map**, scenario date `2026-07-28`: trucks move, RED pins, RED banner + toast.
2. Open **Simulation**: press `2` (peak date shortcut), then Start. Watch a truck approach a RED zone → **DIVERTED** (green line) or **BLOCKED** (speed 0).
3. Login as a driver (e.g. `AS-01-FOOD-04` / `driver123`): only 3 tabs, Drive mode, own truck only.
4. **Reports** → submit a field report with photo → as admin, approve it → it appears on the map as a new incident.
5. Download the official bulletin: `GET /api/bulletin.pdf?date=2026-08-09` (button in UI, or curl with token).

---

## 2. System at a glance

```
Browser (:5173)  React 19 + Vite + Tailwind + Leaflet
        │  REST + JWT Bearer  +  Socket.io (JWT handshake)
        ▼
API (:5001)  Express 5 + TypeScript + Prisma + SQLite
  │  routes: auth / vehicles / incidents / trips / reports /
  │          bulletin.pdf / routes + intelligence / simulation / health
  │  services: simulation (2s tick) · routing (OSRM/Google) ·
  │            risk + weather · ml-client · pdf (PDFKit) · uploads
  ▼
ML sidecar (:8000, optional)  FastAPI + RandomForest (.joblib)
  POST /predict {district, date} → {risk_level, confidence, source: ml}
  Falls back to heuristic when down. Never fabricates unknown districts (422).
```

**Auth & roles (server-enforced, frontend only hides tabs):**

- `POST /api/auth/login` (public, `{userId, password}` → JWT, 8h) · `GET /api/auth/me` (hydrate session, `src/api/auth.js`, `App.jsx`).
- All data routes require `Authorization: Bearer <jwt>`. Admin-only mutations return 403 for drivers.
- Sockets: JWT handshake, rooms `admin` and `driver:<vehicleId>` — drivers only get their own truck + scoped incidents/reports.

---

## 3. Features by tab

### 3.1 Home / Landing (`HomePage.jsx`)

Public entry point. Branding + **Get Started** → Login. No data fetching.

### 3.2 Login (`LoginPage.jsx`)

- Role toggle **Admin / Driver**, fields `userId` + password.
- Stores JWT in localStorage, hydrates via `GET /api/auth/me`. `TopNav` shows name + role badge + Logout.
- Wrong role scoping is impossible to bypass: a driver hitting an admin tab is redirected to Live Map, and the API returns 403/404.

### 3.3 Live Map (`LiveMapPage.jsx` + `LiveMap.jsx`, `HeatmapLayer.jsx`)

The heart of the product. Two modes:

- **Drive mode (drivers):** shows only your route + truck + destination and RED/HIGH threats. Lines: **green** = live detour actually being driven, **grey** = already travelled, **blue** = still planned.
- **Analyze mode (admin):** heatmap of all severities + legend + Layers panel + click-to-track any truck.

Shortcuts `1 / 2 / 3` jump scenario clock to 19-07 onset / 28-07 peak / 09-08 relief. Toasts (`AlertToasts.jsx` + `useAlertsSocket.js`) appear on every dashboard (max 4, auto-dismiss 9s).

### 3.4 Trips (`TripsPage.jsx`, `TripCard.jsx`, `TripDetailsModal.jsx`, `AssignTripModal.jsx`)

- Admin: full CRUD — `GET /api/trips` (all), `POST /api/trips` (`{driverId, origin, destination, cargoType?, driverPassword?}`), `PATCH /api/trips/:id`, `DELETE /api/trips/:id`.
- Driver: `GET /api/trips` returns only own trips.
- Seed creates 5 trips (`SEED-<vehicleId>`, status `assigned`), one per driver. Admin edits are preserved across reseeds.

### 3.5 Alerts (`AlertsPage.jsx`)

Live list of `alert:risk` (ML band change), `alert:blockage` (RED stop), `alert:detour` (with `incidentId` + alternate label). Same events that drive the toasts; useful as a persistent log during demos.

### 3.6 Reports (`ReportsPage.jsx`, `SubmitReportModal.jsx`, `PhotoProofViewer.jsx`)

Verified ground truth, rumor-proof by design:

1. Anyone (public/driver) submits `POST /api/reports` — multipart photo (jpg/png/webp ≤ 5MB) + `lat, lng, userLat?, userLng?, type, severity, note, road?, eventDate`.
2. **1.0 km rule:** submitter GPS must be within ~1.05 km of the claimed site (Haversine), else rejected. Coords must be inside 21–30N, 89–98E. Note is required.
3. Report lands as `pending` (annotated `[STATUS:pending][Road:][Verified:][By:]`). Admin inbox approves/rejects via `PATCH /api/reports/:id`.
4. Approved RED/HIGH auto-creates a map incident (`REP-INC-*`). Rejected reports auto-restore to `pending` on next GET so the demo is repeatable.
5. `GET /api/reports?date=` — admin sees all; drivers see only radius-filtered. Photos served at `/uploads/...`.

### 3.7 Analytics (`AnalyticsPage.jsx`)

Dashboard numbers computed from **live APIs only** — no hardcoded figures. Honest empty states ("None reported"). Re-fetches on each poll.

### 3.8 Simulation (`SimulationPage.jsx`, `src/api/simulation.js`)

The presenter cockpit:

- `GET /api/simulation/status` — clock, positions, states.
- `POST /api/simulation/start` (any role, re-drives arrived trucks) · `POST /api/simulation/reset` (any role, depot restart, same date) — drivers can self-replay but can never change the date or unblock RED.
- `POST /api/simulation/date {date}` (admin) · `POST /api/simulation/scenario {date?, rainfall_mm?, river_danger_level_count?}` (admin, what-if knobs).
- `POST /api/simulation/location {vehicleId, lat, lng, speed?}` (admin mock-GPS teleport — e.g. drop a truck at a zone edge to force a block/divert on demand).
- `GET /api/simulation/path/:vehicleId` (driver gets 404 for other trucks).

### 3.9 Resources / About (`ResourcesPage.jsx`, `AboutPage.jsx`, `GoldenPathGuide.jsx`)

Static help + demo widget that walks a new user through the golden path.

---

## 4. How it works (the request journey)

### 4.1 Simulation tick — how trucks move

`backend/src/services/simulation.service.ts` + `trucks.ts`:

1. 5 trucks start at the Guwahati depot. Each has an OSRM road polyline resampled to 1500 points (`fetchRoadLine` → `resample`; straight-line fallback if OSRM is unreachable).
2. Every **2000 ms** (`TICK_MS`) each truck advances at **40 km/h** (`SPEED_KMH`). Arrival parks it (`idle`, speed 0, `done=true`, no wrap-around).
3. `start` re-drives arrived trucks; `reset` (`replayFromDepot`) restarts everybody from the depot on the same date; switching scenario date unblocks and continues from current positions.

### 4.2 Block / divert brain — the key logic

Per tick, per truck (`simulation.service.ts`):

1. Advance along the line, then check RED incidents for the **active scenario date** within **`BLOCK_RADIUS_KM = 15 km`**.
2. If inside a RED zone → `tryDivert`, else keep driving.
3. **Divert candidates:** routing-engine alternate first, then the Tezpur / NH-15 northern bypass (`TEZPUR_VIA`) via OSRM. A candidate is accepted only if it passes `alternateClearsTrigger` (5 km escape exempt, everything else outside 15 km). Max 3 diverts per truck, ≥ 25 points apart; successful ones are named `cleared {id, road}`.
4. If no candidate clears → **BLOCKED** (`status=blocked`, speed 0) until the date changes.
5. ML never stops a truck by itself — HIGH slows to 20 km/h, CRITICAL to 10 km/h (`mlMotionFor` / `assessTruckMl`). A destination *inside* RED (e.g. Golaghat camp ~5.1 km from ASDMA-04) is an honest stop, not a bug.
6. Emits `vehicle:update` every tick (+ on connect / `client:subscribe`), `alert:blockage` on RED stop, `alert:detour` with alternate label, `alert:risk` only on ML band transition.

### 4.3 Routing & risk APIs

- `GET /api/routes?from=lat,lng&to=lat,lng&via=...` (alias `/api/route/*`) — raw route + alternate.
- `POST /api/route/analyze {origin, destination, eventDate, truck?, cargoType?}` → `{risk, blocked, recommendedRoad, route, delayMessage}` — the "should I go?" answer.
- `GET /api/risk?lat&lng&date=` — district-mapped risk (5 corridor centroids: Kamrup Metro, Nagaon, Golaghat, Jorhat, Sivasagar), cached per district+date+knobs, persisted in `riskCache`.
- `GET /api/weather?lat&lng` — Google or Open-Meteo fallback.

### 4.4 Bulletin PDF

Authenticated `GET /api/bulletin.pdf?date=` (default `2026-08-09`; driver copy is scoped to own corridor) → `services/pdf.service.ts` (PDFKit) aggregates incidents + reports + risks + truck states into a **one-page A4**: header + `TRUCK STATUS` + `TOP ROAD BREAKS` (top 5 by severity) + `LANDSLIDE OUTLOOK` + field-inbox line → downloads as `sarathi-flood-bulletin-<date>.pdf`. This is the artifact you hand to a district commissioner in the demo.

---

## 5. ML sidecar, simply

- **Predicts:** district × date risk band `LOW | MODERATE | HIGH | CRITICAL` + `confidence` (RandomForest `risk_model.joblib` trained on `data/training_dataset.csv`; feature list in `train_risk_model.py:FEATURES`).
- **Call:** `POST :8000/predict {district, date, overrides:{rainfall_mm, river_danger_level_count}}` → `{risk_level, confidence, district, date, base_date, source: ml}`. Backend maps band → score (CRITICAL 85/RED, HIGH 65, MODERATE 40, LOW 15). Also `GET /health`, `GET /districts(?date=)`.
- **Honesty rules:** unknown district/override → `422` (never a guessed band); model missing → `503`; exact-date match else most-recent-prior row; backend timeout 4.5s → `source: heuristic` (`0.5·rain + 0.3·roadCut + 0.2·floodZone`, +0.85 floor if incidents within 35 km).
- Train/evaluate: `python src/build_training_dataset.py --data-dir <pdf-folder>` then `python src/train_risk_model.py` (stratified split only if n ≥ 20 with ≥ 2 samples/class, else `LIMITED DATASET` log; accuracy gate ≥ 0.70 when evaluation is possible). Details in `machine-learning.md` + `backend/disaster-ml/README.md`.

---

## 6. Seed data & demo script

**Seed** (`backend/prisma/seed.ts`, `data/incidents.json`, `data/event_dates.json`, `services/trucks.ts`) — idempotent, reseed never overwrites passwords:

- **8 incidents, all `eventDate 2026-07-28`:** `KAM-01` HIGH Kamrup-Metro; `ASDMA-01` RED Golaghat (Kaziranga breach); `ASDMA-02` HIGH Nagaon (Kakatigaon); `ASDMA-04` RED Golaghat (Barichuwa culvert); `ASDMA-05` HIGH Jorhat (Bhogdoi); `ASDMA-06` RED Sivasagar (Dikhow); `ASDMA-08` HIGH Golaghat; `AUG09-01` HIGH Sivasagar. RED rows drive block/divert.
- **3 scenario dates:** `2026-07-19` onset · `2026-07-28` peak (default) · `2026-08-09` relief. Bulletin default `2026-08-09`.
- **6 users:** `admin/sarathi@123` (ADMIN) + 5 drivers (`driver123`). **5 trucks** (all Guwahati origin): `AS-01` rice+medicines → Golaghat camp · `AS-02` medicines → Sivasagar (via Tezpur) · `AS-03` fuel → Sivasagar (via Nagaon+Golaghat) · `AS-04` drinking-water → Sivasagar camp (via Jorhat) · `AS-05` tarpaulins+blankets → Golaghat camp (via Kakatigaon). **5 trips** (`SEED-<vehicleId>`, `assigned`).

**5-minute presenter script:**

1. (1 min) Land + login as admin. "Drivers learn about a breach at the water's edge. SARATHI senses it on the map first."
2. (2 min) Live Map on `2026-07-28` + Simulation Start. Narrate one DIVERTED (green line, "moves relief around the flood") and one BLOCKED ("says so before a driver gets there — 5.1 km out").
3. (1 min) Reports: submit a field report as driver → approve as admin → new RED pin. "Ground truth, no rumors — 1 km proof + photo + triage."
4. (1 min) Bulletin: download `bulletin.pdf` for `2026-08-09`. "One click, ready for the commissioner." Q&A: ML band → speed rule; driver scoping is server-side; sidecar down = labelled heuristic.

---

## 7. Appendix

### 7.1 API table

| Domain | Method + path | Auth | Notes |
|---|---|---|---|
| Auth | `POST /api/auth/login` | public | `{userId, password}` → JWT (8h) |
| Auth | `GET /api/auth/me` | token | session hydrate |
| Vehicles | `GET /api/vehicles` | token | admin all · driver own only |
| Incidents | `GET /api/incidents?date=` | token | driver: district-match on latest trip or radius-filtered |
| Incidents | `POST /api/incidents` | admin | manual RED (persisted) |
| Trips | `GET /api/trips` | token | admin all · driver own |
| Trips | `POST /api/trips` | admin | `{driverId, origin, destination, cargoType?, driverPassword?}` |
| Trips | `PATCH /api/trips/:id` | admin | edit |
| Trips | `DELETE /api/trips/:id` | admin | delete |
| Reports | `GET /api/reports?date=` | mixed | public/admin all · driver radius-filtered |
| Reports | `POST /api/reports` | public | multipart photo + 1 km proof (see §3.6) |
| Reports | `PATCH /api/reports/:id` | admin | `{approved \| rejected}`; approved RED/HIGH → `REP-INC-*` |
| Reports | `DELETE /api/reports/:id` | admin | remove |
| Bulletin | `GET /api/bulletin.pdf?date=` | token | A4 PDF stream (driver-scoped) |
| Routes | `GET /api/routes?from=&to=&via=` | token | alias `/api/route/*` |
| Intel | `POST /api/route/analyze` | token | `{origin, destination, eventDate, ...}` → risk + recommendation |
| Intel | `GET /api/risk?lat&lng&date=` | token | district-mapped, cached |
| Intel | `GET /api/weather?lat&lng` | token | Google or Open-Meteo |
| Sim | `GET /api/simulation/status` | token | clock + positions |
| Sim | `GET /api/simulation/path/:vehicleId` | token | driver own-only (else 404) |
| Sim | `POST /api/simulation/start` | token | replay arrived trucks |
| Sim | `POST /api/simulation/reset` | token | depot restart, same date |
| Sim | `POST /api/simulation/date` | admin | switch clock (unblocks) |
| Sim | `POST /api/simulation/scenario` | admin | what-if knobs |
| Sim | `POST /api/simulation/location` | admin | mock-GPS teleport |
| Health | `GET /api/health` | — | liveness |

### 7.2 Socket events

Handshake: `auth.token` (JWT). Rooms: `admin`, `driver:<vehicleId>`.

| Event | When | Payload highlights |
|---|---|---|
| `vehicle:update` | every 2 s tick + connect + `client:subscribe` | `vehicleId, lat, lng, speed, status` |
| `alert:risk` | ML band transition only | band + confidence |
| `alert:blockage` | RED stop | truck + incident |
| `alert:detour` | successful divert | `incidentId + alternateLabel` |

### 7.3 Troubleshooting

- **Login fails / 401:** `JWT_SECRET` missing in `backend/.env` — generate with `openssl rand -base64 48`, restart backend.
- **Port clash on macOS:** AirPlay occupies 5000 — backend is 5001, frontend 5173, ML 8000. Keep them.
- **Map lines look straight:** OSRM unreachable → straight-line fallback. Check network; Google key optional.
- **No RED blocks:** scenario date must be `2026-07-28` (peak). `2026-08-09` is relief (mostly clear).
- **ML shows `source: heuristic`:** sidecar down — `curl localhost:8000/health`, restart Terminal 2. App keeps working by design.
- **Driver sees nothing:** login with exact `userId` (`AS-01-FOOD-04`, not `driver1`); trips are scoped to the JWT.
- **Windows `./dev.sh` not recognized:** `.sh` is bash — use `.\dev.ps1` (setup: `.\setup.ps1`) in PowerShell. Git Bash users can use the `.sh` files.
- **Windows `Missing script: "dev"`:** you ran `npm run dev` from the repo root — `cd backend` or `cd frontend` first (root now prints this hint).
- **Windows script blocked:** `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, then re-run `.\setup.ps1` / `.\dev.ps1`.

### 7.4 Where to read next

- Runbook: `README.md` · Frontend contract: `FRONTEND_HANDOFF.md`, `frontend/CONNECT.md` · ML spec: `machine-learning.md`, `backend/disaster-ml/README.md` · Requirements: `backend/PROJECT.md`, `frontend/PROJECT.md` · Validation: `TEST_CASES.md` · Pitch: `presentation.md`, `PRESENTATION_DECK.md`.
