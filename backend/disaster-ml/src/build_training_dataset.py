import argparse
import re
from pathlib import Path

import pandas as pd
from pypdf import PdfReader

from common import (
    ASSAM_DISTRICTS,
    norm_district,
    report_type_from_name,
    extract_date,
    to_number,
)


FEATURE_COLUMNS = [
    "district",
    "date",
    "report_type",
    "affected_villages",
    "population_affected",
    "crop_area_affected_ha",
    "landslide_area_ha",
    "roads_damaged",
    "houses_damaged",
    "lives_lost",
    "rainfall_mm",
    "river_danger_level_count",
    "historical_hazard_score",
]


# ============================================================
# PDF READING
# ============================================================

def read_pdf(path: Path) -> str:
    """
    Extract all readable text from a PDF.
    Returns an empty string if the PDF cannot be read.
    """
    try:
        reader = PdfReader(str(path))
        pages = []

        for page in reader.pages:
            try:
                pages.append(page.extract_text() or "")
            except Exception:
                continue

        return "\n".join(pages)

    except Exception as e:
        print(f"WARNING: Could not read {path.name}: {e}")
        return ""


# ============================================================
# TEXT UTILITIES
# ============================================================

def clean_text(text: str) -> str:
    """
    Normalizes extracted PDF text while preserving line breaks.
    """
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text


def normalize_date(date_value):
    """
    Converts dates into YYYY-MM-DD format.

    Supports:
    - DD-MM-YYYY
    - DD/MM/YYYY
    - YYYY-MM-DD
    """
    if not date_value:
        return None

    date_value = str(date_value).strip()

    formats = [
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y-%m-%d",
        "%Y/%m/%d",
    ]

    for fmt in formats:
        try:
            return pd.to_datetime(date_value, format=fmt).strftime("%Y-%m-%d")
        except Exception:
            pass

    return date_value


def extract_date_from_filename(path: Path):
    """
    Extracts a date safely from the filename.

    IMPORTANT:
    Uses path.name (a string), never the Path object directly.
    This fixes the TypeError you encountered with re.search().
    """

    filename = path.name

    patterns = [
        r"(\d{4}-\d{2}-\d{2})",
        r"(\d{2}-\d{2}-\d{4})",
        r"(\d{4}_\d{2}_\d{2})",
        r"(\d{2}_\d{2}_\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, filename)

        if match:
            value = match.group(1).replace("_", "-")
            return normalize_date(value)

    return None


def get_report_date(text: str, pdf_path: Path):
    """
    First tries extracting date from PDF content.
    If unavailable, falls back safely to the filename.
    """

    date_value = extract_date(text)

    if date_value:
        return normalize_date(date_value)

    return extract_date_from_filename(pdf_path)


def get_section(text: str, start_patterns, end_patterns):
    """
    Extracts a section between possible start and end headings.
    """

    start_match = None

    for pattern in start_patterns:
        start_match = re.search(pattern, text, flags=re.IGNORECASE)

        if start_match:
            break

    if not start_match:
        return ""

    start_pos = start_match.end()

    remaining = text[start_pos:]

    end_positions = []

    for pattern in end_patterns:
        match = re.search(pattern, remaining, flags=re.IGNORECASE)

        if match:
            end_positions.append(match.start())

    if end_positions:
        return remaining[:min(end_positions)]

    return remaining


# ============================================================
# DISTRICT UTILITIES
# ============================================================

DISTRICT_LOOKUP = {
    norm_district(d).lower(): norm_district(d)
    for d in ASSAM_DISTRICTS
}


def canonical_district(name: str):
    """
    Cleans and normalizes a district name.
    """

    if not name:
        return None

    name = re.sub(r"\s+", " ", name).strip()

    name = name.replace("Dima-Hasao", "Dima Hasao")
    name = name.replace("Kamrup(M)", "Kamrup (M)")
    name = name.replace("Kamrup M", "Kamrup (M)")

    normalized = norm_district(name)

    if normalized.lower() in DISTRICT_LOOKUP:
        return DISTRICT_LOOKUP[normalized.lower()]

    for district in ASSAM_DISTRICTS:
        if normalized.lower() == district.lower():
            return norm_district(district)

    return None


def district_pattern():
    """
    Builds a regex containing all known Assam districts.
    Longest names first to prevent partial matching.
    """

    districts = sorted(
        ASSAM_DISTRICTS,
        key=len,
        reverse=True,
    )

    escaped = []

    for district in districts:
        pattern = re.escape(district)

        pattern = pattern.replace(
            r"\ ",
            r"\s+"
        )

        pattern = pattern.replace(
            r"\-",
            r"[-\s]?"
        )

        escaped.append(pattern)

    return "(" + "|".join(escaped) + ")"


DISTRICT_REGEX = district_pattern()


# ============================================================
# EMPTY ROW
# ============================================================

def create_empty_row(district, date, report_type):

    return {
        "district": district,
        "date": date,
        "report_type": report_type,
        "affected_villages": 0.0,
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


# ============================================================
# AFFECTED DISTRICTS
# ============================================================

def find_affected_districts(text):
    """
    Finds districts mentioned in the affected-district section.
    """

    section = get_section(
        text,
        [
            r"District\s+Affected",
            r"No\.\s*of\s+Districts\s+Affected",
        ],
        [
            r"No\.\s*Of\s+Revenue",
            r"Villages\s+Affected",
            r"Population",
            r"Relief",
        ],
    )

    search_text = section if section else text

    found = set()

    for district in ASSAM_DISTRICTS:

        pattern = re.escape(district)
        pattern = pattern.replace(r"\ ", r"\s+")

        if re.search(pattern, search_text, flags=re.IGNORECASE):
            found.add(norm_district(district))

    return sorted(found)


# ============================================================
# VILLAGES AFFECTED
# ============================================================

def extract_affected_villages(text):
    """
    Extracts:
    District -> Total Villages Affected
    """

    section = get_section(
        text,
        [
            r"Villages\s+Affected",
        ],
        [
            r"Population",
            r"Relief\s+Camps",
            r"Landslide\s+Affected\s+Area",
            r"Houses\s+Damaged",
        ],
    )

    if not section:
        return {}

    results = {}

    pattern = re.compile(
        DISTRICT_REGEX
        + r"\s+"
        + r"(\d+(?:\.\d+)?)",
        flags=re.IGNORECASE,
    )

    for match in pattern.finditer(section):

        district = canonical_district(match.group(1))

        if not district:
            continue

        value = to_number(match.group(2))

        # Keep the largest value for duplicate occurrences
        results[district] = max(
            results.get(district, 0.0),
            value,
        )

    return results


# ============================================================
# FLOOD POPULATION + CROP AREA
# ============================================================

def extract_flood_population_and_crop(text):
    """
    Extracts rows from the section:

    Population And Crop Area Submerged

    Expected format approximately:

    District Male Female Children Total Population Crop Area

    Example:
    Golaghat 138 108 36 282 140
    """

    section = get_section(
        text,
        [
            r"Population\s+And\s+Crop\s+Area\s+Submerged",
            r"Population\s+and\s+Crop\s+Area",
        ],
        [
            r"Relief\s+Camps",
            r"Inmates\s+In\s+Relief",
            r"Human\s+Lives",
            r"Houses\s+Damaged",
        ],
    )

    if not section:
        return {}

    results = {}

    number = r"(\d+(?:\.\d+)?)"

    pattern = re.compile(
        DISTRICT_REGEX
        + r"\s+"
        + number
        + r"\s+"
        + number
        + r"\s+"
        + number
        + r"\s+"
        + number
        + r"\s+"
        + number,
        flags=re.IGNORECASE,
    )

    for match in pattern.finditer(section):

        district = canonical_district(match.group(1))

        if not district:
            continue

        male = to_number(match.group(2))
        female = to_number(match.group(3))
        children = to_number(match.group(4))
        total = to_number(match.group(5))
        crop = to_number(match.group(6))

        # Validation: total should normally be >= individual values
        if total < max(male, female, children):
            continue

        if district not in results:
            results[district] = {
                "population": total,
                "crop": crop,
            }

        else:
            existing = results[district]

            if total + crop > (
                existing["population"]
                + existing["crop"]
            ):
                results[district] = {
                    "population": total,
                    "crop": crop,
                }

    return results


# ============================================================
# LANDSLIDE AREA
# ============================================================

def extract_landslide_area(text):
    """
    Extracts district-wise landslide affected area.

    Expected format:

    District | Total | Crop Area | Non Crop Area

    Example:
    Dima-Hasao 0.388219545 0 0.388219545
    """

    section = get_section(
        text,
        [
            r"Landslide\s+Affected\s+Area",
        ],
        [
            r"Population\s+Affected",
            r"Relief\s+Camps",
            r"Inmates",
            r"Human\s+Lives",
        ],
    )

    if not section:
        return {}

    results = {}

    number = r"(\d+(?:\.\d+)?)"

    pattern = re.compile(
        DISTRICT_REGEX
        + r"\s+"
        + number
        + r"\s+"
        + number
        + r"\s+"
        + number,
        flags=re.IGNORECASE,
    )

    for match in pattern.finditer(section):

        district = canonical_district(match.group(1))

        if not district:
            continue

        total_area = to_number(match.group(2))

        results[district] = max(
            results.get(district, 0.0),
            total_area,
        )

    return results


# ============================================================
# LANDSLIDE POPULATION
# ============================================================

def extract_landslide_population(text):
    """
    Extracts:

    District Male Female Children Total Population
    """

    section = get_section(
        text,
        [
            r"Population\s+Affected",
        ],
        [
            r"Relief\s+Camps",
            r"Inmates\s+In\s+Relief",
            r"Human\s+Lives",
            r"Livestocks",
            r"Houses\s+Damaged",
        ],
    )

    if not section:
        return {}

    results = {}

    number = r"(\d+(?:\.\d+)?)"

    pattern = re.compile(
        DISTRICT_REGEX
        + r"\s+"
        + number
        + r"\s+"
        + number
        + r"\s+"
        + number
        + r"\s+"
        + number,
        flags=re.IGNORECASE,
    )

    for match in pattern.finditer(section):

        district = canonical_district(match.group(1))

        if not district:
            continue

        male = to_number(match.group(2))
        female = to_number(match.group(3))
        children = to_number(match.group(4))
        total = to_number(match.group(5))

        if total < max(male, female, children):
            continue

        results[district] = max(
            results.get(district, 0.0),
            total,
        )

    return results


# ============================================================
# FLOOD ROW EXTRACTION
# ============================================================

def extract_flood_rows(text, date):

    affected_districts = find_affected_districts(text)

    villages = extract_affected_villages(text)

    population_crop = extract_flood_population_and_crop(text)

    all_districts = set(affected_districts)
    all_districts.update(villages.keys())
    all_districts.update(population_crop.keys())

    rows = []

    for district in sorted(all_districts):

        row = create_empty_row(
            district,
            date,
            "flood",
        )

        row["affected_villages"] = villages.get(
            district,
            0.0,
        )

        row["population_affected"] = population_crop.get(
            district,
            {},
        ).get(
            "population",
            0.0,
        )

        row["crop_area_affected_ha"] = population_crop.get(
            district,
            {},
        ).get(
            "crop",
            0.0,
        )

        rows.append(row)

    return rows


# ============================================================
# LANDSLIDE ROW EXTRACTION
# ============================================================

def extract_landslide_rows(text, date):

    affected_districts = find_affected_districts(text)

    villages = extract_affected_villages(text)

    area = extract_landslide_area(text)

    population = extract_landslide_population(text)

    all_districts = set(affected_districts)
    all_districts.update(villages.keys())
    all_districts.update(area.keys())
    all_districts.update(population.keys())

    rows = []

    for district in sorted(all_districts):

        row = create_empty_row(
            district,
            date,
            "landslide",
        )

        row["affected_villages"] = villages.get(
            district,
            0.0,
        )

        row["population_affected"] = population.get(
            district,
            0.0,
        )

        row["landslide_area_ha"] = area.get(
            district,
            0.0,
        )

        rows.append(row)

    return rows


# ============================================================
# RISK LABEL CREATION
# ============================================================

def add_label(df):
    """
    Creates an explainable severity label from the observed
    disaster impact.

    LOW
    MODERATE
    HIGH
    CRITICAL
    """

    impact = (
        0.00002
        * df["population_affected"].fillna(0)

        + 0.01
        * df["crop_area_affected_ha"].fillna(0)

        + 2.0
        * df["landslide_area_ha"].fillna(0)

        + 1.5
        * df["roads_damaged"].fillna(0)

        + 0.5
        * df["houses_damaged"].fillna(0)

        + 20.0
        * df["lives_lost"].fillna(0)

        + 0.01
        * df["rainfall_mm"].fillna(0)

        + 2.0
        * df["river_danger_level_count"].fillna(0)

        + 10.0
        * df["historical_hazard_score"].fillna(0)
    )

    df["impact_score"] = impact

    if len(df) >= 4:

        ranks = impact.rank(
            method="first",
            pct=True,
        )

        df["risk_label"] = pd.cut(
            ranks,
            bins=[
                0,
                0.25,
                0.50,
                0.75,
                1.0,
            ],
            labels=[
                "LOW",
                "MODERATE",
                "HIGH",
                "CRITICAL",
            ],
            include_lowest=True,
        ).astype(str)

    else:

        df["risk_label"] = "LOW"

    return df


# ============================================================
# MAIN
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description="Build ML training dataset from Assam DRIMS disaster PDFs."
    )

    parser.add_argument(
        "--data-dir",
        required=True,
        help="Root directory containing flood and landslide PDF files.",
    )

    parser.add_argument(
        "--output",
        required=True,
        help="Output CSV file path.",
    )

    args = parser.parse_args()

    data_dir = Path(args.data_dir)

    if not data_dir.exists():
        raise FileNotFoundError(
            f"Data directory does not exist: {data_dir}"
        )

    if not data_dir.is_dir():
        raise NotADirectoryError(
            f"Provided data path is not a directory: {data_dir}"
        )

    all_rows = []

    # IMPORTANT:
    # rglob searches recursively.
    #
    # This means these folders are searched:
    #
    # data/
    # data/flood/
    # data/landslide/
    # data/historical/
    #
    pdf_files = sorted(
        data_dir.rglob("*.pdf")
    )

    print(
        f"\nFound {len(pdf_files)} PDF files."
    )

    for pdf in pdf_files:

        # Only process daily DRIMS reports.
        #
        # Historical memorandum PDFs and hazard atlas PDFs
        # are intentionally skipped here because they have
        # different structures and should later be converted
        # into historical spatial features.
        filename_lower = pdf.name.lower()

        if "daily_flood_report" in filename_lower:
            report_type = "flood"

        elif "daily_landslide_report" in filename_lower:
            report_type = "landslide"

        else:
            print(
                f"Skipping non-daily PDF: {pdf.name}"
            )
            continue

        print(
            f"Processing: {pdf.name}"
        )

        text = read_pdf(pdf)

        if not text.strip():
            print(
                f"  WARNING: No readable text found."
            )
            continue

        text = clean_text(text)

        # SAFE DATE EXTRACTION
        date = get_report_date(
            text,
            pdf,
        )

        if not date:
            print(
                f"  WARNING: Could not determine date. Skipping."
            )
            continue

        if report_type == "flood":

            rows = extract_flood_rows(
                text,
                date,
            )

        elif report_type == "landslide":

            rows = extract_landslide_rows(
                text,
                date,
            )

        else:

            rows = []

        print(
            f"  Extracted {len(rows)} district rows."
        )

        all_rows.extend(rows)

    # ========================================================
    # VALIDATION
    # ========================================================

    if not all_rows:

        raise RuntimeError(
            "\nNo rows were extracted.\n"
            "Check that your data directory contains files named:\n"
            "Daily_Flood_Report_YYYY-MM-DD.pdf\n"
            "or\n"
            "Daily_Landslide_Report_YYYY-MM-DD.pdf"
        )

    # ========================================================
    # CREATE DATAFRAME
    # ========================================================

    df = pd.DataFrame(
        all_rows
    )

    # Ensure all required columns exist.
    for column in FEATURE_COLUMNS:

        if column not in df.columns:

            if column in [
                "district",
                "date",
                "report_type",
            ]:
                df[column] = ""

            else:
                df[column] = 0.0

    numeric_cols = [

        column

        for column in FEATURE_COLUMNS

        if column not in [
            "district",
            "date",
            "report_type",
        ]

    ]

    df[numeric_cols] = (
        df[numeric_cols]
        .apply(
            pd.to_numeric,
            errors="coerce",
        )
        .fillna(0.0)
    )

    # ========================================================
    # COMBINE SAME DISTRICT + DATE
    # ========================================================

    df = (

        df

        .groupby(
            [
                "district",
                "date",
            ],
            as_index=False,
        )[numeric_cols]

        .sum()

    )

    # Sort before labelling.
    df = df.sort_values(
        [
            "date",
            "district",
        ]
    ).reset_index(
        drop=True
    )

    # ========================================================
    # CREATE ML TARGET
    # ========================================================

    df = add_label(
        df
    )

    # ========================================================
    # SAVE OUTPUT
    # ========================================================

    output_path = Path(
        args.output
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    df.to_csv(
        output_path,
        index=False,
    )

    # ========================================================
    # OUTPUT SUMMARY
    # ========================================================

    print(
        "\n"
        + "=" * 60
    )

    print(
        "TRAINING DATASET CREATED SUCCESSFULLY"
    )

    print(
        "=" * 60
    )

    print(
        f"Total district-date rows: {len(df)}"
    )

    print(
        f"Output file: {output_path}"
    )

    print(
        "\nRisk label distribution:"
    )

    print(
        df["risk_label"]
        .value_counts()
        .to_string()
    )

    print(
        "\nDataset preview:"
    )

    print(
        df.head(20)
        .to_string(
            index=False
        )
    )


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()