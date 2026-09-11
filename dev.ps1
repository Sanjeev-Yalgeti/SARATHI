# SARATHI Windows PowerShell daily runner
# Usage in PowerShell: .\dev.ps1
$ErrorActionPreference = "Continue"
$Root = $PSScriptRoot

Write-Host "== Starting SARATHI Services ==" -ForegroundColor Cyan

# Pre-flight check
if (-not (Test-Path "$Root\backend\.env")) {
    Write-Host "Missing backend\.env - run setup first!" -ForegroundColor Red
    exit 1
}

# Clean up any stale processes occupying ports 5001, 5173, or 8000
foreach ($p in @(5001, 5173, 8000)) {
    try {
        $pids = (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
        foreach ($procId in $pids) {
            if ($procId -gt 0) {
                Write-Host "  Freeing port $p (stopping PID $procId)..." -ForegroundColor DarkGray
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}
}

# Start Disaster-ML Python service
Write-Host "-- Starting Disaster-ML engine on port 8000..." -ForegroundColor Yellow
$mlJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    python -m uvicorn serve:app --port 8000
} -ArgumentList "$Root\backend\disaster-ml\src"

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

# Wait for backend and ML readiness
Write-Host "-- Waiting for services to answer..." -ForegroundColor Gray
$backendReady = $false
$mlReady = $false
for ($i = 1; $i -le 30; $i++) {
    Start-Sleep -Seconds 1
    if (-not $backendReady) {
        try {
            $res = Invoke-RestMethod -Uri "http://localhost:5001/api/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($res.ok -eq $true) {
                $backendReady = $true
            }
        } catch {}
    }
    if (-not $mlReady) {
        try {
            $mres = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($mres.status -eq "ok") {
                $mlReady = $true
            }
        } catch {}
    }
    if ($backendReady -and $mlReady) {
        break
    }
}

if ($mlReady) {
    Write-Host "  [ok] Disaster-ML :8000 is ready (RandomForest)" -ForegroundColor Green
} else {
    Write-Host "  [--] Disaster-ML did not respond, backend will use heuristic fallback" -ForegroundColor Yellow
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
Write-Host "   ML Engine: http://localhost:8000/health" -ForegroundColor White
Write-Host "   Logins   : admin / sarathi@123  |  AS-01-FOOD-04 / driver123" -ForegroundColor White
Write-Host "   Dates    : 2026-07-19 onset | 2026-07-28 peak | 2026-08-09 relief" -ForegroundColor White
Write-Host "   Press Ctrl+C to stop all services." -ForegroundColor Yellow
Write-Host ""

try {
    while ($true) {
        $mlLogs = Receive-Job $mlJob -ErrorAction SilentlyContinue
        if ($mlLogs) {
            $mlLogs | ForEach-Object { Write-Host "[ml]  $_" -ForegroundColor Magenta }
        }

        $apiLogs = Receive-Job $backendJob -ErrorAction SilentlyContinue
        if ($apiLogs) {
            $apiLogs | ForEach-Object { Write-Host "[api] $_" -ForegroundColor Cyan }
        }

        $webLogs = Receive-Job $frontendJob -ErrorAction SilentlyContinue
        if ($webLogs) {
            $webLogs | ForEach-Object { Write-Host "[web] $_" -ForegroundColor Green }
        }

        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`n-- Stopping services..." -ForegroundColor Yellow
    Stop-Job $mlJob -ErrorAction SilentlyContinue
    Remove-Job $mlJob -ErrorAction SilentlyContinue
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue

    # Clean up processes listening on 5001, 5173, 8000
    foreach ($p in @(5001, 5173, 8000)) {
        try {
            $pids = (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
            foreach ($procId in $pids) {
                if ($procId -gt 0) {
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                }
            }
        } catch {}
    }
    Write-Host "All services stopped." -ForegroundColor Green
}
