"""Unit tests for src/train_risk_model.py.

PROJECT.md: FR-10 (weighted risk → classified risk), FR-06 (controller
consumes a validated model artifact), Data Integrity NFR.
TEST_CASES.md: TC-ML-005 (artifact availability), TC-ML-006 (schema
mismatch), TC-ML-002 (missing optional fields via median imputation).
"""

import pandas as pd
import pytest

from train_risk_model import (
    CATEGORICAL_FEATURES,
    FEATURES,
    NUMERIC_FEATURES,
    TARGET,
    build_model,
    build_preprocessor,
    can_stratify,
    clean_dataset,
    train_and_evaluate,
    validate_dataset,
)


def _row(district="Cachar", label="LOW", **numeric):
    base = {feature: 0.0 for feature in NUMERIC_FEATURES}
    base.update(numeric)
    base["district"] = district
    base[TARGET] = label
    return base


def _balanced_frame(n_per_class=8):
    rows = []
    for i, label in enumerate(["LOW", "MODERATE", "HIGH", "CRITICAL"]):
        for j in range(n_per_class):
            rows.append(
                _row(
                    district=f"D{i}",
                    label=label,
                    population_affected=float(i * 10000 + j * 100),
                    crop_area_affected_ha=float(i * 500 + j),
                )
            )
    return pd.DataFrame(rows)


# ------------------------------------------------------------------
# validate_dataset — TC-ML-006
# ------------------------------------------------------------------

def test_validate_dataset_accepts_good_frame():
    validate_dataset(_balanced_frame(n_per_class=2))


def test_validate_dataset_rejects_missing_columns():
    df = _balanced_frame(n_per_class=2).drop(columns=["rainfall_mm", TARGET])
    with pytest.raises(ValueError, match="missing required columns"):
        validate_dataset(df)


def test_validate_dataset_rejects_empty():
    df = _balanced_frame(n_per_class=2).iloc[0:0]
    with pytest.raises(ValueError, match="empty"):
        validate_dataset(df)


def test_validate_dataset_rejects_single_row():
    df = _balanced_frame(n_per_class=2).iloc[0:1]
    with pytest.raises(ValueError, match="At least 2 rows"):
        validate_dataset(df)


# ------------------------------------------------------------------
# clean_dataset — TC-ML-001 / TC-ML-002
# ------------------------------------------------------------------

def test_clean_dataset_normalises_labels_and_clips_negatives():
    df = pd.DataFrame(
        [
            _row(label=" low ", population_affected=10),
            _row(label="CRITICAL", population_affected=-50, houses_damaged=-3),
        ]
    )
    cleaned = clean_dataset(df)
    assert set(cleaned[TARGET]) == {"LOW", "CRITICAL"}
    assert (cleaned[NUMERIC_FEATURES] >= 0).all().all()


def test_clean_dataset_drops_invalid_labels():
    df = pd.DataFrame(
        [_row(label="LOW"), _row(label="none"), _row(label="NULL"), _row(label="")]
    )
    cleaned = clean_dataset(df)
    assert list(cleaned[TARGET]) == ["LOW"]


def test_clean_dataset_rejects_all_invalid_labels():
    df = pd.DataFrame([_row(label="none"), _row(label="")])
    with pytest.raises(ValueError, match="No valid risk labels"):
        clean_dataset(df)


def test_clean_dataset_coerces_bad_numerics():
    df = pd.DataFrame(
        [_row(label="LOW"), _row(label="HIGH", population_affected="not-a-number")]
    )
    cleaned = clean_dataset(df)
    # Row survives with NaN (median-imputed later); nothing is fabricated.
    assert len(cleaned) == 2


def test_clean_dataset_single_class_survives_cleaning():
    # Single-class is a *training* error, not a cleaning error.
    df = pd.DataFrame([_row(label="LOW"), _row(label="LOW")])
    assert len(clean_dataset(df)) == 2


# ------------------------------------------------------------------
# can_stratify
# ------------------------------------------------------------------

def test_can_stratify_true_for_balanced_multiclass():
    assert can_stratify(_balanced_frame(n_per_class=3)[TARGET]) is True


def test_can_stratify_false_for_single_class():
    assert can_stratify(pd.Series(["LOW", "LOW", "LOW"])) is False


def test_can_stratify_false_for_singleton_class():
    assert can_stratify(pd.Series(["LOW", "LOW", "HIGH"])) is False


# ------------------------------------------------------------------
# Pipeline construction
# ------------------------------------------------------------------

def test_feature_lists_cover_expected_schema():
    assert "district" in CATEGORICAL_FEATURES
    assert TARGET == "risk_label"
    assert set(FEATURES) == set(NUMERIC_FEATURES) | set(CATEGORICAL_FEATURES)
    assert len(FEATURES) == 11


def test_build_preprocessor_handles_unknown_district_and_nan():
    preprocessor = build_preprocessor()
    frame = pd.DataFrame(
        [
            {**{f: 1.0 for f in NUMERIC_FEATURES}, "district": "NeverSeenDistrict"},
            {**{f: float("nan") for f in NUMERIC_FEATURES}, "district": "Cachar"},
        ]
    )
    transformed = preprocessor.fit_transform(frame)
    assert transformed.shape[0] == 2
    # No NaN may leak into the model (TC-ML-002).
    assert not pd.isnull(transformed).any()


def test_build_model_is_deterministic_random_forest():
    first, second = build_model(), build_model()
    assert first.random_state == 42 == second.random_state
    assert first.class_weight == "balanced"


# ------------------------------------------------------------------
# train_and_evaluate — TC-ML-005
# ------------------------------------------------------------------

def test_train_small_dataset_skips_evaluation_but_fits():
    from sklearn.pipeline import Pipeline

    df = pd.DataFrame([_row(label="LOW"), _row(label="HIGH")])
    pipeline = Pipeline(
        [("preprocessor", build_preprocessor()), ("model", build_model())]
    )
    fitted, results = train_and_evaluate(pipeline, df[FEATURES], df[TARGET])
    assert results["evaluation_performed"] is False
    assert list(fitted.named_steps["model"].classes_) == ["HIGH", "LOW"]


def test_train_large_dataset_evaluates_then_refits_on_all():
    from sklearn.pipeline import Pipeline

    df = _balanced_frame(n_per_class=8)  # 32 rows -> stratified path
    pipeline = Pipeline(
        [("preprocessor", build_preprocessor()), ("model", build_model())]
    )
    fitted, results = train_and_evaluate(pipeline, df[FEATURES], df[TARGET])
    assert results["evaluation_performed"] is True
    assert 0.0 <= results["accuracy"] <= 1.0
    assert set(results["classification_report"]) >= {"LOW", "accuracy"}
    assert len(results["confusion_matrix"]) == 4
    # Final model refit on the full dataset: predicts all four classes' rows.
    assert len(fitted.predict(df[FEATURES])) == len(df)
