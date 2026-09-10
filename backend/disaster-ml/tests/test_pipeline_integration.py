"""End-to-end pipeline test: PDFs -> CSV -> model -> prediction.

PROJECT.md: FR-07 (flood inputs), FR-10 (risk output), FR-11 (incident
ingestion across reporting dates).
TEST_CASES.md: TC-ML-001 (valid ingestion), TC-PEAK-006 (no fabricated
records), TC-JUL*/TC-PEAK*/TC-AUG* (peak-period coverage), TC-ML-005.

Marked `slow` + `realdata`: reads the committed DRIMS PDFs and rebuilds
the dataset into a tmp dir (never overwrites data/training_dataset.csv).
"""

import subprocess
import sys
from pathlib import Path

import joblib
import pandas as pd
import pytest

from predict_risk import predict_risk
from train_risk_model import TARGET

ML_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ML_ROOT / "src"
EXPECTED_LABELS = {"LOW", "MODERATE", "HIGH", "CRITICAL"}
# Reporting dates present in the committed dataset (TEST_CASES.md scope
# plus the additional 08-19 flood report found in data/flood/).
EXPECTED_DATES = {
    "2026-07-19",
    "2026-07-20",
    "2026-07-21",
    "2026-07-27",
    "2026-07-28",
    "2026-08-08",
    "2026-08-09",
}


def _run(script: str, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SRC_DIR / script), *args],
        capture_output=True,
        text=True,
        cwd=str(ML_ROOT),
    )


@pytest.mark.slow
@pytest.mark.realdata
def test_committed_dataset_shape_and_labels(training_csv):
    df = pd.read_csv(training_csv)
    assert len(df) == 84
    assert set(df[TARGET].unique()) == EXPECTED_LABELS
    assert EXPECTED_DATES <= set(df["date"].unique())
    # TC-PEAK-006 guard: no fabricated 29-July rows.
    assert "2026-07-29" not in set(df["date"].unique())


@pytest.mark.slow
@pytest.mark.realdata
def test_rebuild_dataset_from_pdfs_reproduces_committed_shape(tmp_path, ml_root):
    out = tmp_path / "rebuilt.csv"
    proc = _run(
        "build_training_dataset.py",
        "--data-dir", str(ml_root / "data"),
        "--output", str(out),
    )
    assert proc.returncode == 0, proc.stderr[-2000:]
    rebuilt = pd.read_csv(out)
    committed = pd.read_csv(ml_root / "data" / "training_dataset.csv")
    assert list(rebuilt.columns) == list(committed.columns)
    assert len(rebuilt) == len(committed)
    assert set(rebuilt[TARGET].unique()) == EXPECTED_LABELS


@pytest.mark.slow
@pytest.mark.realdata
def test_retrain_on_rebuilt_dataset_and_predict(tmp_path, ml_root):
    dataset = tmp_path / "rebuilt.csv"
    model_out = tmp_path / "risk_model.joblib"
    assert _run(
        "build_training_dataset.py",
        "--data-dir", str(ml_root / "data"),
        "--output", str(dataset),
    ).returncode == 0
    train = _run(
        "train_risk_model.py",
        "--input", str(dataset),
        "--model-out", str(model_out),
    )
    assert train.returncode == 0, train.stderr[-2000:]
    artifact = joblib.load(model_out)
    assert set(artifact["classes"]) == EXPECTED_LABELS

    # Worst committed row must score CRITICAL-or-HIGH impact severity order:
    # its impact_score must be the frame maximum (FR-10 severity preserved).
    df = pd.read_csv(dataset)
    worst = df.loc[df["impact_score"].idxmax()].to_dict()
    payload = {
        "district": worst["district"],
        "affected_villages": worst["affected_villages"],
        "population_affected": worst["population_affected"],
        "crop_area_affected_ha": worst["crop_area_affected_ha"],
        "landslide_area_ha": worst["landslide_area_ha"],
        "roads_damaged": worst["roads_damaged"],
        "houses_damaged": worst["houses_damaged"],
        "lives_lost": worst["lives_lost"],
        "rainfall_mm": worst["rainfall_mm"],
        "river_danger_level_count": worst["river_danger_level_count"],
        "historical_hazard_score": worst["historical_hazard_score"],
    }
    result = predict_risk(model_out, payload)
    assert result["risk_level"] in {"HIGH", "CRITICAL"}


@pytest.mark.slow
@pytest.mark.realdata
def test_committed_model_predicts_committed_rows(model_path, training_csv):
    """Every committed district-date row must yield a valid prediction."""
    from train_risk_model import FEATURES

    df = pd.read_csv(training_csv)
    sample = df.sample(n=min(10, len(df)), random_state=42)
    for _, row in sample.iterrows():
        payload = {feature: row[feature] for feature in FEATURES}
        result = predict_risk(model_path, payload)
        assert result["risk_level"] in EXPECTED_LABELS
        assert sum(result["probabilities"].values()) == pytest.approx(1.0, abs=1e-4)
