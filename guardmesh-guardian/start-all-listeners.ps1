# Start three GuardianListener processes (hub + two spokes AXL ports).
# Prereq: AXL nodes on 9001/9002, 9011/9012, 9021/9022 — run axl/start-guardian-*.ps1 first.
# Each window: guardian-1:9002, guardian-2:9012, guardian-3:9022

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
Set-Location $here

$jobs = @(
  @{ Id = "guardian-1"; Port = 9002 },
  @{ Id = "guardian-2"; Port = 9012 },
  @{ Id = "guardian-3"; Port = 9022 }
)

foreach ($j in $jobs) {
  $cmd = "Set-Location '$here'; node start-guardian-listener.js $($j.Id) $($j.Port)"
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-Command",
    $cmd
  ) | Out-Null
  Write-Host "Started $($j.Id) on port $($j.Port) in a new window."
}

Write-Host ""
Write-Host "When all three show their public keys, run from repo root:"
Write-Host "  cd guardmesh-guardian && node print-axl-peer-env.mjs"
Write-Host "Then paste GUARDMESH_GUARDIAN_PEER_IDS=... into Web/.env.local"
