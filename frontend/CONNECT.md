# SARATHI — Frontend ↔ Backend Integration Guide (`CONNECT.md`)

> For the frontend owner. The backend is **done and frozen** — do everything
> below inside `frontend/` only. Backend contract source of truth:
> `../FRONTEND_HANDOFF.md`. Backend env setup: `../backend/env.md`.
> What judges see: **Landing → Get Started → Login (Admin or Truck Driver)
> → role dashboard → Logout.**

---

## 1. Run the whole project (3 terminals)

```bash
# Terminal 1 — backend API (:5001)
cd backend
cp .env.example .env   # once: set your own JWT_SECRET (openssl rand -base64 48)
npm install
npx prisma migrate deploy
npm run db:seed        # 8 incidents + 4 users + 3 trips (idempotent, rerun anytime)
npm run dev

# Terminal 2 — disaster-ML sidecar (:8000, optional but recommended)
cd backend/disaster-ml
pip install -r requirements.txt
uvicorn serve:app --port 8000 --app-dir src
curl localhost:8000/health   # expect "model_loaded":true

# Terminal 3 — frontend (:5173)
cd frontend
npm install
npm run dev -- --port 5173   # VITE_API_URL=http://localhost:5001 already set in .env
```

Smoke check (60 seconds): open `:5173` → landing loads → Get Started →
login as `admin / sarathi@123` → Live Map shows moving trucks → switch
scenario date to `2026-07-28` → RED banner + alternate road appears.

Seed accounts:

| userId (login)  | password    | role   | sees                                              |
|-----------------|-------------|--------|---------------------------------------------------|
| `admin`         | `sarathi@123` | ADMIN  | all 8 tabs, trip CRUD, simulation clock           |
| `AS-01-FOOD-04` | `driver123`   | DRIVER | Live Map / Alerts / Reports — own corridor only   |
| `AS-02-MED-11`  | `driver123`   | DRIVER | same, Sivasagar trip                              |
| `AS-03-FUEL-07` | `driver123`   | DRIVER | same, Sivasagar-via-Nagaon trip                   |

Demo dates: `2026-07-19` onset (no incident pins — honest empty) ·
`2026-07-28` peak (8 real rows, RED + truck blocks) ·
`2026-08-09` relief (baseline).

---

## 2. The one auth pattern (use for EVERY backend call)

```js
// src/lib/api.js — create this file, import it everywhere
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5001";

export const token = () => localStorage.getItem("sarathi_token") ?? "";
export const authHeaders = (extra = {}) => ({
  Authorization: `Bearer ${token()}`,
  ...extra,
});

export async function api(path, { method = "GET", body, adminOnly = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(body ? { "Content-Type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new Error("Session expired — please log in again.");
  if (res.status === 403) throw new Error(adminOnly ? "Admin only." : "Not allowed for this role.");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
  return res.json();
}

export async function login(userId, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, password }),
  });
  if (res.status === 401) throw new Error("Invalid credentials.");
  if (!res.ok) throw new Error("Login failed — is the backend running on :5001?");
  const { token: jwt, user } = await res.json();
  localStorage.setItem("sarathi_token", jwt);
  localStorage.setItem("sarathi_user", JSON.stringify(user)); // { id, role, name }
  return user;
}

export function logout() {
  localStorage.removeItem("sarathi_token");
  localStorage.removeItem("sarathi_user");
}

export async function hydrateUser() {
  // Call once on app load: restores session across refreshes
  if (!token()) return null;
  try {
    const { user } = await api("/api/auth/me");
    localStorage.setItem("sarathi_user", JSON.stringify(user));
    return user;
  } catch {
    logout();
    return null;
  }
}
```

Role tabs: `ADMIN` → Home, Live Map, Trips, Alerts, Reports, Analytics,
Simulation, Resources. `DRIVER` → **only Live Map, Alerts, Reports**.
Filtering is display-only — the server already scopes all data by JWT, so
never fetch with an admin token to fill a driver's view.

---

## 3. Build order (file by file)

### Step 1 — `HomePage.jsx`: add the Get Started button
The landing hero exists but is a dead end (no button anywhere in the app).
Add a prominent **Get Started** button in the hero that calls
`setActive("Login")` (pass `setActive` into `HomePage` from `App.jsx`).
Logged-in users never see the landing — `App.jsx` skips it (Step 3).

### Step 2 — `LoginPage.jsx`: role toggle + real login (replaces fake creds)
Current code checks hardcoded `Sarathi@123 / 12345678` and never calls the
API — delete that whole block. Required changes:

1. Add a role toggle above the form: **Admin | Truck Driver** (PROJECT FR-17).
   It only changes the hint text and post-login landing — the backend reads
   the role from the JWT, so send just `{ userId, password }`.
2. Replace `handleLogin` with:
```js
import { login } from "../lib/api";
const [role, setRole] = useState("admin"); // "admin" | "driver"

const handleLogin = async (e) => {
  e.preventDefault();
  setError("");
  try {
    const user = await login(userId.trim(), password);
    if (setUserRole) setUserRole(user.role === "ADMIN" ? "admin" : "restricted");
    setIsLoggedIn(true);
    setActive(user.role === "ADMIN" ? "Home" : "Live Map");
  } catch (err) {
    setError(err.message); // 401 → "Invalid credentials."
  }
};
```
3. Fix the hint box (it shows wrong credentials today):
`Admin: admin / sarathi@123` · `Driver: AS-01-FOOD-04 / driver123`.
4. Remove dead links if unimplemented (Forgot Password → drop it or leave
as plain text; no reset endpoint exists).

### Step 3 — `App.jsx`: auth state machine + gate (the structural heart)
`App.jsx` currently has no auth state and renders all tabs always. Add:

```js
const [view, setView] = useState("landing"); // "landing" | "login" | "app"
const [user, setUser] = useState(null);      // { id, role, name } | null

useEffect(() => { hydrateUser().then((u) => { if (u) { setUser(u); setView("app"); } }); }, []);

const isAdmin = user?.role === "ADMIN";
const visibleTabs = isAdmin ? NAV_ITEMS : ["Live Map", "Alerts", "Reports"];
const handleLogout = () => { logout(); setUser(null); setView("landing"); setActive("Home"); };

// render:
if (view === "landing") return <HomePage c={c} setActive={() => setView("login")} />;
if (view === "login") return <LoginPage c={c} setActive={...} setIsLoggedIn={() => setView("app")} setUserRole={...} />;
// view === "app": existing shell, but tabs from visibleTabs + pass token/user to pages
```

Keep state-tabs (no router migration — it works, don't rewrite navigation).

### Step 4 — `TopNav.jsx`: role filter + badge + logout
- Render `visibleTabs` (prop) instead of raw `NAV_ITEMS`.
- Show logged-in user's name + role badge (`ADMIN` green / `DRIVER` blue).
- Add a Logout button → `handleLogout` prop (clears JWT → landing).

### Step 5 — `LiveMapPage.jsx`: embed the real map (signature step)
It currently shows only hardcoded stat cards — the actual `<LiveMap>`
component is never rendered. Add, keeping the cards (wire their numbers
later per Step 6):
```jsx
import LiveMap from "../components/LiveMap";
<LiveMap token={token} date={date} onDateChange={setDate} />
```
`token` comes from `localStorage`/props (LiveMap already falls back to
`sarathi_token`). `date` state (`2026-07-28` default) lives in the page or
`App.jsx` so Alerts/Reports share it.

### Step 6 — data pages: mock arrays → API (same pattern each)
| Page | Replace mock with | Notes |
|---|---|---|
| Trips | `GET/POST/PATCH/DELETE /api/trips` (admin token) | Admin: Vehicle-ID dropdown (`AS-01-FOOD-04`…) + origin/destination/cargo form; `status` ∈ assigned/in_progress/completed; 404 = unknown driver |
| Alerts | `GET /api/incidents?date=` + `POST /api/route/analyze` banner | Severity colors already in LiveMap (`SEVERITY_COLOR`) — reuse |
| Reports | `GET /api/reports?date=` + `POST /api/reports` (JSON or multipart `photo` jpg/png ≤5MB) | Coords must be inside 21–30N, 89–98E; `note` required; show `photoUrl` via `:5001/uploads/...` |
| Analytics | `GET /api/risk?lat=&lng=&date=` + analyze | Display score, level, `confidence`, `source` (ml/heuristic), `baseDate` line — never present heuristic output as ML |
| Simulation | `GET /api/simulation/status`, `POST /api/simulation/date`, `POST /api/simulation/scenario` | **Admin only** (403 for drivers) — hide the whole page from drivers |
| Resources/Home | static | minimal wiring; Home doubles as landing entry |

Error shape everywhere: `{ error }` with 400/401/403/404 — surface
`err.message` from the `api()` helper directly in the UI.

---

## 4. Rules (violations fail review)
- **Real data only.** Empty renders as empty — never invent lat/lng, dates, severities, or heat values.
- **401/403 means fix YOUR call** (missing header / wrong role) — never hardcode credentials, never fetch admin data into a driver view.
- **Backend is frozen.** New-need? Ask the backend owner. No `.env` edits beyond `VITE_API_URL`, no secrets in frontend code, no keys in `VITE_*` vars.
- **Simulation ≠ fake data.** Label truck GPS as simulated; only real RED incidents block (server rule).

## 5. Demo script (3 minutes, judge path)
1. Landing → **Get Started** → Login → `admin / sarathi@123` → all 8 tabs.
2. Live Map, date `2026-07-28`: trucks move, RED pins, RED banner + alternate road.
3. Trips: assign a trip to `AS-01-FOOD-04` (appears after refresh).
4. Logout → login `AS-01-FOOD-04 / driver123` → 3 tabs only, own truck/route.
5. Reports: submit a field report (photo optional) → appears in list → Logout → landing.

## 6. Troubleshooting
| Symptom | Check |
|---|---|
| `Invalid credentials` for seeded accounts | backend `db:seed` not run, or typing `Sarathi@123` (old fake hint) instead of `admin` |
| 401 everywhere | `Authorization: Bearer` header missing/expired → re-login; confirm `sarathi_token` in localStorage |
| 403 on Trips/Simulation as driver | correct — those are admin-only; hide them for drivers |
| CORS error | backend `CORS_ORIGIN` must include the frontend origin (`http://localhost:5173`) |
| Empty map, no trucks | backend not running / not seeded; `GET /api/health` should 200 |
| Map tiles don't load | internet needed for OSM tiles (app shell still works offline) |
| `alert:blockage` never fires on 19-Jul/09-Aug | correct — blocks happen on peak date `2026-07-28` near RED incidents |
