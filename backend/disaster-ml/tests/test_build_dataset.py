"""Unit tests for src/build_training_dataset.py extractors and labelling.

PROJECT.md: FR-07 (flood/weather indicators), FR-10 (weighted risk
formula inputs), FR-11 (incident ingestion), Data Integrity NFR.
TEST_CASES.md: TC-ML-001 (valid ingestion), TC-ML-002 (missing fields),
TC-AUG09-001 (danger-level indicators), TC-AUG09-002 (district association).
"""

from pathlib import Path

import pandas as pd

import build_training_dataset as btd
from build_training_dataset import (
    add_label,
    canonical_district,
    clean_text,
    create_empty_row,
    extract_affected_villages,
    extract_date_from_filename,
    extract_flood_population_and_crop,
    extract_flood_rows,
    extract_landslide_area,
    extract_landslide_population,
    extract_landslide_rows,
    find_affected_districts,
    get_report_date,
    get_section,
    normalize_date,
    read_pdf,
)


# ------------------------------------------------------------------
# Date helpers
# ------------------------------------------------------------------

def test_normalize_date_formats():
    assert normalize_date("20-07-2026") == "2026-07-20"
    assert normalize_date("20/07/2026") == "2026-07-20"
    assert normalize_date("2026-07-20") == "2026-07-20"


def test_normalize_date_empty_returns_none():
    assert normalize_date(None) is None
    assert normalize_date("") is None


def test_extract_date_from_filename():
    assert extract_date_from_filename(Path("Daily_Flood_Report_2026-07-20.pdf")) == "2026-07-20"
    assert extract_date_from_filename(Path("Daily_Landslide_Report_20-07-2026.pdf")) == "2026-07-20"
    assert extract_date_from_filename(Path("notes.txt")) is None


def test_get_report_date_prefers_pdf_text_over_filename():
    date = get_report_date(
        "Report as on 20-07-2026, flood bulletin",
        Path("Daily_Flood_Report_2026-07-21.pdf"),
    )
    assert date == "2026-07-20"


def test_get_report_date_falls_back_to_filename():
    date = get_report_date(
        "bulletin with no extractable date",
        Path("Daily_Flood_Report_2026-07-21.pdf"),
    )
    assert date == "2026-07-21"


# ------------------------------------------------------------------
# Text helpers
# ------------------------------------------------------------------

def test_clean_text_collapses_whitespace_but_keeps_lines():
    cleaned = clean_text("a\t\tb\n\n\nc")
    assert "a b" in cleaned
    assert "\n\n\n" not in cleaned


def test_get_section_no_start_returns_empty():
    assert get_section("nothing relevant here", [r"Villages\s+Affected"], [r"Population"]) == ""


def test_get_section_returns_between_headings():
    text = "Villages Affected\nCachar 12\nPopulation\nrest"
    section = get_section(text, [r"Villages\s+Affected"], [r"Population"])
    assert "Cachar 12" in section
    assert "rest" not in section


def test_read_pdf_missing_file_returns_empty_string(tmp_path):
    assert read_pdf(tmp_path / "does-not-exist.pdf") == ""


# ------------------------------------------------------------------
# District helpers
# ------------------------------------------------------------------

def test_canonical_district_normalises_variants():
    assert canonical_district("Dima-Hasao") == "Dima Hasao"
    assert canonical_district("Kamrup(M)") == "Kamrup Metropolitan"
    assert canonical_district("Cachar") == "Cachar"


def test_canonical_district_unknown_returns_none():
    assert canonical_district("Atlantis") is None
    assert canonical_district("") is None


def test_create_empty_row_defaults_are_zero():
    row = create_empty_row("Cachar", "2026-07-20", "flood")
    assert row["district"] == "Cachar"
    assert row["date"] == "2026-07-20"
    assert row["report_type"] == "flood"
    assert row["population_affected"] == 0.0
    assert row["risk_label" if "risk_label" in row else "affected_villages"] == 0.0


def test_find_affected_districts_in_plain_text():
    found = find_affected_districts("Cachar and Golaghat were affected by floods.")
    assert found == ["Cachar", "Golaghat"]


def test_find_affected_districts_respects_section():
    text = "District Affected\nCachar\nNo. Of Revenue Circles\nSivasagar"
    found = find_affected_districts(text)
    assert "Cachar" in found
    # Sivasagar appears after the section end marker, so it is out of scope.
    assert "Sivasagar" not in found


# ------------------------------------------------------------------
# Flood extractors (TC-JUL20-001 / TC-JUL21-001 analogues)
# ------------------------------------------------------------------

def test_extract_affected_villages():
    text = "Villages Affected\nCachar 12\nGolaghat 5\nPopulation\nxxx"
    result = extract_affected_villages(text)
    assert result == {"Cachar": 12.0, "Golaghat": 5.0}


def test_extract_affected_villages_no_section_returns_empty():
    assert extract_affected_villages("no relevant section") == {}


def test_extract_flood_population_and_crop():
    text = (
        "Population And Crop Area Submerged\n"
        "Golaghat 138 108 36 282 140\n"
        "Relief Camps\n"
    )
    result = extract_flood_population_and_crop(text)
    assert result["Golaghat"] == {"population": 282.0, "crop": 140.0}


def test_extract_flood_population_skips_inconsistent_totals():
    # Total (20) < male (100): physically inconsistent, must be dropped.
    text = (
        "Population And Crop Area Submerged\n"
        "Cachar 100 50 10 20 5\n"
        "Relief Camps\n"
    )
    assert extract_flood_population_and_crop(text) == {}


def test_extract_flood_rows_merges_district_sources():
    text = (
        "District Affected\nCachar\n"
        "Villages Affected\nCachar 12\nPopulation\n"
        "Population And Crop Area Submerged\nCachar 10 8 2 20 5\nRelief Camps\n"
    )
    rows = extract_flood_rows(text, "2026-07-20")
    by_district = {row["district"]: row for row in rows}
    assert by_district["Cachar"]["affected_villages"] == 12.0
    assert by_district["Cachar"]["population_affected"] == 20.0
    assert by_district["Cachar"]["crop_area_affected_ha"] == 5.0


# ------------------------------------------------------------------
# Landslide extractors (TC-JUL19-001 / TC-AUG09-003 analogues)
# ------------------------------------------------------------------

def test_extract_landslide_area_space_form():
    text = "Landslide Affected Area\nDima Hasao 0.388 0 0.388\nPopulation Affected\n"
    assert extract_landslide_area(text) == {"Dima Hasao": 0.388}


def test_extract_landslide_area_hyphen_form_is_currently_missed():
    # DOCUMENTED LIMITATION: DISTRICT_REGEX only allows whitespace between
    # multi-word district tokens, so the "Dima-Hasao" spelling used in some
    # bulletins is not picked up. Locked in so a future fix is visible.
    text = "Landslide Affected Area\nDima-Hasao 0.5 0 0.5\nPopulation Affected\n"
    assert extract_landslide_area(text) == {}


def test_extract_landslide_population():
    text = "Population Affected\nCachar 10 8 2 20\nRelief Camps\n"
    assert extract_landslide_population(text) == {"Cachar": 20.0}


def test_extract_landslide_rows_merges_sources():
    text = (
        "District Affected\nCachar\n"
        "Landslide Affected Area\nCachar 1.5 0.5 1.0\nPopulation Affected\n"
        "Population Affected\nCachar 10 8 2 20\nRelief Camps\n"
    )
    rows = extract_landslide_rows(text, "2026-07-19")
    by_district = {row["district"]: row for row in rows}
    assert by_district["Cachar"]["landslide_area_ha"] == 1.5
    assert by_district["Cachar"]["population_affected"] == 20.0


# ------------------------------------------------------------------
# Risk labelling — FR-10 weighted formula (TC-ML-001 / TC-AUG09-004)
# ------------------------------------------------------------------

def _impact_frame(**overrides):
    base = {
        "population_affected": 0.0,
        "crop_area_affected_ha": 0.0,
        "landslide_area_ha": 0.0,
        "roads_damaged": 0.0,
        "houses_damaged": 0.0,
        "lives_lost": 0.0,
        "rainfall_mm": 0.0,
        "river_danger_level_count": 0.0,
        "historical_hazard_score": 0.0,
    }
    base.update(overrides)
    return base


def test_add_label_produces_all_four_classes_on_spread_impacts():
    df = pd.DataFrame(
        [
            _impact_frame(),
            _impact_frame(population_affected=500),
            _impact_frame(population_affected=50000),
            _impact_frame(population_affected=50000, lives_lost=2),
        ]
    )
    labelled = add_label(df)
    assert set(labelled["risk_label"]) == {"LOW", "MODERATE", "HIGH", "CRITICAL"}
    # Severity must be preserved in order: worst impact -> CRITICAL.
    assert labelled.loc[labelled["population_affected"] == 50000].iloc[-1]["risk_label"] == "CRITICAL"
    assert labelled.loc[labelled["population_affected"] == 0.0].iloc[0]["risk_label"] == "LOW"


def test_add_label_small_frame_defaults_to_low():
    df = pd.DataFrame([_impact_frame(population_affected=999999)])
    labelled = add_label(df)
    assert list(labelled["risk_label"]) == ["LOW"]


def test_add_label_impact_score_is_monotonic_in_severity():
    df = pd.DataFrame(
        [
            _impact_frame(),
            _impact_frame(houses_damaged=5),
            _impact_frame(houses_damaged=5, lives_lost=1),
        ]
    )
    labelled = add_label(df)
    scores = list(labelled["impact_score"])
    assert scores[0] < scores[1] < scores[2]


def test_add_label_weights_match_documented_formula():
    # Spot-check one coefficient per factor family from build_training_dataset.add_label.
    df = pd.DataFrame([_impact_frame(lives_lost=1)])
    assert add_label(df)["impact_score"].iloc[0] == 20.0
    df = pd.DataFrame([_impact_frame(river_danger_level_count=1)])
    assert add_label(df)["impact_score"].iloc[0] == 2.0


def test_btd_feature_columns_cover_train_features():
    from train_risk_model import FEATURES

    for feature in FEATURES:
        if feature == "district":
            assert "district" in btd.FEATURE_COLUMNS
        else:
            assert feature in btd.FEATURE_COLUMNS
