# Mesh test: prefer Windows Python (WSL localhost forward); else WSL python3.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-Host "Running: python test-nodes.py (Windows)" -ForegroundColor Cyan
    python test-nodes.py
    exit $LASTEXITCODE
}
$unix = (wsl wslpath -a $PSScriptRoot).Trim()
Write-Host "Running: wsl python3 in $unix" -ForegroundColor Cyan
wsl sh -c "cd '$unix' && python3 test-nodes.py"
exit $LASTEXITCODE
