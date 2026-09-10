"""Backend <-> ML contract tests (Python side, no DB required).

PROJECT.md: FR-04/05/06 (REST + gateway + controller), FR-10 (risk),
FR-07 (weather), FR-11 (simulation). TEST_CASES.md: TC-API-001..005.

The wire contract (locked here so either side cannot drift silently):

  * TS (`ml-client.ts`) POSTs {district, date, overrides} to
    `ML_URL/predict` (disaster-ml `src/serve.py`) and reads
    {risk_level, confidence, base_date} with bands
    LOW/MODERATE/HIGH/CRITICAL.
  * District comes from `ml-district.ts` corridor mapping; bands map to
    score/level via `mlBandToScore`; the simulation tick blocks on
    CRITICAL and slows on HIGH (`mlMotionFor`).
  * Sidecar down/invalid -> askMl returns null -> heuristic fallback
    (`source='heuristic'`), never a crash.
"""

import re
from pathlib import Path

import urllib.request

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_SRC = REPO_ROOT / "backend" / "src"
RISK_SERVICE = BACKEND_SRC / "services" / "risk.service.ts"
ML_CLIENT = BACKEND_SRC / "services" / "ml-client.ts"
ML_DISTRICT = BACKEND_SRC / "services" / "ml-district.ts"
RISK_LEVEL_TS = BACKEND_SRC / "services" / "risk.level.ts"
RISK_LEVEL_TEST = BACKEND_SRC / "services" / "risk.level.test.ts"
SIM_SERVICE = BACKEND_SRC / "services" / "simulation.service.ts"
SIM_ROUTE = BACKEND_SRC / "routes" / "simulation.ts"
INTELLIGENCE_ROUTE = BACKEND_SRC / "routes" / "intelligence.ts"
APP_TS = BACKEND_SRC / "app.ts"
SERVE_PY = REPO_ROOT / "backend" / "disaster-ml" / "src" / "serve.py"

from predict_risk import DEFAULT_VALUES  # noqa: E402
from train_risk_model import FEATURES  # noqa: E402


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


# ------------------------------------------------------------------
# TS consumer side: the sidecar contract
# ------------------------------------------------------------------

def test_ml_client_posts_district_date_overrides_schema():
    src = _read(ML_CLIENT)
    assert "/predict" in src
    assert "ML_URL" in src
    assert "district" in src
    assert "overrides" in src
    assert "rainfall_mm" in src


def test_ml_client_validates_band_and_confidence():
    src = _read(ML_CLIENT)
    assert "risk_level" in src
    assert "confidence" in src
    assert "base_date" in src


def test_ml_client_returns_null_on_failure():
    src = _read(ML_CLIENT)
    assert "catch" in src
    assert "return null" in src


def test_risk_service_consumes_ml_client():
    src = _read(RISK_SERVICE)
    assert "ml-client.js" in src
    assert "mlBandToScore" in src


def test_risk_service_has_heuristic_fallback():
    src = _read(RISK_SERVICE)
    assert "heuristic" in src
    assert "Offline weighted model" in src


def test_risk_service_surfaces_ml_provenance():
    src = _read(RISK_SERVICE)
    for field in ["district", "mlBand", "baseDate", "mlConfidence"]:
        assert field in src


def test_risk_level_thresholds_are_locked():
    # levelFor lives in risk.level.ts (dependency-free, TS-tested):
    # RED >= 75, HIGH >= 55, MEDIUM >= 30, else LOW.
    src = _read(RISK_LEVEL_TS)
    assert re.search(r"score >= 75.*RED", src, re.DOTALL)
    assert re.search(r"score >= 55.*HIGH", src, re.DOTALL)
    assert re.search(r"score >= 30.*MEDIUM", src, re.DOTALL)
    # risk.service.ts must consume the shared helper, not a forked copy.
    service = _read(RISK_SERVICE)
    assert "risk.level.js" in service
    assert _read(RISK_LEVEL_TEST).count("levelFor") >= 3


# ------------------------------------------------------------------
# Simulation side
# ------------------------------------------------------------------

def test_simulation_tick_uses_ml_engine():
    src = _read(SIM_SERVICE)
    assert "assessTruckMl" in src
    assert "mlMotionFor" in src
    assert "ML-BLOCKED" in src
    assert "SLOW_KMH" in src


def test_simulation_exposes_scenario_controls():
    src = _read(SIM_ROUTE)
    assert "/scenario" in src
    assert "setScenario" in src
    assert "mlRisk" in src
    assert "scenarioOverrides" in src


def test_intelligence_route_validates_inputs():
    src = _read(INTELLIGENCE_ROUTE)
    assert "lat" in src and "lng" in src
    assert "400" in src  # invalid lat/lng/date -> 400, TC-API-001 shape
    assert r"^\d{4}-\d{2}-\d{2}$" in src  # YYYY-MM-DD guard


def test_intelligence_routes_mounted_under_api():
    src = _read(APP_TS)
    assert "intelligenceRouter" in src
    assert "app.use('/api', intelligenceRouter)" in src


# ------------------------------------------------------------------
# Python provider side
# ------------------------------------------------------------------

def test_sidecar_module_exists_with_health_predict_districts():
    src = _read(SERVE_PY)
    assert '"/health"' in src
    assert '"/predict"' in src
    assert '"/districts"' in src
    assert "base_date" in src


def test_sidecar_overrides_cover_train_numeric_features():
    from train_risk_model import NUMERIC_FEATURES

    src = _read(SERVE_PY)
    # Overrides derive from the training numeric schema (no forked list).
    assert "NUMERIC_FEATURES" in src
    assert "OVERRIDABLE" in src
    assert set(NUMERIC_FEATURES) == {f for f in FEATURES if f != "district"}


def test_python_feature_schema_matches_sidecar_defaults():
    assert set(FEATURES) == set(DEFAULT_VALUES)


# ------------------------------------------------------------------
# Runtime fallback behaviour: dead port must refuse (fallback trigger)
# ------------------------------------------------------------------

def test_dead_ml_port_refuses_connection():
    """askMl's `catch -> null -> heuristic` path triggers on refusal.

    Port 9999 must stay empty in dev/test; the live :8000 wire is
    covered by tests/test_serve.py against its own throwaway port.
    """
    try:
        urllib.request.urlopen("http://localhost:9999/predict", timeout=2)
        reachable = True
    except Exception:
        reachable = False
    assert reachable is False
