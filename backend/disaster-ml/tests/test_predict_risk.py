"""Unit tests for src/predict_risk.py.

PROJECT.md: FR-03 (alerts consume risk_level), FR-10 (score output),
FR-06 (controller calls predict_risk).
TEST_CASES.md: TC-ML-002 (missing fields → safe defaults), TC-ML-005
(artifact loads), TC-ML-006 (corrupt artifact → controlled error).
"""

import joblib
import pandas as pd
import pytest

from predict_risk import DEFAULT_VALUES, load_model, predict_risk, prepare_input
from train_risk_model import FEATURES


# ------------------------------------------------------------------
# load_model — TC-ML-005 / TC-ML-006
# ------------------------------------------------------------------

def test_load_model_missing_file_raises_filenotfound(tmp_path):
    with pytest.raises(FileNotFoundError, match="Model file not found"):
        load_model(tmp_path / "no-model.joblib")


def test_load_model_rejects_artifact_without_pipeline(tmp_path):
    bad = tmp_path / "bad.joblib"
    joblib.dump({"features": FEATURES}, bad)
    with pytest.raises(ValueError, match="'pipeline' was not found"):
        load_model(bad)


def test_load_model_rejects_artifact_without_features(tmp_path):
    from train_risk_model import build_model, build_preprocessor
    from sklearn.pipeline import Pipeline

    bad = tmp_path / "bad.joblib"
    joblib.dump(
        {
            "pipeline": Pipeline(
                [("preprocessor", build_preprocessor()), ("model", build_model())]
            )
        },
        bad,
    )
    with pytest.raises(ValueError, match="'features' was not found"):
        load_model(bad)


@pytest.mark.realdata
def test_load_model_real_artifact_has_expected_keys(model_path):
    artifact = load_model(model_path)
    assert artifact["features"] == FEATURES
    assert set(artifact["classes"]) == {"LOW", "MODERATE", "HIGH", "CRITICAL"}
    assert artifact["training_records"] == 84


# ------------------------------------------------------------------
# prepare_input — TC-ML-002
# ------------------------------------------------------------------

def test_prepare_input_uses_payload_and_preserves_feature_order():
    payload = {"district": "Golaghat", "population_affected": 4445}
    df = prepare_input(FEATURES, payload)
    assert list(df.columns) == FEATURES
    assert df.loc[0, "district"] == "Golaghat"
    assert df.loc[0, "population_affected"] == 4445


def test_prepare_input_missing_fields_fall_back_to_defaults():
    df = prepare_input(FEATURES, {})
    assert df.loc[0, "district"] == DEFAULT_VALUES["district"]
    for feature in FEATURES:
        if feature != "district":
            assert df.loc[0, feature] == 0


def test_prepare_input_returns_single_row_frame():
    assert isinstance(prepare_input(FEATURES, {}), pd.DataFrame)
    assert len(prepare_input(FEATURES, {})) == 1


# ------------------------------------------------------------------
# predict_risk — FR-10 / FR-03
# ------------------------------------------------------------------

@pytest.mark.realdata
def test_predict_risk_schema_and_probability_mass(model_path, zero_payload):
    result = predict_risk(model_path, zero_payload)
    assert set(result) == {
        "risk_level",
        "confidence",
        "confidence_percentage",
        "probabilities",
    }
    assert result["risk_level"] in {"LOW", "MODERATE", "HIGH", "CRITICAL"}
    assert 0.0 <= result["confidence"] <= 1.0
    assert result["confidence_percentage"] == pytest.approx(
        result["confidence"] * 100, abs=0.01
    )
    total = sum(result["probabilities"].values())
    assert total == pytest.approx(1.0, abs=1e-4)
    assert result["probabilities"][result["risk_level"]] == pytest.approx(
        result["confidence"], abs=1e-6
    )


@pytest.mark.realdata
def test_predict_risk_is_deterministic(model_path, severe_payload):
    first = predict_risk(model_path, severe_payload)
    second = predict_risk(model_path, severe_payload)
    assert first == second


@pytest.mark.realdata
def test_predict_risk_severe_input_scores_at_least_as_high_as_zero(
    model_path, zero_payload, severe_payload
):
    # Ordinal check on the documented severity order, robust to any single
    # fitted forest: the peak-period payload must not be ranked *lower*.
    order = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "CRITICAL": 3}
    calm = predict_risk(model_path, zero_payload)["risk_level"]
    severe = predict_risk(model_path, severe_payload)["risk_level"]
    assert order[severe] >= order[calm]


@pytest.mark.realdata
def test_predict_risk_unknown_district_does_not_crash(model_path, zero_payload):
    payload = dict(zero_payload, district="Atlantis")
    result = predict_risk(model_path, payload)
    assert result["risk_level"] in {"LOW", "MODERATE", "HIGH", "CRITICAL"}


@pytest.mark.realdata
def test_predict_risk_readme_example_payload(model_path):
    # Exact payload shape from disaster-ml/README.md "Prediction" section.
    result = predict_risk(
        model_path,
        {
            "affected_villages": 25,
            "population_affected": 5000,
            "crop_area_affected_ha": 120,
            "rainfall_mm": 80,
            "historical_hazard_score": 0.8,
            "landslide_area_ha": 0.0,
            "roads_damaged": 2,
            "houses_damaged": 5,
        },
    )
    assert result["risk_level"] in {"LOW", "MODERATE", "HIGH", "CRITICAL"}
