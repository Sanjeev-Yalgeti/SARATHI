# SARATHI — Frontend Handoff (Figma build)

Who owns what:

- **Friend (Figma frontend):** app shell, landing, login, role tabs, all pages
  except the map. Consumes the backend API below.
- **You (Leaflet only):** `frontend/src/components/LiveMap.jsx` — already
  built, drop-in, documented in §5.
- **Backend:** done and frozen except on request. Base URL
  `http://localhost:5001` (note: **5001, not 5000** — macOS AirPlay squats
  on port 5000).

## 1. Run it

```bash
# Backend (needs Node + npm install done once in backend/)
cd backend
npx prisma migrate deploy   # one-time per clone (creates tables)
npm run db:seed             # loads 8 real incidents + users + trips
npm run dev                 # serves API on :5001, simulation ticks every 2s

# Frontend
cd frontend
npm install                 # leaflet + react-leaflet already added
npm run dev -- --port 5173  # Vite on :5173 (CORS already allowed)
```

Frontend API base: `frontend/.env` → `VITE_API_URL=http://localhost:5001`
(code falls back to that URL if the env var is missing).

## 2. Seed accounts (prototype, from `backend/PROJECT.md` §10)

| userId (login)  | password    | role   | sees                                                      |
| --------------- | ----------- | ------ | --------------------------------------------------------- |
| `admin`         | `sarathi@123` | ADMIN  | everything, all 8 tabs, trip CRUD, scenario clock         |
| `AS-01-FOOD-04` | `driver123`   | DRIVER | own truck only, Live Map / Alerts / Reports, own trip     |
| `AS-02-MED-11`  | `driver123`   | DRIVER | same, scoped to Sivasagar trip                            |
| `AS-03-FUEL-07` | `driver123`   | DRIVER | same, scoped to Sivasagar-via-Nagaon trip                 |

Driver scoping is enforced **server-side** (vehicles, incidents, reports,
trips, bulletin all filter by the JWT). The frontend only hides tabs.

## 3. Auth contract (friend implements this)

- `POST /api/auth/login` (public) — body `{ userId, password }` →
  `{ token, user: { id, role, name } }`. Wrong creds → `401
  { error: "Invalid credentials" }`.
- `GET /api/auth/me` (token) → `{ user }`. Use on refresh to hydrate.
- Every other call: header `Authorization: Bearer <token>`.
- Token: JWT, 8h expiry. Store in `localStorage` as `sarathi_token`
  (LiveMap reads this key as fallback) + cached user as `sarathi_user`.
- No/invalid token → `401`. Admin-only route with driver token → `403
  { error: "Admin only" }`.
- Roles in token: `ADMIN` | `DRIVER`. Tabs: admin gets Home, Live Map,
  Trips, Alerts, Reports, Analytics, Simulation, Resources; driver gets
  **only Live Map, Alerts, Reports**. Logout = clear storage → `/`.

## 4. Endpoint reference

| Method | Path | Auth | Body / params | Returns |
| ------ | ---- | ---- | ------------- | ------- |
| GET | `/api/health` | — | — | `{ ok, time }` |
| POST | `/api/auth/login` | — | `{ userId, password }` | `{ token, user }` |
| GET | `/api/auth/me` | token | — | `{ user }` |
| GET | `/api/vehicles` | token | — | `{ vehicles: [{ vehicleId, lat, lng, speed, status, origin, destination, cargoType }] }` — `status`: `moving \| blocked \| idle`; driver gets 1 |
| GET | `/api/incidents?date=YYYY-MM-DD` | token | `date` optional | `{ incidents: [{ id, lat, lng, type, severity, eventDate, road, district, note, status }] }` — `severity`: `LOW \| MEDIUM \| HIGH \| RED` |
| POST | `/api/incidents` | **admin** | `{ lat, lng, type, severity, eventDate, road?, district?, note? }` | `201 { incident }` |
| GET | `/api/routes?from=lat,lng&to=lat,lng` | token | query | `{ primary[], alternate[], alternateLabel, distance_km, duration_min, traffic_level, blocked, source }` |
| POST | `/api/route/analyze` (alias `/api/routes/analyze`) | token | `{ origin:{lat,lng}, destination:{lat,lng}, eventDate }` | `{ risk{landslide_prob,score,level,reasons}, blocked, recommendedRoad, route, delayMessage }` |
| GET | `/api/risk?lat=&lng=&date=` | — (public) | query | `{ landslide_prob, score, level, reasons, source, rainfall_mm }` |
| GET | `/api/weather?lat=&lng=` | — (public) | query | `{ source, rainfall_mm, probability, condition?, wind_kph? }` |
| GET | `/api/trips` | token | — | `{ trips: [{ id, driverId, origin, destination, cargoType, status }] }` — driver gets own |
| POST | `/api/trips` | **admin** | `{ driverId, origin, destination, cargoType? }` | `201 { trip }` (404 if driver unknown) |
| PATCH | `/api/trips/:id` | **admin** | `{ origin?, destination?, cargoType?, status? }` (`assigned \| in_progress \| completed`) | `{ trip }` |
| DELETE | `/api/trips/:id` | **admin** | — | `{ deleted: true }` |
| GET | `/api/simulation/status` | token | — | `{ scenarioDate, vehicles[] }` (driver: own truck) |
| POST | `/api/simulation/date` | **admin** | `{ date: YYYY-MM-DD }` | `{ scenarioDate, vehicles[] }` — unblocks trucks, replays date |
| GET | `/api/reports?date=` | token | `date` optional | `{ reports: [{ id, lat, lng, type, severity, note, photoUrl, eventDate }] }` |
| POST | `/api/reports` | token | JSON **or** multipart (`photo` jpg/png ≤5MB) `{ lat, lng, type, severity, note, eventDate }` — coords must be inside 21–30N, 89–98E | `201 { report }` |
| GET | `/api/bulletin.pdf?date=` | token | `date` optional (default 2026-08-09) | PDF download (driver copy is scoped) |

Error shape everywhere: `{ error: "<message>" }` with 400 / 401 / 403 /
404 status codes.

## 5. Leaflet piece (your part — already built)

File: `frontend/src/components/LiveMap.jsx` (+ Leaflet CSS import in
`src/main.jsx`, OSM tiles = no key needed).

```jsx
import LiveMap from "./components/LiveMap";

<LiveMap token={jwt} date="2026-07-28" />;

// All props (everything except token/date has a default):
//   token, date="2026-07-28", apiUrl, pollMs=2000,
//   showIncidents=true, showBanner=true,
//   origin={Guwahati}, destination={Sivasagar}, height="52vh", onDateChange
```

It polls `GET /api/vehicles` every 2s (green = moving, red = blocked),
pins `GET /api/incidents?date=`, and shows the RED banner from
`POST /api/route/analyze`. No other frontend file touches the map —
style/position it freely inside the Figma layout.

## 6. Demo dates + golden path (teacher script, ~3 min)

Dates: `2026-07-19` onset (no incidents — honest empty) ·
`2026-07-28` peak (8 real rows, RED + blocks) ·
`2026-08-09` relief (empty until geocoded rows merge).

1. `/` → Get Started → `/login` → admin login → all tabs.
2. Live Map on 28-Jul: trucks move, RED pins, RED banner + alternate road.
3. Trips: assign trip to `AS-01-FOOD-04`.
4. Logout → driver login (`AS-01-FOOD-04`) → 3 tabs only, own truck/route.
5. Reports: submit a field report (photo optional) → appears in list.

## 7. Rules (do not break)

- **Incidents are real-data-only.** Never invent lat/lng, dates, or
  severities. Missing data renders as empty — never fabricated.
- **Simulation ≠ fake data.** Truck GPS is simulated and must stay labeled
  as such; only real `RED` incidents (15 km radius) can block trucks.
- **Backend changes go through the backend owner.** Frontend must not
  work around 401/403 — fix auth flow instead.
- Secrets (`.env`, API keys) are gitignored and never committed.

## 8. Parked (NOT in scope — see `backend/PROJECT.md` §13)

Socket.io realtime (polling ships), Google map tiles, geocode merge
(`npm run geocode:incidents` staging flow), bulletin figure sourcing,
dead-route cleanup, `POST /api/simulation/location`, JWT on
weather/risk, per-driver passwords.
