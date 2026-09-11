# SARATHI — Comprehensive Project Status & Work Summary (`work_done.md`)

**Date:** September 11, 2026  
**Project:** SARATHI — Smart AI-based Regional Accessibility & Transport Hazard Intelligence  
**Focus:** Disaster Logistics, Hazard-Aware Routing & Emergency Supply Transit  
**Target Corridor:** North-Eastern Region (NER), India (Guwahati → Nagaon → Kaziranga → Jorhat → Sivasagar / Golaghat)

---

## 1. Executive Overview

**SARATHI** is an AI-powered logistics visibility, multi-hazard risk assessment, and crisis decision-support system engineered specifically for disaster management authorities (NDRF, SDMA, ASDMA) and emergency supply fleets in the North-Eastern Region (NER) of India. 

During annual monsoon floods and landslides, critical supply arteries like **NH-715** (along the southern bank of the Brahmaputra) and **NH-27** experience severe breach, river overtopping, and mudslides. Traditional consumer navigation systems (Google Maps, Apple Maps) fail because they rely on historical traffic congestion rather than hydrological breach telemetry, resulting in relief trucks getting stranded in flood zones or delayed for critical days.

SARATHI solves this by marrying:
1. **Hydrological & Hazard Telemetry Ingestion** (real ASDMA flood bulletins, river gauges, landslide susceptibility).
2. **Machine Learning Hazard Risk Classifier** (`RandomForestClassifier` trained on historical Assam DRIMS disaster data).
3. **Dynamic Geofenced Corridor Scoping & Fleet Telemetry** (real-time truck GPS polling, automated stoppage within 15 km breach zones).
4. **Verified Citizen/Driver Hazard Ingestion** (strict 1.0 km GPS proximity verification + photo proof + admin triage portal).
5. **Interactive GIS Spatial War-Room** (Leaflet heatmaps, corridor risk banners, alternate rerouting via northern Brahmaputra bypass).
6. **Automated ASDMA Flood Bulletin PDF Generation** (one-click official reporting for civil administration).

---

## 2. System Architecture & Component Status

```
                 ┌────────────────────────────────────────────────────────┐
                 │                SARATHI FRONTEND (PORT 5173)            │
                 │   React 19 + Vite + Tailwind CSS v4 + Leaflet + Lucide │
                 │   Role-Based Dashboards (Admin War-Room vs Driver UI)  │
                 └───────────────────────────┬────────────────────────────┘
                                             │ REST API + Bearer JWT
                                             ▼
                 ┌────────────────────────────────────────────────────────┐
                 │                SARATHI BACKEND (PORT 5001)             │
                 │     Node.js + Express 5 + TypeScript + Prisma ORM      │
                 │  SQLite /dev.db (PostGIS compatible) + PDFKit + Crypto │
                 └──────────────┬──────────────────────────┬──────────────┘
                                │                          │
           HTTP /predict        ▼                          ▼ External APIs
┌──────────────────────────────────────────────┐   ┌───────────────────────────────┐
│     DISASTER-ML SIDECAR (PORT 8000)          │   │ - Google Routes API / OSRM    │
│  FastAPI + Python 3.12 + Scikit-Learn        │   │ - Open-Meteo & Weather API    │
│  RandomForest (300 trees, 10-feature schema) │   │ - ASDMA DRIMS Disaster Data   │
│  Transparent heuristic fallback engine       │   └───────────────────────────────┘
└──────────────────────────────────────────────┘
```

---

## 3. Comprehensive Feature Completion Matrix

| Component | Feature / Module | Status | Technical Details |
|---|---|:---:|---|
| **Auth & Security** | Role-Based Access Control (RBAC) | **100% COMPLETE** | Bcrypt password hashing, signed 8-hour JWTs (`ADMIN`, `DRIVER`), strict route guards, automatic profile hydration via `GET /api/auth/me`. |
| **Auth & Security** | Offline / Resilient Dev Bypass | **100% COMPLETE** | Client-side resilient session hydration ensures local testing never blocks if backend restarts. |
| **Live Map** | Interactive GIS Geospatial Engine | **100% COMPLETE** | React-Leaflet integration, 2-second live polling of vehicle telemetry (`GET /api/vehicles`), moving truck polylines, status color coding. |
| **Live Map** | Scenario Clock Replay | **100% COMPLETE** | One-click instant switching between: Onset (`2026-07-19`), Peak Crisis (`2026-07-28`), and Relief (`2026-08-09`). |
| **Live Map** | Dynamic Risk Heatmap Layer | **100% COMPLETE** | `leaflet.heat` multi-tier gradient layer (`LOW`: green, `MED`: yellow, `HIGH`: orange, `RED`: red) sampling 35-cell corridor grid. Zero ghost layers. |
| **Live Map** | Corridor Risk Banner & Alternate Bypass | **100% COMPLETE** | Computes hazard proximity; displays red blockage banner with automated diversion recommendation (e.g., via Tezpur / NH-15). |
| **Trips Management** | Full CRUD & Telemetry Correlation | **100% COMPLETE** | `GET`, `POST`, `PATCH`, `DELETE` on `/api/trips`. Real-time GPS coordinate matching, cargo type badges, driver assignment. |
| **Trips Management** | Driver-Level Scoping | **100% COMPLETE** | Logged-in drivers only see their assigned corridor, vehicle telemetry, and localized corridor threats. |
| **Alerts Engine** | Real-Time Threat Feed (`AlertsPage`) | **100% COMPLETE** | Connected to `GET /api/incidents?date=`. Filters by Severity (`RED`, `HIGH`, `MEDIUM`), Hazard Type (`Breach`, `Landslide`, `Overtop`, `Erosion`). |
| **Field Reports** | 1.0 km Geofenced Proximity Engine | **100% COMPLETE** | Mathematical Haversine verification preventing false or remote citizen reports. Rejects submissions $> 1.0\text{ km}$ from reported site. |
| **Field Reports** | Public Citizen & Driver Reporting | **100% COMPLETE** | Accessible from HomePage without login, or from ReportsPage. Image proof uploads with live client preview ($\le 5\text{MB}$). |
| **Field Reports** | Admin Triage & Decision Portal | **100% COMPLETE** | Admin review queue, photo proof lightbox viewer (`PhotoProofViewer`), one-click **[Approve & Broadcast]** or **[Reject / Dismiss]**. |
| **Simulation** | Interactive What-If Simulation Sandbox | **100% COMPLETE** | `SimulationPage.jsx` with scenario clock switcher, rainfall override slider, river danger level knobs, and mock GPS coordinate teleportation. |
| **Simulation** | 15 km Dynamic Danger Zone Halting | **100% COMPLETE** | Backend simulation loop dynamically freezes truck speed to 0 and flags status as `blocked` within 15 km of active `RED` breach zones. |
| **Analytics** | Corridor Risk & Weather Analytics | **100% COMPLETE** | `AnalyticsPage.jsx` comparing Guwahati → Golaghat, Guwahati → Sivasagar, and Guwahati → Nagaon corridors with real-time weather. |
| **Reporting** | Automated ASDMA Bulletin PDF Generator | **100% COMPLETE** | Dynamic PDF generation via PDFKit (`GET /api/bulletin.pdf?date=`), including district flood stats, river levels, and fleet status. |
| **Machine Learning** | Disaster Risk Model & Sidecar | **100% COMPLETE** | `RandomForestClassifier` (300 estimators, 10 features, balanced weights) on FastAPI sidecar (`:8000`) with transparent heuristic fallback. |

---

## 4. Key Endpoints & API Contract

| Endpoint | Method | Role | Description |
|---|:---:|:---:|---|
| `/api/auth/login` | POST | Public | Authenticates credentials; returns `{ token, user: { id, role, name } }`. |
| `/api/auth/me` | GET | Authenticated | Hydrates user profile and validates token. |
| `/api/vehicles` | GET | Authenticated | Live GPS coordinates, speed, heading, and status. Scoped automatically for Drivers. |
| `/api/incidents` | GET | Authenticated | Active hazard events for selected date. Scoped to trip corridor for Drivers. |
| `/api/incidents` | POST | Admin | Demonstrator road block injection. |
| `/api/trips` | GET | Authenticated | List all trips (Admin) or driver-assigned trips (Driver). |
| `/api/trips` | POST/PATCH/DELETE | Admin | Create, update status (`assigned`, `in_progress`, `completed`), or cancel trips. |
| `/api/reports` | GET | Authenticated | Fetch submitted field hazard reports (scoped to radius for drivers). |
| `/api/reports` | POST | Public/Driver | Ingest field incident report with photo upload & 1.0 km proximity validation. |
| `/api/reports/:id` | PATCH | Admin | Approve & broadcast report as active hazard or reject. |
| `/api/route/analyze` | POST | Authenticated | Corridor risk analysis, hazard proximity checks, and alternate diversion routes. |
| `/api/simulation/status` | GET | Authenticated | Returns current scenario date, active vehicle telemetry, and what-if overrides. |
| `/api/simulation/date` | POST | Admin | Advances or rewinds the scenario clock (`2026-07-19`, `2026-07-28`, `2026-08-09`). |
| `/api/simulation/scenario` | POST | Admin | Applies what-if parameters (`rainfall_mm`, `river_danger_level_count`). |
| `/api/bulletin.pdf` | GET | Authenticated | Streams compiled ASDMA flood and logistics situation report PDF. |

---

## 5. Seed Accounts for Demonstration

| User ID | Password | Role | Description / Permissions |
|---|---|:---:|---|
| `admin` | `sarathi@123` | **ADMIN** | Full command center access: all 8 tabs, Trip CRUD, Admin Triage, Simulation Sandbox, What-If knobs. |
| `AS-01-FOOD-04` | `driver123` | **DRIVER** | Food relief truck on Guwahati → Golaghat corridor. Restricted to Live Map, Alerts, and Reports. |
| `AS-02-MED-11` | `driver123` | **DRIVER** | Medical emergency truck on Guwahati → Sivasagar corridor. |
| `AS-03-FUEL-07` | `driver123` | **DRIVER** | Emergency fuel tanker on Guwahati → Nagaon corridor. |

---

## 6. How to Run the Complete Stack

```powershell
# In PowerShell at repository root:
.\dev.ps1
```
This automatically boots:
- Backend API on `http://localhost:5001`
- Frontend UI on `http://localhost:5173`
- Pre-flight environment check and health monitoring.
