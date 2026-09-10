#!/usr/bin/env bash
# SARATHI daily runner — starts backend + ML sidecar + frontend with one line.
# Usage:  ./dev.sh
# Ctrl-C stops all three. Run ./setup.sh first (once per laptop).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS=()

cleanup() {
  echo ""
  echo "-- stopping all services..."
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
  echo "all stopped."
}
trap cleanup INT TERM EXIT

port_busy() { lsof -i ":$1" >/dev/null 2>&1; }

# ── pre-flight ───────────────────────────────────────────────────
[ -f "$ROOT/backend/.env" ] || { echo "missing backend/.env — run ./setup.sh first"; exit 1; }
for port in 5001 8000 5173; do
  if port_busy "$port"; then
    echo "port $port is already in use. Kill the stale process first:"
    echo "  lsof -i :$port   # then:  kill <PID>"
    exit 1
  fi
done

# ── 1. backend API :5001 ─────────────────────────────────────────
echo "-- starting backend :5001"
(cd "$ROOT/backend" && PORT=5001 npx tsx src/index.ts 2>&1 | sed 's/^/[api] /') &
PIDS+=($!)

# ── 2. ML sidecar :8000 (warning only if it fails — backend degrades) ──
echo "-- starting ML sidecar :8000"
(cd "$ROOT/backend/disaster-ml/src" && python3 -m uvicorn serve:app --port 8000 2>&1 | sed 's/^/[ml] /') &
PIDS+=($!)

# ── 3. frontend :5173 ────────────────────────────────────────────
echo "-- starting frontend :5173"
(cd "$ROOT/frontend" && npm run dev -- --port 5173 2>&1 | sed 's/^/[web] /') &
PIDS+=($!)

# ── readiness: wait for backend + sidecar health ─────────────────
echo "-- waiting for services..."
for i in $(seq 1 30); do
  curl -sf -m 2 http://localhost:5001/api/health >/dev/null 2>&1 && break
  sleep 1
done
curl -sf -m 2 http://localhost:5001/api/health >/dev/null \
  && echo "  [ok] backend :5001" \
  || { echo "  [!!] backend did not answer /api/health — check [api] logs above"; exit 1; }

# Sidecar loads the ML model at boot (~30s), so give it up to 60s.
# Still warning-only: backend runs on heuristic fallback without it.
sidecar_up=0
for i in $(seq 1 30); do
  if curl -sf -m 2 http://localhost:8000/health >/dev/null 2>&1; then sidecar_up=1; break; fi
  sleep 2
done
if [ "$sidecar_up" = "1" ]; then
  echo "  [ok] ML sidecar :8000"
else
  echo "  [!!] sidecar not up — backend runs on heuristic fallback (fine for demo)"
fi

echo ""
echo "== SARATHI is live =="
echo "   frontend : http://localhost:5173"
echo "   backend  : http://localhost:5001/api/health"
echo "   logins   : admin / sarathi@123  ·  AS-01-FOOD-04 / driver123"
echo "   dates    : 2026-07-19 onset · 2026-07-28 peak · 2026-08-09 relief"
echo "   Ctrl-C to stop everything."
echo ""
wait
