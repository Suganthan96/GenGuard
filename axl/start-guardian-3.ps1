# Start Guardian Node 3
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Write-Host "Starting Guardian Node 3..." -ForegroundColor Green
Write-Host "ENS: guardian-3.guardmesh.eth" -ForegroundColor Yellow
Write-Host "ENS Link: https://sepolia.app.ens.domains/guardian-3.guardmesh.eth" -ForegroundColor Yellow
Write-Host "API Port: 9022" -ForegroundColor Cyan
Write-Host "Peers: tls://127.0.0.1:9001" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot
$winPath = ((Resolve-Path $PSScriptRoot).Path) -replace '\\', '/'
$raw = & wsl.exe wslpath -a $winPath 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "wslpath failed for: $winPath`nOutput: $raw`nOpen WSL and run: wslpath -a '$winPath'"
}
$unix = [string]$raw
if ([string]::IsNullOrWhiteSpace($unix) -or ($unix -notmatch '^/')) {
    Write-Error "wslpath returned invalid path: $unix"
}
$unix = $unix.Trim()
Write-Host "WSL cwd: $unix" -ForegroundColor DarkGray
wsl.exe sh -c "cd '$unix' && ./node -config node-config-3.json"
