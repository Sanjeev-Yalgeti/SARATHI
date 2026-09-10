"""Live tests for the prediction sidecar (src/serve.py).

Spins up `uvicorn serve:app` on a throwaway port per session, so these
tests prove the real HTTP wire the Node backend calls — not a mock.

Run with the backend venv deps installed (fastapi, uvicorn):
    python -m pytest tests/test_serve.py -v
"""

import json
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

SRC_DIR = Path(__file__).resolve().parents[1] / "src"
PORT = 8123
BASE = f"http://localhost:{PORT}"


def _wait_for_health(timeout_s: float = 30.0) -> dict:
    deadline = time.time() + timeout_s
    last_error = "unknown"
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{BASE}/health", timeout=2) as response:
                return json.load(response)
        except Exception as error:  # server still booting
            last_error = str(error)
            time.sleep(0.5)
    raise RuntimeError(f"Sidecar never became healthy: {last_error}")


@pytest.fixture(scope="module")
def sidecar():
    proc = subprocess.Popen(
        ["python3", "-m", "uvicorn", "serve:app", "--port", str(PORT)],
        cwd=str(SRC_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        health = _wait_for_health()
        assert health["status"] == "ok"
        yield BASE
    finally:
        proc.terminate()
        proc.wait(timeout=15)


def _post(base: str, path: str, body: dict):
    request = urllib.request.Request(
        base + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def _get(base: str, path: str):
    with urllib.request.urlopen(base + path, timeout=10) as response:
        return response.status, json.load(response)


def test_health_reports_model_and_dataset(sidecar):
    status, health = _get(sidecar, "/health")
    assert status == 200
    assert health["model_loaded"] is True
    assert health["dataset_rows"] == 84
    assert "2026-07-28" in health["dates"]


def test_predict_exact_row(sidecar):
    status, result = _post(
        sidecar, "/predict", {"district": "Sivasagar", "date": "2026-08-09"}
    )
    assert status == 200
    assert result["source"] == "ml"
    assert result["risk_level"] in {"LOW", "MODERATE", "HIGH", "CRITICAL"}
    assert result["base_date"] == "2026-08-09"
    assert abs(sum(result["probabilities"].values()) - 1.0) < 1e-4


def test_predict_sparse_date_falls_back_transparently(sidecar):
    # Sivasagar has no 2026-07-28 row: prediction stands on the most
    # recent earlier row and says so (no silent fabrication).
    status, result = _post(
        sidecar, "/predict", {"district": "Sivasagar", "date": "2026-07-28"}
    )
    assert status == 200
    assert result["base_date"] == "2026-07-27"
    assert result["date"] == "2026-07-28"
    assert result["risk_level"] == "CRITICAL"


def test_predict_unknown_district_is_422(sidecar):
    status, body = _post(
        sidecar, "/predict", {"district": "Atlantis", "date": "2026-07-28"}
    )
    assert status == 422
    assert "Unknown district" in body["detail"]


def test_predict_rejects_unknown_override_key(sidecar):
    status, body = _post(
        sidecar,
        "/predict",
        {"district": "Cachar", "date": "2026-07-20", "overrides": {"slope_gradient": 5}},
    )
    assert status == 422
    assert "Unknown override" in body["detail"]


def test_predict_rejects_negative_override(sidecar):
    status, body = _post(
        sidecar,
        "/predict",
        {"district": "Cachar", "date": "2026-07-20", "overrides": {"rainfall_mm": -3}},
    )
    assert status == 422


def test_what_if_rainfall_never_lowers_severity(sidecar):
    # Ordinal monotonicity on the documented severity order: drowning a
    # district in rain must not make the engine calmer.
    order = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "CRITICAL": 3}
    _, calm = _post(sidecar, "/predict", {"district": "Cachar", "date": "2026-07-20"})
    _, storm = _post(
        sidecar,
        "/predict",
        {
            "district": "Cachar",
            "date": "2026-07-20",
            "overrides": {"rainfall_mm": 300, "river_danger_level_count": 5},
        },
    )
    assert order[storm["risk_level"]] >= order[calm["risk_level"]]


def test_districts_lists_peak_dates(sidecar):
    status, body = _get(sidecar, "/districts?date=2026-07-28")
    assert status == 200
    assert "Kamrup Metropolitan" in body["districts"]
