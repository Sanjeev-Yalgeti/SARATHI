# SARATHI Disaster ML --- Dataset-Based Test Cases

## Purpose

This document defines dataset-driven test cases for the disaster-risk ML
component and its integration with the Logistics Intelligence Platform.

## Source Coverage

-   19--21 July 2026
-   27--28 July 2026 available peak-period coverage
-   08--09 August 2026

> **Note:** A 29 July 2026 report was not available among the supplied
> source files. No report-specific facts or expected labels are
> fabricated for that date.

## Requirements Covered

-   FR-01: GIS/GeoJSON map
-   FR-02: Real-time vehicle/location updates
-   FR-03: Risk alerts and warnings
-   FR-04 to FR-06: REST/API and intelligence-controller flow
-   FR-07: Weather and flood information
-   FR-08 to FR-09: Route and alternate-route analysis
-   FR-10: Weighted risk calculation
-   FR-11 to FR-12: Incident processing and real-time updates

## Important Validation Rule

The requirements document does not define fixed ML score thresholds or
the exact final model feature schema. Therefore expected results below
are expressed as incident ingestion, spatial association, relative risk
behaviour, alerts, route-state changes and alternate-route behaviour.
Exact numeric scores/classes should be added after model thresholds are
finalized.

# Test Cases

## TC-ML-001 --- Valid Dataset Record Ingestion

**Priority:** High\
**Source:** All selected datasets\
**Input:** Valid date, district, hazard type, location and available
attributes.\
**Steps:** Load → preprocess → validate.\
**Expected:** Valid records are retained and consistently mapped;
malformed records are reported instead of silently corrupting the
dataset.

## TC-ML-002 --- Missing Optional Fields

**Priority:** High\
**Input:** Incident/location record with incomplete assessment fields.\
**Steps:** Run preprocessing and prediction.\
**Expected:** Missing optional values are handled using the implemented
preprocessing rule; the system does not crash and returns either a valid
prediction or a controlled insufficient-data/error state.

## TC-ML-003 --- Invalid Geographic Coordinates

**Priority:** High\
**Input:** Latitude/longitude outside valid ranges or non-numeric
values.\
**Expected:** Record is rejected or flagged before GIS/route analysis;
invalid points are not plotted as valid incidents.

## TC-ML-004 --- Duplicate Incident

**Priority:** Medium\
**Input:** Same incident/location/timestamp submitted twice.\
**Expected:** The implemented deduplication/update rule prevents
unintended duplicate alerts or route blockages.

## TC-ML-005 --- Model Artifact Availability

**Priority:** Critical\
**Steps:** Start prediction workflow with the trained model artifact
present.\
**Expected:** Model loads successfully and accepts the expected feature
structure.

## TC-ML-006 --- Feature Schema Mismatch

**Priority:** Critical\
**Input:** Missing, extra or incorrectly typed model features.\
**Expected:** Safe validation error; no misleading prediction is
returned.

# 19--21 July 2026

## TC-JUL19-001 --- Rainfall-Triggered Landslide and Traffic Impact

**Source scenario:** 19 July landslide at Navagraha Hill, Guwahati;
guard wall collapse affected the road and traffic.\
**Input:** Landslide incident and affected route segment.\
**Steps:** Ingest incident → map location → run route risk analysis.\
**Expected:** Incident is spatially represented; affected route receives
increased risk/blockage consideration; warning is generated; alternate
route is returned if available.\
**Requirements:** FR-01, FR-03, FR-09, FR-10, FR-11.

## TC-JUL20-001 --- Flood Infrastructure Impact

**Source scenario:** 20 July flood records contain infrastructure damage
and affected/submerged systems.\
**Input:** Flood incident records with location and infrastructure
impact.\
**Expected:** Impacted locations are distinguishable from unaffected
locations and are treated as risk-driving incidents.\
**Requirements:** FR-03, FR-06, FR-10, FR-11.

## TC-JUL20-002 --- Landslide With House Damage

**Source scenario:** 20 July landslide at Kamarkuchi Revenue Village
following heavy/incessant rain; a kutcha house was reported fully
damaged.\
**Input:** Landslide incident with damage information.\
**Expected:** Severe incident is processed and contributes to the
relevant area/route risk state.\
**Requirements:** FR-10, FR-11, FR-12.

## TC-JUL21-001 --- Flood Overtopping of Roads

**Source scenario:** Multiple roads in Charaideo reported overtopped by
flood water.\
**Input:** Route intersecting an affected road.\
**Expected:** Route risk increases; affected segment is warned/flagged;
alternate route is generated when network data provides one.\
**Requirements:** FR-03, FR-08, FR-09, FR-10.

## TC-JUL21-002 --- Embankment Breach

**Source scenario:** Jhanji Bund right-bank breach caused by flood
overtopping; GPS coordinates reported.\
**Input:** High-severity breach incident with coordinates.\
**Expected:** Location is mapped; nearby routes receive elevated risk;
high-severity alert is visible.\
**Requirements:** FR-01, FR-03, FR-10, FR-11.

# 27--28 July 2026 Peak Period

## TC-PEAK-001 --- Overtopped Road

**Source scenario:** 27 July Thukubill Satra Road reported with flood
water overtopping approximately 3.50 km.\
**Input:** Route overlapping affected road geometry.\
**Expected:** Segment is not treated as normal/low-risk; warning and
alternate route are returned when available.\
**Requirements:** FR-03, FR-09, FR-10.

## TC-PEAK-002 --- Landslide-Caused Road Damage

**Source scenario:** 27 July Dholai Bazar--Lowerbond Road side berm
reported damaged due to landslide.\
**Input:** Landslide/road-damage incident.\
**Expected:** Incident is associated with the road segment and route
risk/warning is updated.\
**Requirements:** FR-01, FR-03, FR-09, FR-10, FR-11.

## TC-PEAK-003 --- Multiple Peak Incidents

**Source:** 27--28 July records.\
**Input:** Batch containing multiple valid incidents.\
**Expected:** All valid records are processed without overwriting
unrelated incidents; each retains its own spatial/risk association.\
**Requirements:** FR-06, FR-10, FR-11, FR-12.

## TC-PEAK-004 --- High Concentration of Overtopped Roads

**Source scenario:** 28 July records include numerous overtopped roads
in the Sivasagar/Amguri context.\
**Input:** Route through an area containing several affected segments.\
**Expected:** Routing engine evaluates the affected network and prefers
the safest available route according to implemented risk logic.\
**Requirements:** FR-06, FR-08, FR-09, FR-10.

## TC-PEAK-005 --- Mitigation Data Does Not Erase Hazard

**Source scenario:** 28 July tarpaulins distributed in landslide-prone
Guwahati areas.\
**Input:** Hazard context plus mitigation activity.\
**Expected:** Response/mitigation information does not erase the
underlying hazard context; hazard and operational status remain
distinguishable.

## TC-PEAK-006 --- 29 July Missing-Data Guard

**Input:** Attempt to load DS-JUL-29 without a supplied source report.\
**Expected:** System reports missing source data clearly and does not
fabricate records, labels or evaluation results.

# 08--09 August 2026

## TC-AUG08-001 --- Continued Flood Operational Data

**Source scenario:** 08 August records include disinfection, relief and
continuing assessments.\
**Input:** Incident and response records from affected areas.\
**Expected:** Operational/response records coexist with hazard records
and are not incorrectly interpreted as hazard removal.

## TC-AUG08-002 --- Date-Specific Landslide Ingestion

**Input:** Valid landslide records for the selected date.\
**Expected:** Records retain correct date and hazard-type association
after parsing and normalization.

## TC-AUG09-001 --- Rivers Above Danger Level

**Source scenario:** 09 August report lists Dhansiri (S) at Golaghat and
Numaligarh and Kushiyara at Sribhumi above danger level.\
**Input:** Flood danger-level indicators and route/area context.\
**Expected:** Associated areas/routes receive stronger risk
consideration than a comparable baseline route without elevated
indicators.\
**Requirements:** FR-07, FR-10.

## TC-AUG09-002 --- Multi-District Batch

**Source scenario:** 09 August report includes 10 affected districts, 28
revenue circles and 459 villages.\
**Input:** Multi-district batch.\
**Expected:** Records remain associated with the correct
district/revenue-circle geography; no cross-district contamination
occurs.\
**Requirements:** FR-01, FR-06, FR-11.

## TC-AUG09-003 --- Two Landslide Locations

**Source scenario:** 09 August heavy rainfall caused two reported
landslides in Gitanagar, Guwahati.\
**Input:** Two distinct landslide locations.\
**Expected:** Both incidents are represented separately; affected area
receives risk alerts; unaffected locations are not incorrectly marked.\
**Requirements:** FR-01, FR-03, FR-10, FR-11.

## TC-AUG09-004 --- Damage Severity Preservation

**Source scenario:** 09 August landslide report includes house damage,
including severe damage in Dima Hasao.\
**Input:** Incident with damage severity.\
**Expected:** Severity is preserved and can contribute to configured
risk/alert logic; raw damage data is not lost during preprocessing.\
**Requirements:** FR-10, FR-11.

# API and Integration Tests

## TC-API-001 --- GET /api/risk

**Input:** Valid route, vehicle or area identifier.\
**Expected:** Returns the calculated/available risk result using the
implemented response schema.

## TC-API-002 --- GET /api/weather

**Input:** Valid route/area context.\
**Expected:** Weather information used for risk assessment is returned,
or a controlled external-service error is provided.

## TC-API-003 --- POST /api/route/analyze

**Input:** Route intersecting a July or August hazard area.\
**Expected:** Response contains route analysis and risk information;
affected route is warned and an alternate route is returned when
supported.

## TC-API-004 --- POST /api/incidents Valid Payload

**Input:** Valid incident with available type, location, severity,
timestamp and processing status.\
**Expected:** Incident is accepted, processed and made available to
risk/route workflows.

## TC-API-005 --- POST /api/incidents Invalid Payload

**Input:** Missing incident type/location or invalid coordinates.\
**Expected:** API rejects the request with a clear validation error and
does not create a corrupted incident.

# Acceptance Summary

  Acceptance Area              Supporting Test Cases
  ---------------------------- ------------------------------------------
  Interactive GIS map          TC-JUL19-001, TC-JUL21-002, TC-AUG09-003
  Risk alerts                  TC-JUL19-001, TC-JUL21-001, TC-AUG09-003
  Weather/flood integration    TC-AUG09-001
  Risk calculation behaviour   TC-JUL20-001, TC-PEAK-003, TC-AUG09-004
  Alternate routes             TC-JUL21-001, TC-PEAK-001, TC-API-003
  Spatial association          TC-JUL21-002, TC-PEAK-002
  API integration              TC-API-001 to TC-API-005
  Data quality handling        TC-ML-001 to TC-ML-006
  Missing-data handling        TC-ML-002, TC-PEAK-006

# Source Files Used

-   Logistics_Intelligence_Platform_Project_Requirements.md
-   Daily_Landslide_Report_2026-07-19.pdf
-   Daily_Flood_Report_2026-07-20.pdf
-   Daily_Landslide_Report_2026-07-20.pdf
-   Daily_Flood_Report_2026-07-21.pdf
-   Daily_Landslide_Report_2026-07-27.pdf
-   Daily_Flood_Report_2026-07-27.pdf
-   Daily_Landslide_Report_2026-07-28.pdf
-   Daily_Flood_Report_2026-07-28.pdf
-   Daily_Flood_Report_2026-08-08.pdf
-   Daily_Landslide_Report_2026-08-08.pdf
-   Daily_Flood_Report_2026-08-09.pdf
-   Daily_Landslide_Report_2026-08-09.pdf

# Recommended Repository Location

Save as:

``` text
backend/disaster-ml/test_cases/TEST_CASES.md
```

This keeps dataset-based validation documentation next to the disaster
ML component while remaining separate from source code and generated
model artifacts.
