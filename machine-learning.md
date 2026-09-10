# SARATHI — Machine Learning Specification (`machine-learning.md`)

> How the disaster-risk ML model works with the backend (Node/Express) and frontend (React + Leaflet).
> Companion docs: `backend/PROJECT.md` (system requirements), `FRONTEND_HANDOFF.md` (API contract),
> `TEST_CASES.md` (dataset-driven validation), `backend/disaster-ml/README.md` (ML runbook).

---

## 1. Overview

SARATHI predicts **district × date disaster risk** (`LOW | MODERATE | HIGH | CRITICAL`) from Assam DRIMS
daily flood/landslide reports + weather + historical hazard context, and turns it into:

1. **Risk scores/levels** on the map and alerts (`LOW | MEDIUM | HIGH | RED`).
2. **Truck motion decisions** in the 2 s simulation loop (go / slow / block).
3. **Route analysis** (`POST /api/route/analyze`) — risk + recommended road + alternate route.

Design principle: **ML-first with transparent heuristic fallback. Never fabricate a prediction.**
Unknown district/date → `422`, never a guessed band (TEST_CASES `TC-PEAK-006`).

```
DRIMS PDFs + GeoJSON + Weather API
        │
        ▼
Feature Engineering (district-date table)
        │
        ▼
RandomForest Risk Model (.joblib)
        │
        ▼
FastAPI Sidecar :8000 ──HTTP──▶ Express Backend :5001 ──REST──▶ React + Leaflet :5173
  /health /districts        ml-client / ml-district /        LiveMap / Alerts /
  /predict                  risk.service / simulation.service  Analytics / Simulation
```

---

## 2. Model definition

| Item | Value |
|---|---|
| Location | `backend/disaster-ml/` |
| Type | `RandomForestClassifier` (`src/train_risk_model.py:build_model`) |
| Hyperparameters | `n_estimators=300, max_depth=10, min_samples_split=2, min_samples_leaf=1, class_weight="balanced", random_state=42, n_jobs=-1` |
| Artifact | `backend/disaster-ml/models/risk_model.joblib` (joblib dict: `pipeline, features, numeric_features, categorical_features, target, classes, training_records, training_class_distribution, evaluation, model_type, trained_at`) |
| Classes (ML) | `LOW, MODERATE, HIGH, CRITICAL` |
| Classes (backend/UI) | `LOW, MEDIUM, HIGH, RED` (mapping in §5) |
| Training script | `python src/build_training_dataset.py --data-dir <pdfs> --output data/training_dataset.csv` then `python src/train_risk_model.py --input data/training_dataset.csv --model-out models/risk_model.joblib` |
| Deps | `pandas, numpy, scikit-learn, joblib, pypdf, fastapi, uvicorn, pytest` (see `requirements.txt`) |

### 2.1 Feature schema (frozen — schema mismatch must fail closed)

Numeric (`NUMERIC_FEATURES`, median-imputed, clipped at ≥ 0):

`affected_villages, population_affected, crop_area_affected_ha, landslide_area_ha, roads_damaged, houses_damaged, lives_lost, rainfall_mm, river_danger_level_count, historical_hazard_score`

Categorical (most-frequent-imputed + `OneHotEncoder(handle_unknown="ignore")`):

`district` (Assam districts, normalized via `src/common.py:norm_district`; e.g. `Kamrup (M)` → `Kamrup Metropolitan`)

Target: `risk_label` (upper-cased, stripped; `"" / NAN / NONE / NULL` rows dropped).

Inference defaults for missing keys (`src/predict_risk.py:DEFAULT_VALUES`): numeric → `0`, district → `"Unknown"`.
Any missing/extra/m mistyped feature at the API boundary → validation error, never a silent prediction (`TC-ML-006`).

### 2.2 Training pipeline

1. `validate_dataset` — all `FEATURES + [risk_label]` present, ≥ 2 rows, else hard error.
2. `clean_dataset` — normalize labels, clip negatives to 0, coerce numerics, drop all-NaN feature rows.
3. `build_preprocessor` — `ColumnTransformer`: numeric median-impute; categorical most-frequent + one-hot.
4. `train_and_evaluate` — stratified `train_test_split` **only if** `n ≥ 20`, `≥ 2` classes, every class `≥ 2` samples (else train on full data and log `LIMITED DATASET`); test size `clamp(0.25–0.40)` sized to fit one sample per class; prints accuracy, classification report, confusion matrix; **refits final model on the full dataset** before saving.
5. Saved package includes class distribution, evaluation block, and `trained_at`.

### 2.3 Known limitation (must be stated in UI/teacher script)

Supplied PDFs cover only a handful of dates (19–21 Jul, 27–28 Jul, 08–09 Aug 2026). That is enough to
demonstrate the full pipeline but **not** enough for a statistically reliable production forecaster.
Prototype mitigations: add flood-hazard GeoJSON/hazard-atlas spatial features + live rainfall/river-level
features, restrict to 1–2 districts while collecting more daily observations.

---

## 3. Prediction sidecar (Python ↔ backend boundary)

Run from `backend/disaster-ml/src/`: `uvicorn serve:app --port 8000`. Config via `MODEL_PATH`, `DATASET_PATH`
(defaults: `../models/risk_model.joblib`, `../data/training_dataset.csv`).

| Endpoint | Contract |
|---|---|
| `GET /health` | `{ status, model_path, model_loaded, dataset_rows, districts, dates }` — backend readiness probe |
| `GET /districts[?date=YYYY-MM-DD]` | Districts the model actually knows, per date. Bad date → `422` |
| `POST /predict` | Body `{ district, date: YYYY-MM-DD, overrides?: { rainfall_mm?, river_danger_level_count?, … } }` → `{ risk_level, confidence, confidence_percentage, probabilities, district, date, base_date, source: "ml" }`. Unknown district or override key, non-numeric / NaN / Inf / negative override, missing artifact → `422` / `503`. Never synthesizes a district |

Base-row rule (`serve.py:_base_row`): exact `(district, date)` row if present, else the district's most
recent row **on/before** the requested date (earliest row if request predates all data). Effective date is
always returned as `base_date` so callers show what the prediction stands on.

---

## 4. Backend integration (Node/Express)

Env: `ML_URL=http://localhost:8000` (`backend/.env.example`). All sidecar calls time out fast and degrade silently.

| Module | Responsibility |
|---|---|
| `src/services/ml-district.ts` | `nearestDistrict(lat,lng)` — nearest of 5 corridor centroids (Kamrup Metropolitan, Nagaon, Golaghat, Jorhat, Sivasagar). Explicit coarse approximation, **not** a GIS lookup; upgrade path = point-in-polygon over versioned GeoJSON without touching callers. `mlBandToScore` maps ML band → score/level; `isMlBand` validates sidecar output |
| `src/services/ml-client.ts` | `askMl({lat,lng,eventDate,rainfall_mm?,river_danger_level_count?}, rainfall)` — resolves district, `POST ML_URL/predict` with 4.5 s timeout. Returns `{ band, confidence, district, baseDate }` or `null` (unreachable/invalid → caller falls back) |
| `src/services/risk.service.ts` | `predictRisk({lat,lng,eventDate,…})` — **ML-first**: weather + same-date incidents (35 km) + `askMl`. ML hit → mapped score/probability + reason citing district/date/band/confidence. ML miss → heuristic `0.5·rain + 0.3·roadCut + 0.2·floodZone` fallback with reason. Close incidents clamp `prob ≥ 0.85 / score ≥ 85`. Persists to `RiskCache` upsert keyed `(lat,lng,eventDate)` |
| `src/services/simulation.service.ts` | 2 s tick loop: `assessTruckMl(vehicleId,lat,lng)` per truck (ML answers cached per `district+date+overrides`), `mlMotionFor(band)`: `CRITICAL → block`, `HIGH → slow (20 km/h)`, else `go (40 km/h)`. RED-incident 15 km hard-block applies independently. `POST /api/simulation/scenario` sets date + what-if overrides (→ sidecar overrides), clears caches, unblocks trucks |

Band → score/level mapping (`ml-district.ts:BAND_SCORES`, display thresholds `risk.level.ts:levelFor`):

| ML band | Score | UI level |
|---|---|---|
| `CRITICAL` | 85 | `RED` (≥ 75) |
| `HIGH` | 65 | `HIGH` (≥ 55) |
| `MODERATE` | 40 | `MEDIUM` (≥ 30) |
| `LOW` | 15 | `LOW` (< 30) |

Backend REST surface that carries ML results: `GET /api/risk?lat=&lng=&date=` (currently public for
dashboard fallback), `POST /api/route/analyze` (`{ risk{landslide_prob,score,level,reasons}, blocked, … }`),
`GET /api/simulation/status` (per-truck ML state), `GET /api/routes`, `GET /api/weather`.

---

## 5. Frontend integration (React + Leaflet)

- `LiveMap.jsx` (props: `token, date, apiUrl, pollMs=2000, …`): polls `GET /api/vehicles` every 2 s
  (green moving / red blocked), pins `GET /api/incidents?date=`, shows RED banner from
  `POST /api/route/analyze`. No other component touches the map.
- **Alerts page**: `level/score/reasons` from risk + route/analyze; RED banner + alternate-road label.
- **Analytics page**: risk distribution, `confidence`, `probabilities`, `source` (`ml` vs `heuristic`),
  `district`/`baseDate` transparency line.
- **Simulation page** (admin): scenario date switch + what-if knobs (`rainfall_mm`,
  `river_danger_level_count`) → `POST /api/simulation/scenario`; per-truck ML state display.
- Driver views (Live Map / Alerts / Reports) show only the driver's corridor district assessment
  (server-side JWT scoping; frontend only hides tabs).
- Frontend **must** surface: band/level chip, score, confidence %, `source`, and `base_date` when the
  prediction is a fallback row — never present heuristic output as an ML prediction.

---

## 6. Requirements

### 6.1 Functional (ML)

- `ML-FR-01` Ingest valid DRIMS flood/landslide records (date, district, hazard type, location, attributes) into a consistent district-date table; report malformed rows instead of corrupting data (`TC-ML-001`).
- `ML-FR-02` Handle missing optional fields via documented rule (median-impute numeric / most-frequent categorical / `DEFAULT_VALUES` at inference) and return a valid prediction or controlled insufficient-data state (`TC-ML-002`).
- `ML-FR-03` Reject/flag invalid coordinates before GIS/route use; never plot them (`TC-ML-003`).
- `ML-FR-04` Deduplicate same incident/location/timestamp so re-ingest can't double-alert or double-block (`TC-ML-004`).
- `ML-FR-05` Load the versioned `.joblib` artifact at serve time and accept exactly the frozen feature schema (`TC-ML-005`).
- `ML-FR-06` Fail closed on schema mismatch (missing/extra/mistyped features, unknown override keys) with `422/503`; never return a misleading prediction (`TC-ML-006`).
- `ML-FR-07` Serve `GET /health`, `GET /districts`, `POST /predict` with `base_date` transparency; sparse dates fall back to the district's most recent earlier row.
- `ML-FR-08` Backend maps every truck `(lat,lng)` to its corridor district and converts ML band → score/level for risk, routing, alerts, and the simulation tick.
- `ML-FR-09` Simulation applies `CRITICAL=block / HIGH=slow / else go`, caches ML answers per district+date+knobs, and degrades to the heuristic without stalling the tick.
- `ML-FR-10` Risk endpoint blends ML band + live rainfall + 35 km incident proximity and persists the result to `RiskCache`.
- `ML-FR-11` Frontend visualizes band, score, confidence, source, and base date; what-if overrides round-trip from Simulation page → sidecar → truck motion.

### 6.2 Non-functional / performance targets

| Category | Requirement |
|---|---|
| Inference latency | Sidecar `POST /predict` **p95 < 500 ms** local; backend `askMl` timeout **4.5 s** then fallback — a down sidecar must never break risk/route/simulation |
| Simulation cadence | Tick every **2 s**; ML answers cached per district+date+knobs so `:8000` is hit **≤ #districts per scenario change**, never per truck per tick |
| Map responsiveness | Vehicle poll 2 s, Leaflet interactions stay < 100 ms frame budget; risk banner updates on next poll after scenario change |
| Throughput | Sidecar ≥ 20 `POST /predict` rps on a laptop; backend risk cache upsert per unique `(lat,lng,date)` avoids recompute |
| Accuracy (prototype gate) | When evaluation is possible (≥ 20 rows, ≥ 2 samples/class): stratified hold-out **accuracy ≥ 0.70**, macro-F1 reported; otherwise training logs `LIMITED DATASET` and ships with the heuristic-fallback disclosure (§2.3). Final thresholds to be calibrated per TEST_CASES validation rule |
| Availability | ML is advisory: backend serves heuristic risk + RED-incident hard-block with sidecar down; `/health` exposes `model_loaded` for ops |
| Data integrity | Real-data-only incidents; mitigation/response records never erase hazard state (`TC-PEAK-005`, `TC-AUG08-001`); missing source dates (e.g. 29 Jul 2026) reported, never fabricated (`TC-PEAK-006`) |
| Security | `ML_URL` server-side only; sidecar binds localhost in prototype, JWT + RBAC enforced at Express layer; no secrets in frontend bundle |
| Reproducibility | `random_state=42`, versioned dataset CSV + `.joblib` with `trained_at`, class distribution, and evaluation block; `pytest` (`slow`, `realdata` marks) green before retrain ships |
| Maintainability | `ml-district` centroid table replaceable by GeoJSON point-in-polygon; preprocessor/model hyperparams isolated in `train_risk_model.py` |

---

## 7. Failure modes (backend ↔ frontend contract)

| Condition | Backend does | Frontend shows |
|---|---|---|
| Sidecar down / timeout / bad payload | Heuristic risk, `source: "heuristic"`, tick continues | Risk card with "offline model" note + rainfall reason; no confidence % |
| Unknown district | `422` from sidecar → `askMl` returns `null` → heuristic | "No ML coverage for this district" — empty, not guessed |
| Sparse date | `base_date` ≠ requested date, `source: "ml"` | "Assessment based on {base_date} district data" |
| Invalid coords / payload | `400/422 { error }` | Inline validation error; nothing plotted |
| Missing artifact | `503 Model artifact not found` | Ops alert via `GET /health`; user-facing heuristic continues |

---

## 8. Run & verify (owner quick reference)

```bash
# train
cd backend/disaster-ml
pip install -r requirements.txt
python src/build_training_dataset.py --data-dir <pdf-folder> --output data/training_dataset.csv
python src/train_risk_model.py --input data/training_dataset.csv --model-out models/risk_model.joblib
pytest  # honors pytest.ini (slow / realdata marks)

# serve sidecar (from backend/disaster-ml/src/)
uvicorn serve:app --port 8000
curl localhost:8000/health

# backend (needs ML_URL=http://localhost:8000 in backend/.env)
cd backend && npm run dev   # :5001
# frontend
cd frontend && npm run dev -- --port 5173
```

Golden-path check: scenario date `2026-07-28` → trucks ML/HIGH-CRITICAL affected, RED banner + alternate
road in LiveMap; `2026-07-19` → honest empty; `2026-08-09` → relief baseline.

---

## 9. Out of scope / next steps

PostGIS point-in-polygon district lookup, socket.io push (`vehicle:update`, `alert:risk`), river-gauge +
forecast feature ingestion, per-district calibration + fixed score thresholds, model registry/versioned
promotion, drift monitoring, mobile push/SMS alerts. (See `PROJECT.md` §13.)
