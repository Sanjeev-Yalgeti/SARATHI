"""Unit tests for src/common.py.

PROJECT.md traceability: Data Integrity NFR (spatial/real-time data must
be validated before persistence) and FR-11 (incident data processing).
TEST_CASES.md: TC-ML-001 (valid ingestion), TC-ML-003 (invalid geo input
handling analogue: invalid values never crash helpers).
"""

from pathlib import Path

import common
from common import (
    extract_date,
    norm_district,
    report_type_from_name,
    to_number,
)


def test_norm_district_aliases():
    assert norm_district("Kamrup (M)") == "Kamrup Metropolitan"
    assert norm_district("Kamrup(M)") == "Kamrup Metropolitan"
    assert norm_district("Kamrup M") == "Kamrup Metropolitan"
    assert norm_district("Dima-Hasao") == "Dima Hasao"
    assert norm_district("Bongaigao n") == "Bongaigaon"


def test_norm_district_passthrough_unknown():
    # Unknown names must pass through untouched (never crash, never invent).
    assert norm_district("Cachar") == "Cachar"
    assert norm_district("  Golaghat  ") == "Golaghat"


def test_report_type_from_name():
    assert report_type_from_name(Path("Daily_Flood_Report_2026-07-20.pdf")) == "flood"
    assert report_type_from_name(Path("Daily_Landslide_Report_2026-07-19.pdf")) == "landslide"
    assert report_type_from_name(Path("assam_flood_memorandum_2024_.pdf")) == "flood"
    assert report_type_from_name(Path("random_notes.txt")) == "unknown"


def test_extract_date_ddmmyyyy():
    assert extract_date("Report as on 20-07-2026") == "20-07-2026"


def test_extract_date_yyyymmdd():
    assert extract_date("Report as on 2026-07-20") == "2026-07-20"


def test_extract_date_missing_returns_none():
    assert extract_date("no date in this text at all") is None
    assert extract_date("") is None


def test_to_number_valid():
    assert to_number("1,234") == 1234.0
    assert to_number("  0.388  ") == 0.388
    assert to_number(42) == 42.0


def test_to_number_invalid_returns_zero_not_crash():
    # TC-ML-001 rule: malformed values are neutralised, never raise.
    assert to_number("abc") == 0.0
    assert to_number("") == 0.0
    assert to_number(None) == 0.0


def test_assam_districts_covers_key_operational_districts():
    for district in ["Cachar", "Golaghat", "Sivasagar", "Dima Hasao", "Kamrup"]:
        assert district in common.ASSAM_DISTRICTS
