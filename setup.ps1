# SARATHI one-time setup for Windows PowerShell — run once per laptop (or after a fresh clone).
# Mirrors setup.sh (bash/macOS). Installs deps, creates the SQLite DB, and seeds demo data.
# Daily runs use .\dev.ps1 (no reseeding — your field reports survive).
#
# Usage in PowerShell (from the repo root):
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass   # only if scripts are blocked
#   .\setup.ps1
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Ok([string]$msg) { Write-Host "  [ok] $msg" -ForegroundColor Green }
function Warn([string]$msg) { Write-Host "  [!!] $msg" -ForegroundColor Yellow }

function Get-Python {
  foreach ($cmd in @("python", "python3", "py")) {
    try {
      $found = Get-Command $cmd -ErrorAction SilentlyContinue
      if ($found) { return $cmd }
    } catch {}
  }
  return $null
}

Write-Host "== SARATHI setup (Windows) ==" -ForegroundColor Cyan

# ── 1. backend .env ──────────────────────────────────────────────
if (-not (Test-Path "$Root\backend\.env")) {
  Copy-Item "$Root\backend\.env.example" "$Root\backend\.env"
  Write-Host "  [ok] created backend\.env from .env.example"
}
$envContent = Get-Content "$Root\backend\.env" -Raw -ErrorAction SilentlyContinue
if ($envContent -match "change-me") {
  Warn "backend\.env still has the placeholder JWT_SECRET."
  Warn "Generate one now, e.g.:  [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))"
  Warn "Login will NOT work until you replace it."
} else {
  Ok "backend\.env has a custom JWT_SECRET"
}

# ── 2. backend deps + DB + seed ──────────────────────────────────
Write-Host "-- backend: npm install"
Push-Location "$Root\backend"
try {
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install (backend) failed with exit code $LASTEXITCODE" }
  Ok "backend deps installed"

  Write-Host "-- backend: prisma migrate deploy"
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy failed with exit code $LASTEXITCODE" }
  Ok "database tables ready"

  Write-Host "-- backend: db:seed (8 incidents + 6 users + 5 trips)"
  npm run db:seed
  if ($LASTEXITCODE -ne 0) { throw "npm run db:seed failed with exit code $LASTEXITCODE" }
  Ok "demo data seeded"
} finally {
  Pop-Location
}

# ── 3. ML sidecar deps (skip if already importable) ──────────────
$Python = Get-Python
if (-not $Python) {
  Warn "no Python found (tried python/python3/py) — skipping ML deps. Install Python 3.12+ to run the sidecar."
} else {
  $importCheck = if ($Python -eq "py") { & py -3 -c "import fastapi, uvicorn" 2>$null; $LASTEXITCODE } else { & $Python -c "import fastapi, uvicorn" 2>$null; $LASTEXITCODE }
  if ($importCheck -eq 0) {
    Ok "python ML deps already present (fastapi + uvicorn)"
  } else {
    Write-Host "-- disaster-ml: pip install -r requirements.txt ($Python)"
    if ($Python -eq "py") { & py -3 -m pip install -r "$Root\backend\disaster-ml\requirements.txt" }
    else { & $Python -m pip install -r "$Root\backend\disaster-ml\requirements.txt" }
    if ($LASTEXITCODE -ne 0) { throw "pip install (disaster-ml) failed with exit code $LASTEXITCODE" }
    Ok "python ML deps installed"
  }
}

# ── 4. frontend deps ─────────────────────────────────────────────
Write-Host "-- frontend: npm install"
Push-Location "$Root\frontend"
try {
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install (frontend) failed with exit code $LASTEXITCODE" }
  Ok "frontend deps installed"
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "== Setup complete. Start everything with:  .\dev.ps1 ==" -ForegroundColor Green
Write-Host "   Logins: admin / sarathi@123  ·  AS-01-FOOD-04 / driver123"
