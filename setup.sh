#!/usr/bin/env bash
# SARATHI one-time setup — run once per laptop (or after a fresh clone).
# Installs deps, creates the SQLite DB, and seeds demo data.
# Daily runs use ./dev.sh (no reseeding — your field reports survive).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ok()  { printf '  [ok] %s\n' "$1"; }
warn() { printf '  [!!] %s\n' "$1"; }

echo "== SARATHI setup =="

# ── 1. backend .env ──────────────────────────────────────────────
if [ ! -f "$ROOT/backend/.env" ]; then
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  echo "  [ok] created backend/.env from .env.example"
fi
if grep -q "change-me" "$ROOT/backend/.env" 2>/dev/null; then
  warn "backend/.env still has the placeholder JWT_SECRET."
  warn "Generate one now:  openssl rand -base64 48"
  warn "Login will NOT work until you replace it."
else
  ok "backend/.env has a custom JWT_SECRET"
fi

# ── 2. backend deps + DB + seed ──────────────────────────────────
echo "-- backend: npm install"
(cd "$ROOT/backend" && npm install --no-audit --no-fund)
ok "backend deps installed"

echo "-- backend: prisma migrate deploy"
(cd "$ROOT/backend" && npx prisma migrate deploy)
ok "database tables ready"

echo "-- backend: db:seed (8 incidents + 4 users + 3 trips)"
(cd "$ROOT/backend" && npm run db:seed)
ok "demo data seeded"

# ── 3. ML sidecar deps (skip if already importable) ──────────────
if python3 -c "import fastapi, uvicorn" 2>/dev/null; then
  ok "python ML deps already present (fastapi + uvicorn)"
else
  echo "-- disaster-ml: pip install -r requirements.txt"
  python3 -m pip install -r "$ROOT/backend/disaster-ml/requirements.txt"
  ok "python ML deps installed"
fi

# ── 4. frontend deps ─────────────────────────────────────────────
echo "-- frontend: npm install"
(cd "$ROOT/frontend" && npm install --no-audit --no-fund)
ok "frontend deps installed"

echo ""
echo "== Setup complete. Start everything with:  ./dev.sh =="
echo "   Logins: admin / sarathi@123  ·  AS-01-FOOD-04 / driver123"
