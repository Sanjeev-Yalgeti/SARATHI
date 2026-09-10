"""Disaster-ML prediction sidecar (simulation-grade HTTP API).

Exposes the trained district-date RandomForest model to the Node backend
so simulation and risk assessment can use live ML predictions instead of
always degrading to the heuristic fallback.

Run:
    uvicorn serve:app --port 8000        # from backend/disaster-ml/

Endpoints:
    GET  /health    -> service + model status
    GET  /districts -> districts available per reporting date
    POST /predict   -> { district, date, overrides? } -> ML risk band

Design rules (PROJECT.md Data Integrity NFR, TEST_CASES.md TC-PEAK-006):
- The model only knows districts x dates present in training_dataset.csv.
  Unknown district/date -> 422, never a fabricated prediction.
- Overrides may only adjust known numeric features with finite,
  non-negative values; unknown keys -> 422.
"""

import os
import re
from functools import lru_cache
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from predict_risk import predict_risk
from train_risk_model import FEATURES, NUMERIC_FEATURES

HERE = Path(__file__).resolve().parent.parent  # backend/disaster-ml/
MODEL_PATH = Path(os.environ.get("MODEL_PATH", HERE / "models" / "risk_model.joblib"))
DATASET_PATH = Path(os.environ.get("DATASET_PATH", HERE / "data" / "training_dataset.csv"))

OVERRIDABLE = [f for f in NUMERIC_FEATURES if f in FEATURES]

app = FastAPI(title="SARATHI Disaster-ML Sidecar")


class PredictRequest(BaseModel):
    district: str = Field(..., min_length=1, description="Assam district name")
    date: str = Field(
        ..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Scenario date YYYY-MM-DD"
    )
    overrides: dict[str, float] = Field(
        default_factory=dict,
        description="What-if adjustments to numeric features "
        "(e.g. rainfall_mm, river_danger_level_count)",
    )


@lru_cache(maxsize=1)
def _dataset() -> pd.DataFrame:
    if not DATASET_PATH.exists():
        raise RuntimeError(f"Training dataset not found: {DATASET_PATH}")
    return pd.read_csv(DATASET_PATH)


def _base_row(district: str, date: str) -> tuple[dict, str]:
    """Base features for (district, date).

    Exact district-date row when present; otherwise the district's most
    recent row on/before the requested date (earliest available if the
    request predates all rows). The effective base date is returned so
    callers can see exactly what the prediction stands on — simulation
    transparency, not fabrication (TC-PEAK-006).
    """
    df = _dataset()
    available = sorted(df.loc[df["district"] == district, "date"].unique().tolist())
    if not available:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown district '{district}'. "
            "No prediction fabricated; see GET /districts.",
        )
    if date in available:
        base_date = date
    else:
        earlier = [day for day in available if day <= date]
        base_date = max(earlier) if earlier else available[0]
    row = df[(df["district"] == district) & (df["date"] == base_date)].iloc[0]
    features = {feature: float(row[feature]) for feature in FEATURES if feature != "district"}
    return features, base_date


def _validate_overrides(overrides: dict[str, float]) -> dict[str, float]:
    clean: dict[str, float] = {}
    for key, value in overrides.items():
        if key not in OVERRIDABLE:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown override '{key}'. Overridable: {', '.join(OVERRIDABLE)}.",
            )
        try:
            number = float(value)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=422, detail=f"Override '{key}' must be a number."
            )
        if number != number or number == float("inf") or number == float("-inf"):
            raise HTTPException(
                status_code=422, detail=f"Override '{key}' must be finite."
            )
        if number < 0:
            raise HTTPException(
                status_code=422, detail=f"Override '{key}' must be non-negative."
            )
        clean[key] = number
    return clean


@app.get("/health")
def health() -> dict:
    df = _dataset()
    return {
        "status": "ok",
        "model_path": str(MODEL_PATH),
        "model_loaded": MODEL_PATH.exists(),
        "dataset_rows": int(len(df)),
        "districts": int(df["district"].nunique()),
        "dates": sorted(df["date"].unique().tolist()),
    }


@app.get("/districts")
def districts(date: str | None = None) -> dict:
    df = _dataset()
    if date is not None:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
            raise HTTPException(status_code=422, detail="date must be YYYY-MM-DD")
        names = sorted(df.loc[df["date"] == date, "district"].unique().tolist())
        return {"date": date, "districts": names}
    return {
        "dates": {
            day: sorted(df.loc[df["date"] == day, "district"].unique().tolist())
            for day in sorted(df["date"].unique().tolist())
        }
    }


@app.post("/predict")
def predict(body: PredictRequest) -> dict:
    if not MODEL_PATH.exists():
        raise HTTPException(status_code=503, detail="Model artifact not found.")
    district = body.district.strip()
    features, base_date = _base_row(district, body.date)
    payload = {"district": district, **features}
    payload.update(_validate_overrides(body.overrides))
    result = predict_risk(MODEL_PATH, payload)
    return {
        **result,
        "district": district,
        "date": body.date,
        "base_date": base_date,
        "source": "ml",
    }
