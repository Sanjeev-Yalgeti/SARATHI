# SARATHI — Project Reference & Work Summary

**S**mart **A**I-based **R**egional **A**ccessibility & **T**ransport **H**azard **I**ntelligence  
Smart Hackathon for India (SIH) 2026 | Disaster Logistics & Emergency Supply Management

---

## What is SARATHI?

Every year, Assam's monsoon floods cut off road access across critical highway stretches — NH-715 along the Brahmaputra's southern bank, NH-27 through the valley — stranding emergency supply trucks carrying food, medicine, and fuel for days. Standard navigation apps like Google Maps are useless here: they route based on *historical traffic*, not live flood breach telemetry or landslide alerts.

**SARATHI is the answer to that gap.**

It is a real-time, AI-powered logistics command platform built for:
- **Disaster management authorities** (NDRF, SDMA, ASDMA) — to see all active trucks, flood zones, and road blockages on one map.
- **Emergency supply truck drivers** — to receive route risk assessments, hazard alerts, and safe alternate paths.
- **Field responders & citizens** — to report road hazards with photo proof from their location.

**The core promise**: When a truck is approaching a flood-breached road, SARATHI detects it, reroutes the truck around it, and shows the admin a live view — all automatically.

---

## The Problem It Solves

| Traditional Approach | SARATHI Approach |
|---|---|
| Google Maps routes based on traffic jams | Routes based on live flood breach + landslide data |
| No role-separation for admin vs driver | Admin war-room vs Driver mobile dashboard |
| Manual PDF reports from district officials | ML model + live DRIMS data → auto risk scoring |
| Relief trucks discover road blocks on arrival | Trucks are pre-alerted and rerouted before departure |
| No geospatial proof of field incidents | 1 km GPS proximity enforcement + photo upload |

---

## Who Uses It (User Roles)

### Admin (Disaster Authority / ASDMA Officer)
- Sees **all trucks** on the live map simultaneously
- Can **approve or reject** citizen-reported road incidents
- Has access to **Simulation Sandbox** (run what-if scenarios with custom rainfall/flood levels)
- Can manage **trips** (assign drivers to supply corridors)
- Downloads **ASDMA Flood Bulletin PDFs** for official reporting
- Lands on **Live Map** immediately after login

### Driver (Emergency Supply Truck Operator)
- Sees only their own truck and assigned corridor
- Gets hazard alerts scoped to their route
- Can submit field reports when they spot damage on the road
- Restricted to 3 tabs: Live Map, Alerts, Reports

---

## How the System Works — End to End

Three services run together:

1. **Frontend** (React, port 5173) — what users see and interact with
2. **Backend** (Node.js/Express, port 5001) — REST API, simulation loop, business logic, database
3. **Disaster-ML Sidecar** (Python/FastAPI, port 8000) — ML risk predictions

The frontend polls the backend every 2 seconds for live truck positions. The backend runs a 2-second simulation tick that moves trucks, checks ML risk for each truck's district, and blocks trucks that get too close to active RED incidents.

---

## The Three Services

### 1. Frontend — React App (Port 5173)

Built with **React 19 + Vite + Tailwind CSS v4 + Leaflet** for maps.

| Page | What it does |
|---|---|
| Home | Landing page with NER state coverage, how-it-works explainer |
| Login | Role-based login; both admin and driver land on Live Map |
| Live Map | Real-time truck positions + flood heatmap + hazard pins + corridor risk banner |
| Trips | Admin: full CRUD for supply trips. Driver: sees only their own trip |
| Alerts | Live hazard feed filtered by severity (RED/HIGH/MEDIUM) and type |
| Reports | Citizen/driver field reports with photo proof; admin approval queue |
| Analytics | Corridor-by-corridor risk breakdown with ML confidence scores |
| Simulation | What-if sandbox: change rainfall, flood levels, advance scenario date |
| Resources | Reference docs and links |
| About | Project info + supported NER states gallery |

### 2. Backend — Express API (Port 5001)

Built with **Node.js + Express 5 + TypeScript + Prisma ORM**, stores data in **SQLite**.

Key services inside `backend/src/services/`:

| Service | Role |
|---|---|
| `simulation.service.ts` | 2-second tick loop: moves trucks, checks ML risk, blocks trucks near RED zones |
| `routing.service.ts` | Computes safe routes strictly through Assam Valley (NH-27/NH-715 corridor) |
| `risk.service.ts` | ML-first risk engine: calls ML sidecar, blends with rainfall + incidents, falls back to heuristic |
| `ml-client.ts` | HTTP client that talks to the Python ML sidecar on port 8000 |
| `ml-district.ts` | Maps truck GPS coordinates to the nearest known Assam district for ML input |
| `weather.service.ts` | Fetches live weather from Open-Meteo or Google; feeds rainfall into risk scoring |
| `pdf.service.ts` | Generates ASDMA official flood bulletin PDFs with PDFKit |

### 3. Disaster-ML Sidecar — Python FastAPI (Port 8000)

Built with **Python 3.12 + FastAPI + Scikit-Learn**.

- Trains a **RandomForestClassifier** (300 trees, 10 features) on historical Assam DRIMS flood/landslide data
- Predicts district-level disaster risk: `LOW → MODERATE → HIGH → CRITICAL`
- If unreachable, the backend **silently falls back** to a heuristic formula — nothing crashes
- Key endpoints:
  - `GET /health` — check if model is loaded
  - `GET /districts` — list known districts
  - `POST /predict` — predict risk for a given district, date, and optional overrides

---

## The Live Map — How It Actually Works

This is the heart of SARATHI. Here is what happens on screen:

1. **Trucks** (green dots) move along their assigned corridors every 2 seconds
2. The **heatmap** shows risk levels across a 35-cell grid — green (safe), yellow (watch), orange (high), red (critical)
3. **Hazard pins** (red markers) mark active flood/breach/landslide incidents for the selected date
4. A **corridor risk banner** appears when any truck's path is threatened — recommends an alternate route (e.g. "Use NH-15 via Tezpur northern bypass")
5. If a truck comes within **8 km of a RED incident**, it **stops immediately** (simulating a crash/block)
6. Admins can switch the **scenario clock** between three dates:
   - `2026-07-19` — Flood onset (sparse data, mostly safe)
   - `2026-07-28` — Peak crisis (full hazard grid, blocked corridors)
   - `2026-08-09` — Relief phase (hazards clearing)

---

## The ML Risk Engine — How It Scores Risk

Every truck position is scored in real time:

```
Truck GPS (lat, lng)
  ml-district.ts  → find nearest Assam district (e.g. "Kamrup Metropolitan")
  ml-client.ts    → POST localhost:8000/predict { district, date, rainfall_mm, river_danger_level_count }
  ML Sidecar      → { risk_level: "HIGH", confidence: 0.82, source: "ml" }
  risk.service.ts → blend ML result + live rainfall + 35 km incident proximity
  Final output    → { score: 65, level: "HIGH", reasons: [...] }
  sim loop        → CRITICAL=block truck | HIGH=slow (20 km/h) | else go (40 km/h)
```

If the ML sidecar is offline, the fallback formula kicks in:
```
risk_score = 0.5 × rainfall_factor + 0.3 × road_cut_factor + 0.2 × flood_zone_factor
```
The UI shows `source: "heuristic"` so the operator knows the ML model was not consulted.

**ML Band → UI Level mapping:**

| ML Band  | Score | UI Level     |
|----------|-------|--------------|
| CRITICAL | 85    | RED (≥ 75)   |
| HIGH     | 65    | HIGH (≥ 55)  |
| MODERATE | 40    | MEDIUM (≥ 30)|
| LOW      | 15    | LOW (< 30)   |

---

## The Reports System — Citizen Hazard Ingestion

Anyone (citizen, driver, or admin) can report a hazard from the field:

1. Open the Reports page → Submit a field report
2. **1 km GPS proximity check** runs server-side — if reporter is more than 1 km from the reported location, it is rejected (prevents fake remote reports; uses the Haversine formula)
3. Photo proof can be uploaded (max 5 MB)
4. Report goes into an admin triage queue
5. Admin reviews photo in a lightbox viewer, then either:
   - ✅ **Approves** → instantly added as an active hazard on the map (triggers alerts for all drivers)
   - ❌ **Rejects** → removed from active view; stored in DB and reappears as pending on admin re-login for re-review

---

## The Simulation Sandbox — What-If Scenarios

Admin-only feature. Lets an authority war-game disaster responses:

- **Scenario Clock** — jump to onset / peak / relief dates
- **Rainfall Slider** — inject custom rainfall (mm) to see how risk scores change
- **River Danger Level Knob** — simulate rising river levels
- Changes are fed live into the ML sidecar as overrides
- Truck behavior updates in real time on the map

---

## Authentication & Security

- **JWT tokens** (8-hour expiry) stored in localStorage as `sarathi_token`
- Passwords hashed with **bcrypt**
- **Role-based access**: admin sees all 8 tabs; driver only sees 3 (Live Map, Alerts, Reports)
- Token verified on every API request via `authMiddleware`
- On refresh/re-login, frontend calls `GET /api/auth/me` to re-validate the token server-side

---

## Data Model (Key Tables in SQLite)

| Table | What it stores |
|---|---|
| `User` | Drivers and admins with hashed passwords and roles |
| `Trip` | Supply runs (origin → destination, cargo type, assigned driver, status) |
| `Vehicle` | Truck GPS coordinates, speed, heading, status (moving/blocked) |
| `Incident` | Active hazard events (flood breach, landslide, overtop, erosion) with lat/lng and severity |
| `Report` | Citizen/driver filed hazard reports with photo URLs and triage status |
| `RiskCache` | Cached ML risk results keyed by (lat, lng, date) to avoid redundant sidecar calls |

---

## Seed Accounts (For Demo & Testing)

| User ID | Password | Role | What they see |
|---|---|---|---|
| `admin` | `sarathi@123` | ADMIN | All 8 tabs, trip CRUD, simulation, reports triage, PDF bulletin |
| `AS-01-FOOD-04` | `driver123` | DRIVER | Food truck on Guwahati → Golaghat corridor |
| `AS-02-MED-11` | `driver123` | DRIVER | Medical truck on Guwahati → Sivasagar corridor |
| `AS-03-FUEL-07` | `driver123` | DRIVER | Fuel tanker on Guwahati → Nagaon corridor |

---

## How to Start the Entire Stack

```powershell
# From the project root in PowerShell:
.\dev.ps1
```

This single script:
1. Kills anything running on ports 5001, 5173, 8000
2. Starts the **Python ML sidecar** on port 8000
3. Starts the **Node.js backend** on port 5001
4. Starts the **React frontend** on port 5173
5. Waits for all services to respond before declaring ready

Then open: **http://localhost:5173**

---

## Manual Setup (If dev.ps1 Fails)

```bash
# Terminal 1 — Backend
cd backend
cp .env.example .env        # fill in JWT_SECRET (required), GOOGLE_MAPS_API_KEY (optional)
npm install
npx prisma migrate deploy   # creates the SQLite database tables
npm run db:seed             # loads 8 incidents, 4 users, 3 trips
npm run dev                 # starts on :5001

# Terminal 2 — ML Sidecar
cd backend/disaster-ml
pip install -r requirements.txt
uvicorn serve:app --port 8000 --app-dir src
# verify: curl localhost:8000/health  →  { "model_loaded": true }

# Terminal 3 — Frontend
cd frontend
npm install
npm run dev -- --port 5173
```

---

## Environment Variables (backend/.env)

| Variable | Required | Notes |
|---|---|---|
| `PORT` | Yes | Set to `5001` |
| `JWT_SECRET` | Yes | Long random string — generate with `openssl rand -base64 48` |
| `DATABASE_URL` | Yes | `file:./dev.db` (SQLite, auto-created) |
| `GOOGLE_MAPS_API_KEY` | No | Optional; falls back to free OSRM + Open-Meteo if absent |
| `ML_URL` | No | Defaults to `http://localhost:8000` |
| `CORS_ORIGIN` | No | Defaults to `http://localhost:5173` |

---

## Key Design Decisions

### Why SQLite?
Zero external dependencies for a hackathon demo. Production upgrade path: just change `DATABASE_URL` to a PostgreSQL connection string — Prisma handles the rest.

### Why a Python ML sidecar instead of a Node ML package?
Scikit-learn's RandomForest in Python is battle-tested for structured tabular data. The sidecar pattern lets the Node backend stay lightweight while the ML model scales independently.

### Why a heuristic fallback?
The ML model trains on a small dataset (a few days of DRIMS PDFs). In production, if the sidecar is slow or down, relief operations cannot wait. The heuristic ensures the system is **always operational**.

### Why 1 km GPS proximity for reports?
Prevents abuse — someone sitting in another city cannot falsely report a road blocked 100 km away. The Haversine formula is computed server-side so it cannot be bypassed from the client.

### Why constrain routing to the Assam Valley corridor?
Google Routes and OSRM sometimes suggest mountain shortcuts through East Kameng / Koloriang that are completely impractical for heavy relief trucks. We explicitly filter those out and constrain routes to NH-27 and the Brahmaputra Valley.

---

## API Reference

| Endpoint | Method | Access | Purpose |
|---|---|---|---|
| `/api/auth/login` | POST | Public | Login: returns JWT + user |
| `/api/auth/me` | GET | Auth | Validate token, get profile |
| `/api/vehicles` | GET | Auth | Live truck positions + status |
| `/api/incidents` | GET | Auth | Active hazard events for a date |
| `/api/incidents` | POST | Admin | Inject a manual incident (demo) |
| `/api/trips` | GET/POST/PATCH/DELETE | Auth/Admin | Manage supply trips |
| `/api/reports` | GET | Auth | Fetch incident reports |
| `/api/reports` | POST | Public | Submit a field report with photo |
| `/api/reports/:id` | PATCH | Admin | Approve or reject a report |
| `/api/risk` | GET | Auth | ML + heuristic risk score for a coordinate |
| `/api/route/analyze` | POST | Auth | Full corridor analysis + reroute recommendation |
| `/api/simulation/status` | GET | Auth | Current scenario + truck states |
| `/api/simulation/date` | POST | Admin | Change scenario clock |
| `/api/simulation/scenario` | POST | Admin | Apply what-if parameters |
| `/api/weather` | GET | Auth | Live weather for a corridor |
| `/api/bulletin.pdf` | GET | Auth | Download ASDMA bulletin PDF |

---

## Feature Completion Status

| Feature | Status |
|---|---|
| JWT Auth + RBAC (Admin / Driver) | ✅ Done |
| Live Map with truck simulation | ✅ Done |
| Risk heatmap (4 severity levels) | ✅ Done |
| Corridor risk banner + alternate route | ✅ Done |
| Truck auto-block near RED incidents | ✅ Done |
| ML sidecar (RandomForest, 10 features) | ✅ Done |
| ML drives simulation truck motion | ✅ Done |
| Heuristic fallback when ML offline | ✅ Done |
| Trips CRUD (admin) + driver scoped view | ✅ Done |
| Scenario clock (3 dates) | ✅ Done |
| What-if simulation sandbox | ✅ Done |
| Field reports + 1 km GPS verification | ✅ Done |
| Photo proof upload + lightbox viewer | ✅ Done |
| Admin report triage (approve / reject) | ✅ Done |
| Rejected reports restore on re-login | ✅ Done |
| ASDMA Bulletin PDF generation | ✅ Done |
| Analytics (corridor risk comparison) | ✅ Done |
| Real-time Socket.io alert popups | ✅ Done |
| NER Supported States gallery | ✅ Done |
| Light / Dark theme toggle | ✅ Done |
| dev.ps1 one-command startup (all 3 services) | ✅ Done |

---

## Supported North-Eastern States

SARATHI covers all 8 NER states: **Assam, Arunachal Pradesh, Meghalaya, Manipur, Mizoram, Nagaland, Tripura, Sikkim**

Active routing and ML coverage is currently focused on **Assam** (the Guwahati–Jorhat valley corridor), with the architecture ready to expand district centroids and training data for the remaining 7 states.

---

*Last updated: September 11, 2026*
