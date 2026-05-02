# Start Guardian Node 1 (Hub node)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Write-Host "Starting Guardian Node 1 (Hub)..." -ForegroundColor Green
Write-Host "ENS: guardian-1.guardmesh.eth" -ForegroundColor Yellow
Write-Host "ENS Link: https://sepolia.app.ens.domains/guardian-1.guardmesh.eth" -ForegroundColor Yellow
Write-Host "API Port: 9002" -ForegroundColor Cyan
Write-Host "Listen: tls://127.0.0.1:9001" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot
# Use wslpath — many distros use /mnt/host/c/... not /mnt/c/...; manual /mnt/c breaks "No such file or directory".
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
wsl.exe sh -c "cd '$unix' && ./node -config node-config.json"
