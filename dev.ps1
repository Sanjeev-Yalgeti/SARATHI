# SARATHI Windows PowerShell daily runner
# Usage in PowerShell: .\dev.ps1
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host "== Starting SARATHI Services ==" -ForegroundColor Cyan

# Pre-flight check
if (-not (Test-Path "$Root\backend\.env")) {
    Write-Host "Missing backend\.env - run setup first!" -ForegroundColor Red
    exit 1
}

# Start backend
Write-Host "-- Starting backend on port 5001..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    $env:PORT = "5001"
    npx tsx src/index.ts
} -ArgumentList "$Root\backend"

# Start frontend
Write-Host "-- Starting frontend on port 5173..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    npm run dev -- --port 5173
} -ArgumentList "$Root\frontend"

# Wait for backend readiness
Write-Host "-- Waiting for services to answer..." -ForegroundColor Gray
$backendReady = $false
for ($i = 1; $i -le 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:5001/api/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($res.ok -eq $true) {
            $backendReady = $true
            break
        }
    } catch {}
}

if ($backendReady) {
    Write-Host "  [ok] Backend :5001 is ready" -ForegroundColor Green
} else {
    Write-Host "  [!!] Backend did not respond in 30 seconds" -ForegroundColor Red
}

Write-Host ""
Write-Host "== SARATHI is live ==" -ForegroundColor Green
Write-Host "   Frontend : http://localhost:5173" -ForegroundColor White
Write-Host "   Backend  : http://localhost:5001/api/health" -ForegroundColor White
Write-Host "   Logins   : admin / sarathi@123  |  AS-01-FOOD-04 / driver123" -ForegroundColor White
Write-Host "   Dates    : 2026-07-19 onset | 2026-07-28 peak | 2026-08-09 relief" -ForegroundColor White
Write-Host "   Press Ctrl+C to stop all services." -ForegroundColor Yellow
Write-Host ""

try {
    while ($true) {
        Receive-Job $backendJob | ForEach-Object { Write-Host "[api] $_" -ForegroundColor Cyan }
        Receive-Job $frontendJob | ForEach-Object { Write-Host "[web] $_" -ForegroundColor Green }
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`n-- Stopping services..." -ForegroundColor Yellow
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue
    Write-Host "All services stopped." -ForegroundColor Green
}
