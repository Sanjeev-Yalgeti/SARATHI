# SIH Disaster Logistics Intelligence - ML Module

This package implements the ML layer for the Logistics Intelligence Platform.

## What it does

1. Reads DRIMS daily Flood and Landslide PDF reports.
2. Converts reports into a district-date training table.
3. Builds an impact/risk label from observed disaster outcomes.
4. Trains a RandomForest model for:
   - LOW risk
   - MODERATE risk
   - HIGH risk
   - CRITICAL risk
5. Saves the trained model as `models/disaster_risk_model.joblib`.
6. Provides a prediction function that can be called by a Node/Express backend.

## Important scientific limitation

The supplied daily PDFs are only a small number of reporting dates. They are enough to build and demonstrate the complete ML pipeline, but they are not enough for a statistically reliable production forecasting model.

For the hackathon prototype:
- Use the supplied PDFs to demonstrate real data ingestion.
- Use the historical flood hazard GeoJSON / hazard atlas as additional spatial features.
- Add weather features (rainfall, river level, forecast) for a true predictive model.
- Initially restrict the model to 1-2 districts and collect more daily observations.

## Recommended project flow

PDF / GeoJSON / Weather
        |
        v
Feature Engineering
        |
        v
Risk Model
        |
        +--> Risk Probability
        +--> Risk Class
        +--> Feature Importance
        |
        v
Node.js / Express API
        |
        v
React + Leaflet Dashboard

## Run

```bash
pip install -r requirements.txt

python src/build_training_dataset.py \
  --data-dir /path/to/pdf/folder \
  --output data/training_dataset.csv

python src/train_risk_model.py \
  --input data/training_dataset.csv \
  --model-out models/disaster_risk_model.joblib
```

If the PDF parser misses a district-specific row, inspect `training_dataset.csv` and correct the parser rules. Government PDF table extraction is often inconsistent across report dates.

## Prediction

```python
from predict_risk import predict_risk

result = predict_risk(
    "models/disaster_risk_model.joblib",
    {
        "affected_villages": 25,
        "population_affected": 5000,
        "crop_area_affected_ha": 120,
        "rainfall_mm": 80,
        "historical_hazard_score": 0.8,
        "landslide_area_ha": 0.0,
        "roads_damaged": 2,
        "houses_damaged": 5
    }
)
print(result)
```

## Simulation sidecar (used by the Node backend)

The Express backend and the 2s simulation loop call the model over HTTP
instead of shelling out to Python per tick:

```bash
pip install -r requirements.txt
uvicorn serve:app --port 8000        # run from backend/disaster-ml/src/
```

- `GET /health` — model + dataset status.
- `GET /districts[?date=YYYY-MM-DD]` — districts the model knows.
- `POST /predict { district, date, overrides? }` — base district-date row
  from `training_dataset.csv` plus what-if overrides
  (`rainfall_mm`, `river_danger_level_count`, …). Sparse dates fall back
  to the district's most recent earlier row and report `base_date`;
  unknown districts/keys are 422, never fabricated.

Backend wiring (`ML_URL=http://localhost:8000`, see `backend/.env.example`):

- `src/services/ml-client.ts` — sidecar HTTP client.
- `src/services/ml-district.ts` — truck (lat,lng) → corridor district,
  ML band → score/level.
- `src/services/risk.service.ts` — ML-first `predictRisk` with heuristic
  fallback when the sidecar is down.
- `src/services/simulation.service.ts` — tick blocks trucks on CRITICAL,
  slows them on HIGH; `POST /api/simulation/scenario` drives what-if runs.
