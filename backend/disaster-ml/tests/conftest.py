"""Shared fixtures for the disaster-ml test suite.

Covers PROJECT.md data-integrity expectations and the TEST_CASES.md
TC-ML-001/TC-ML-002 data-quality handling rules: valid records are
retained, malformed records must never silently corrupt the dataset.
"""

import sys
from pathlib import Path

import pytest

# The ML sources live in ../src and use top-level imports
# (``from common import ...``), so expose that directory.
SRC_DIR = Path(__file__).resolve().parents[1] / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

ML_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ML_ROOT / "data"
FLOOD_DIR = DATA_DIR / "flood"
LANDSLIDE_DIR = DATA_DIR / "landslide"
TRAINING_CSV = DATA_DIR / "training_dataset.csv"
MODEL_PATH = ML_ROOT / "models" / "risk_model.joblib"


@pytest.fixture(scope="session")
def ml_root() -> Path:
    return ML_ROOT


@pytest.fixture(scope="session")
def training_csv() -> Path:
    return TRAINING_CSV


@pytest.fixture(scope="session")
def model_path() -> Path:
    return MODEL_PATH


@pytest.fixture()
def zero_payload() -> dict:
    """Baseline 'no impact observed' payload (TC-ML-002 style)."""
    return {
        "district": "Cachar",
        "affected_villages": 0,
        "population_affected": 0,
        "crop_area_affected_ha": 0,
        "landslide_area_ha": 0,
        "roads_damaged": 0,
        "houses_damaged": 0,
        "lives_lost": 0,
        "rainfall_mm": 0,
        "river_danger_level_count": 0,
        "historical_hazard_score": 0,
    }


@pytest.fixture()
def severe_payload() -> dict:
    """High-impact payload mirroring a peak-period flood row."""
    return {
        "district": "Sivasagar",
        "affected_villages": 189,
        "population_affected": 157727,
        "crop_area_affected_ha": 9179.42,
        "landslide_area_ha": 0.0,
        "roads_damaged": 3,
        "houses_damaged": 10,
        "lives_lost": 1,
        "rainfall_mm": 120,
        "river_danger_level_count": 2,
        "historical_hazard_score": 0.9,
    }
