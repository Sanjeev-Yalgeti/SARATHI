# SARATHI — Project Progress & Work Status (`work_done.md`)

**Date:** September 10, 2026  
**Project:** SARATHI — Logistics Intelligence Platform  
**Target Region:** North-Eastern Region (NER), India (Guwahati → Nagaon → Golaghat → Sivasagar corridor)

---

## 1. Executive Summary

SARATHI is an intelligent logistics visibility, risk-aware routing, and decision-support platform designed for disaster management and relief supply transit during severe weather events (e.g., Assam floods and landslides). 

The platform separates responsibilities cleanly:
1. **Backend (Node.js + TypeScript + Prisma + SQLite):** Complete, frozen, and operational on port `5001`. It hosts auth, simulation, incidents, GIS routing, risk analysis, trips, field reports, and bulletin generation.
2. **Frontend (React + Vite + Tailwind CSS):** Operational on port `5173`. Figma-designed UI shells for all primary user journeys (Home, Login, Live Map, Trips, Alerts, Reports, Analytics, Simulation, Resources) with light/dark theme support.

---

## 2. What Has Been Completed

### A. Backend Implementation (`backend/`)
- [x] **Core Architecture & Server:**
  - Node.js + Express 5 with TypeScript (`backend/src/app.ts`, `backend/src/index.ts`).
  - Running on port `5001` with CORS enabled for Vite frontend (`localhost:5173`), Helmet security, and Morgan request logging.
- [x] **Database & Persistence (Prisma ORM + SQLite):**
  - Schema defined in `backend/prisma/schema.prisma` with models:
    - `User`: Auth accounts with bcrypt-hashed passwords and roles (`ADMIN`, `DRIVER`).
    - `Trip`: Assignments linking origin, destination, cargo type, and status to a specific driver.
    - `Incident`: Real ASDMA flood and landslide breach records with latitude, longitude, severity, date, and status.
    - `FieldReport`: Crowd-sourced incident reports with photo uploads.
    - `RiskCache`: 10-minute cached risk snapshots and weather calculations.
  - Portable SQLite database (`prisma/dev.db`) designed for seamless PostgreSQL/PostGIS migration.
  - Database seed script (`prisma/seed.ts`) pre-loading:
    - 1 Admin (`admin` / `sarathi@123`)
    - 3 Truck Drivers (`AS-01-FOOD-04`, `AS-02-MED-11`, `AS-03-FUEL-07` / `driver123`)
    - 8 real ASDMA flood/landslide incidents from July 2024 / July 2026 bulletins.
    - Pre-assigned routes for drivers.
- [x] **Authentication & Role-Based Access Control (RBAC):**
  - `POST /api/auth/login`: Public credential check (bcrypt), issuing signed 8-hour JWTs with `{ id, role, name }`.
  - `GET /api/auth/me`: Authenticated endpoint to hydrate current session and profile.
  - Middleware (`authenticate`, `requireAdmin`) enforcing server-side scoping and rejecting unauthorized requests.
- [x] **Logistics Intelligence & Routing Engine:**
  - `POST /api/route/analyze` & `/api/routes/analyze`: Comprehensive corridor risk assessment comparing route geometry with incident zones, weather, and landslide probability. Returns alternate routes and blockage warnings.
  - `GET /api/routes`: Route calculation using Google Routes API with OSRM fallback.
  - `GET /api/risk`: Landslide probability and weighted risk scoring (Dhruv ML integration with heuristic fallback).
  - `GET /api/weather`: Weather conditions using Google Weather API with Open-Meteo fallback.
- [x] **Live Fleet Simulation & Scoping:**
  - `GET /api/vehicles`: In-memory truck GPS positions moving along real OSRM polylines. Admin views all trucks; Driver token is automatically scoped to their vehicle only.
  - Simulation engine dynamically stops trucks (sets speed to 0 and status to `blocked`) within 15 km of active `RED` incidents.
  - `GET /api/simulation/status` and `POST /api/simulation/date` for replaying scenario dates (Onset: `2026-07-19`, Peak: `2026-07-28`, Relief: `2026-08-09`).
- [x] **Field Reports & Incident Ingestion:**
  - `GET /api/reports?date=` and `POST /api/reports`: Accepts JSON or multipart form data with image upload (stored in `uploads/`), validated within NER bounding box (21–30°N, 89–98°E).
  - `GET /api/incidents`: Queryable by scenario date.
  - `POST /api/incidents`: Admin endpoint for injecting manual road blocks during demonstrations.
- [x] **Trips Management:**
  - Full CRUD: `GET /api/trips`, `POST /api/trips` (admin), `PATCH /api/trips/:id` (admin), `DELETE /api/trips/:id` (admin). Scoped to logged-in driver on driver requests.
- [x] **Automated Bulletin Generation:**
  - `GET /api/bulletin.pdf?date=`: Dynamically compiles ASDMA flood bulletin PDF via PDFKit, including affected districts, casualty statistics, river levels, and truck statuses.

---

### B. Frontend Implementation (`frontend/`)
- [x] **Vite + React Setup:**
  - Modern React setup with Tailwind CSS v4 and Lucide React icons.
  - Clean client-side layout with dark/light mode toggle (`TopNav.jsx`, `palette`).
- [x] **UI Pages (Figma Design Layouts):**
  - `HomePage.jsx`: Full landing page with branding, hero section, key capability cards, statistics, and Get Started CTA.
  - `LoginPage.jsx`: Split screen with illustration, User ID and Password fields, and back navigation.
  - `LiveMapPage.jsx`: Logistics overview with key operational stat cards.
  - `TripsPage.jsx`: Tabbed view for Ongoing, Upcoming, and Completed trips.
  - `AlertsPage.jsx`: High, Medium, and Low risk alert cards with filter dropdowns.
  - `ReportsPage.jsx`: Field incident report cards with state, type, and date dropdowns.
  - `AnalyticsPage.jsx`: Operational charts and metric placeholders.
  - `SimulationPage.jsx`: Driver simulation controls with weather, traffic, and delay metrics.
  - `ResourcesPage.jsx` & `AboutPage.jsx`: Reference documentation and background.
- [x] **Reusable Components:**
  - `TopNav.jsx`: Role-aware navigation bar, theme switch button, and logout button.
  - `StatCard.jsx`, `PillButton.jsx`, `Dropdown.jsx`, `Sidebar.jsx`.
- [x] **Authentication & Session Hydration (Implemented):**
  - Configured API base in `frontend/.env` (`VITE_API_URL=http://localhost:5001`).
  - Created centralized Axios client `frontend/src/api/client.js` with automatic Bearer token interceptor and 401 handling.
  - Built `frontend/src/api/auth.js` providing `login()`, `getProfile()`, `logout()`, and token helpers.
  - Updated `frontend/src/pages/LoginPage.jsx` with real backend `POST /api/auth/login` calls, inline error handling, and 1-click seed account presets.
  - Added seamless **Developer Network Error Bypass** in `frontend/src/api/auth.js`: if backend is offline or throws a network error, it automatically bypasses without crashing, creates a session (Admin or Driver based on ID), and preserves local session hydration.
  - Implemented session hydration on page refresh in `frontend/src/App.jsx` via `GET /api/auth/me` with automatic storage fallback.
  - Enforced strict role-based navigation and route guards (`ADMIN` vs `DRIVER`), restricting drivers to Live Map, Alerts, and Reports.
  - Enhanced `frontend/src/components/TopNav.jsx` with real user/role indicator badge and unified logout handler.
- [x] **Interactive GIS Logistics Map (Reimplemented):**
  - Re-integrated Leaflet CSS into `frontend/src/main.jsx`.
  - Built comprehensive `frontend/src/components/LiveMap.jsx`:
    - 2-second live polling of `GET /api/vehicles` (green for moving trucks, red for blocked, gray for idle).
    - Scenario Date Switcher for the 3 demo phases (`2026-07-19` Onset, `2026-07-28` Peak with 8 real incidents, `2026-08-09` Relief).
    - Fetches and pins real ASDMA incidents from `GET /api/incidents?date=` with color coding by severity (RED, HIGH, MEDIUM, LOW).
    - Integrates corridor risk assessment banner from `POST /api/route/analyze` for Guwahati → Sivasagar with alternate diversion guidance.
    - Added offline dev fallback simulation (moves trucks and renders peak incidents when backend is offline).
    - Driver-level scoping: automatically filters fleet markers to show only the logged-in driver's truck.
    - Toggle layers for Incidents, Fleet, and Risk Banner + floating interactive Map Legend.
  - Mounted `LiveMap` directly into `frontend/src/pages/LiveMapPage.jsx` above key operational stat cards.
- [x] **Real-Time Trips Management System (Implemented):**
  - Created concise `frontend/src/components/TripCard.jsx`:
    - Displays trip ID, assigned driver/vehicle ID, cargo type, and corridor (origin → destination).
    - Correlates with live fleet telemetry from `GET /api/vehicles` (real-time speed, moving vs blocked status, and status badge).
    - Actionable "View Details" trigger.
  - Created in-depth `frontend/src/components/TripDetailsModal.jsx`:
    - Detailed route breakdown, live GPS sensor coordinates, and cargo specifications.
    - Integrated corridor risk analysis from `POST /api/route/analyze` showing active hazard alerts and recommended diversions (e.g. via Tezpur / NH-15).
    - Weather & hazard conditions summary.
    - Admin management controls: change trip status (`assigned`, `in_progress`, `completed` via `PATCH /api/trips/:id`) and delete trip (`DELETE /api/trips/:id`).
  - Created `frontend/src/components/AssignTripModal.jsx` for Admin dispatching (`POST /api/trips`).
  - Updated `frontend/src/pages/TripsPage.jsx`:
    - Full backend API integration with `GET /api/trips` and 2.5s vehicle telemetry sync.
    - Driver-level scoping: drivers automatically only see their assigned trips.
    - Status tabs (All, Ongoing, Upcoming, Completed) with dynamic count badges.
    - Developer offline bypass fallback ensuring seamless local testing even when backend is offline.

- [x] **Verified Incident Reporting with Photo Proof & Admin Review (Implemented):**
  - **1.0 km Proximity Verification**: Built `frontend/src/utils/geo.js` implementing Haversine distance calculations and strict $\le 1.0\text{ km}$ geofencing validation to prevent false or remote reports.
  - **Public & Driver Modal (`frontend/src/components/SubmitReportModal.jsx`)**:
    - Accessible directly on the **HomePage without login**, and on **ReportsPage** for logged-in Drivers and Admins.
    - Image upload with live client-side preview, $\le 5\text{MB}$ validation, and type/severity tagging.
    - Real-time Proximity Meter showing exact distance in meters from the incident site. Includes GPS detection and dev testing simulation controls.
  - **Admin Review & Decision Portal (`frontend/src/pages/ReportsPage.jsx`)**:
    - Lists submitted reports with photo proof thumbnail and full-resolution lightbox viewer (`PhotoProofViewer.jsx`).
    - Status tabs (All, Pending Decision, Approved, Rejected) and hazard type filters.
    - Admin action buttons: **[Approve & Broadcast Alert]** (verifies report and promotes it to active map alert) and **[Reject / Dismiss]**.
    - ASDMA Bulletin PDF one-click download integration.
  - **Backend Support (`backend/src/routes/reports.ts`)**:
    - Made `POST /api/reports` publicly accessible for citizen reports while preserving driver radius scoping for `GET /api/reports`.
    - Server-side 1.0 km radius validation.
    - Added `PATCH /api/reports/:id` for Admin decision processing.

- [x] **Dynamic Risk Heatmap on Live GIS Map (Implemented):**
  - **Leaflet Heatmap Wrapper (`frontend/src/components/HeatmapLayer.jsx`)**:
    - Thin React wrapper around `leaflet.heat` using `useMap()` and `L.heatLayer()`.
    - Configured with `radius=25`, `blur=20`, `minOpacity=0.4`, and custom four-tier color gradient matching SARATHI risk tokens (`LOW`: green, `MED`: yellow, `HIGH`: orange, `RED`: red).
    - Guaranteed cleanup on unmount and prop change to eliminate memory leaks and ghost layers.
  - **Heat Data Hook (`frontend/src/hooks/useHeatData.js`)**:
    - Given `(date, token)`: fetches real incidents from `GET /api/incidents?date=` and samples `GET /api/risk` across a 35-cell grid over the corridor bounding box (lat 26.1–27.2, lng 91.7–94.7).
    - Weights: `RED=1.0`, `HIGH=0.7`, `MEDIUM=0.4`, `LOW=0.2`, and risk cells `score / 100`.
    - Caches results by date in memory for instant switching with zero redundant network requests or poll loops.
    - Preserves server-side scoping by passing the authenticated user's token directly.
    - Never fabricates coordinates or intensities; renders honest empty heat for sparse dates (19-Jul, 09-Aug).
  - **Map Controls & Transparency Legend (`frontend/src/components/LiveMap.jsx`)**:
    - Integrated `<HeatmapLayer>` underneath vehicle and incident markers to keep pins interactive.
    - Heatmap On/Off toggle with real-time active points badge.
    - Mode selector: `[Incidents Only]` vs `[Incidents + Risk Grid]` (with sampling progress indicator).
    - Enhanced floating Map Legend with 4 risk gradient chips (`LOW`, `MED`, `HIGH`, `RED`), Model Source line (`Disaster-ML` / `Heuristic`), base date, and points coverage count.

---

## 3. What Is To Be Done (Action Items)

Per `FRONTEND_HANDOFF.md` and the system specifications, the remaining tasks are:

### 1. Connect Alerts Page (`AlertsPage.jsx`) (Priority 1)
- Fetch real alerts from `GET /api/incidents` and `GET /api/risk`.
- Render actual incident types (Breach, Landslide, Overtop, Erosion) with real road names and severities.

### 6. Connect Scenario Clock on Simulation Page (`SimulationPage.jsx`) (Priority 6)
- Connect date switcher to `POST /api/simulation/date`:
  - **19 July 2026 (Onset):** Trucks moving, no incidents.
  - **28 July 2026 (Peak):** 8 real incidents, trucks stopped at flood index, RED blockage banner.
  - **09 August 2026 (Relief):** Relief phase replay.
