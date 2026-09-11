SARATHI:-Smart AI-based Regional Accessibility & Transport Hazard Intelligence
<img width="1024" height="739" alt="f0175592-0e79-4e51-a448-c5eb720e4b24" src="https://github.com/user-attachments/assets/71777ecf-76c5-402e-b9cf-41c9173c09b6" />

## Run the whole project (backend + seeding + frontend)

You need: **Node 20+**, **npm**, **Python 3.12+** (only for the optional ML
sidecar). No database server — the backend uses a local SQLite file created
automatically. Use **3 terminals**.

```bash
# ── Terminal 1: backend API on http://localhost:5001 ──
cd backend
cp .env.example .env   # once per machine, then edit .env (see below)
npm install
npx prisma migrate deploy   # creates tables (once per clone)
npm run db:seed             # 8 incidents + 6 users + 5 trips (rerun anytime)
npm run dev
```

`.env` checklist (each machine uses its **own** values — never share `.env`):
- `PORT=5001` (macOS AirPlay squats on 5000)
- `JWT_SECRET=` your own long random string — generate with
  `openssl rand -base64 48` (login breaks without it)
- `GOOGLE_MAPS_API_KEY=` optional — without it, routes/weather use the free
  OSRM + Open-Meteo fallbacks automatically
- Everything else can stay as in `.env.example`

```bash
# ── Terminal 2: disaster-ML sidecar on http://localhost:8000 (recommended) ──
cd backend/disaster-ml
pip install -r requirements.txt
uvicorn serve:app --port 8000 --app-dir src
curl localhost:8000/health   # expect "model_loaded":true
# If the sidecar is down, the backend still works — risk answers degrade to
# a labelled heuristic fallback ("source":"heuristic"), nothing crashes.

# ── Terminal 3: frontend on http://localhost:5173 ──
cd frontend
npm install
npm run dev -- --port 5173   # VITE_API_URL=http://localhost:5001 is preset
```

> **Windows (PowerShell)?** Don't run the `.sh` scripts and don't run
> `npm run dev` from the repo root (root has no `dev` script — it prints a
> hint). One-time setup: `.\setup.ps1`. Daily run: `.\dev.ps1`. If scripts
> are blocked: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.
> Git Bash users can use `./setup.sh` + `./dev.sh` instead.

### Log in and demo (3 minutes)

| userId            | password    | role   | sees                                             |
|-------------------|-------------|--------|--------------------------------------------------|
| `admin`           | `sarathi@123` | ADMIN  | all 8 tabs, trip CRUD, simulation clock          |
| `AS-01-FOOD-04`   | `driver123`   | DRIVER | Live Map / Alerts / Reports — own corridor only  |
| `AS-02-MED-11`    | `driver123`   | DRIVER | same, Sivasagar trip                             |
| `AS-03-FUEL-07`   | `driver123`   | DRIVER | same, Sivasagar-via-Nagaon trip                  |
| `AS-04-WATER-09`  | `driver123`   | DRIVER | same, Sivasagar-via-Jorhat water tanker          |
| `AS-05-SHELTER-12`| `driver123`   | DRIVER | same, Golaghat-via-Kakatigaon shelter kits       |

1. Open `:5173` → landing → **Get Started** → login as admin.
2. Live Map, scenario date `2026-07-28`: trucks move, RED pins, RED banner +
   alternate road. (Dates: `2026-07-19` onset = honest empty ·
   `2026-07-28` peak = 8 real rows + blocks · `2026-08-09` relief.)
3. Trips: assign a trip to `AS-01-FOOD-04`.
4. Logout → login as `AS-01-FOOD-04` → 3 tabs only, own truck/route.
5. Reports: submit a field report (photo optional) → appears in the list.

### Verify everything works

```bash
curl localhost:5001/api/health            # {"ok":true,...}
curl localhost:8000/health                # "model_loaded":true
cd backend && npm run typecheck && npm run lint
cd backend && npm run test:risk && npm run test:sim
cd backend/disaster-ml && python3 -m pytest -q   # 93 passed
```

### Troubleshooting

| Symptom | Fix |
|---|---|
| Login fails / `JWT_SECRET is not set` | set a real `JWT_SECRET` in `backend/.env`, restart backend |
| Empty map, no trucks/incidents | run `npx prisma migrate deploy && npm run db:seed` in `backend/` |
| 401 on every request | re-login (token expired/missing); frontend stores it as `sarathi_token` |
| 403 on Trips/Simulation as driver | correct — admin-only; hidden for drivers |
| CORS error in browser | backend `CORS_ORIGIN` must include the frontend origin |
| Port 5001 in use | a stale server is running: `lsof -i :5001`, kill it, restart |
| `./dev.sh` not recognized (PowerShell) | `.sh` is bash — on Windows use `.\dev.ps1` (and `.\setup.ps1` for setup) |
| `Missing script: "dev"` at repo root | `dev` lives in `backend/` and `frontend/` only — `cd backend` / `cd frontend` first |
| Map tiles don't load | internet needed for OSM tiles (app shell works offline) |

### Repo map & deeper docs

- `backend/` — Express + Prisma API (see `backend/PROJECT.md` spec,
  `backend/BACKEND_TASKS.md` task breakdown)
- `backend/disaster-ml/` — ML sidecar + training (see `machine-learning.md`)
- `frontend/` — React + Leaflet app (integration manual:
  `frontend/CONNECT.md`, contract: `FRONTEND_HANDOFF.md`)
- `TEST_CASES.md` — dataset-driven validation cases
- `.env` files are gitignored and never committed — share
  `.env.example` + these docs instead, never real secrets.
