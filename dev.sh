#!/usr/bin/env bash
# SARATHI daily runner — starts backend + ML sidecar + frontend with one line.
# Usage:  ./dev.sh [--force]
#   --force  auto-kill anything already holding ports 5001/8000/5173
#            (stale servers from earlier runs) instead of refusing to start.
# Ctrl-C stops all three. Run ./setup.sh first (once per laptop).
set -euo pipefail

FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
    *) echo "unknown flag: $arg (only --force is supported)"; exit 1 ;;
  esac
done

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

port_busy() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -i ":$1" >/dev/null 2>&1
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ano 2>/dev/null | grep -q ":$1"
  else
    return 1
  fi
}

kill_port() {
  local port="$1" pid
  for pid in $(lsof -ti ":$port" 2>/dev/null); do
    # Never kill ourselves or our own process group.
    if [ "$pid" != "$$" ]; then kill "$pid" 2>/dev/null || true; fi
  done
  sleep 2
  for pid in $(lsof -ti ":$port" 2>/dev/null); do
    if [ "$pid" != "$$" ]; then kill -9 "$pid" 2>/dev/null || true; fi
  done
  sleep 1
}

# ── pre-flight ───────────────────────────────────────────────────
[ -f "$ROOT/backend/.env" ] || { echo "missing backend/.env — run ./setup.sh first"; exit 1; }
for port in 5001 8000 5173; do
  if port_busy "$port"; then
    if [ "$FORCE" = "1" ]; then
      echo "-- port $port busy: killing stale holder (--force)"
      kill_port "$port"
      if port_busy "$port"; then
        echo "  [!!] could not free port $port — kill it manually: lsof -i :$port"
        exit 1
      fi
      echo "  [ok] port $port freed"
    else
      echo "port $port is already in use. Either stop it, or rerun with:"
      echo "  ./dev.sh --force   # auto-kill stale holders on 5001/8000/5173"
      exit 1
    fi
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
