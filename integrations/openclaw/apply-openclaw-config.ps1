# Merges GuardMesh skill dir + bridge env for OpenClaw (Windows).
# Run from repo root or anywhere:  powershell -File integrations/openclaw/apply-openclaw-config.ps1

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillsDir = Join-Path $here "skills"
$bridge = Join-Path $here "guardmesh-bridge.mjs"
$ocDir = Join-Path $env:USERPROFILE ".openclaw"
$ocJson = Join-Path $ocDir "openclaw.json"

if (!(Test-Path $skillsDir)) { throw "Missing skills dir: $skillsDir" }
if (!(Test-Path $bridge)) { throw "Missing bridge: $bridge" }

New-Item -ItemType Directory -Force -Path $ocDir | Out-Null

$skillsDirJson = ($skillsDir -replace "\\", "/")
$extra = @($skillsDirJson)

if (Test-Path $ocJson) {
  $raw = Get-Content -Raw -Path $ocJson
  try {
    $cfg = $raw | ConvertFrom-Json
  } catch {
    throw "Existing openclaw.json is not valid JSON. Fix or rename it, then re-run."
  }
  if (-not $cfg.skills) { $cfg | Add-Member -NotePropertyName skills -NotePropertyValue (@{}) }
  if (-not $cfg.skills.load) { $cfg.skills | Add-Member -NotePropertyName load -NotePropertyValue (@{}) }
  $dirs = @()
  if ($cfg.skills.load.extraDirs) { $dirs = @($cfg.skills.load.extraDirs) }
  if ($dirs -notcontains $skillsDirJson) { $dirs += $skillsDirJson }
  $cfg.skills.load | Add-Member -NotePropertyName extraDirs -NotePropertyValue $dirs -Force
  $cfg | ConvertTo-Json -Depth 20 | Set-Content -Path $ocJson -Encoding UTF8
} else {
  $cfg = [ordered]@{
    skills = [ordered]@{
      load = [ordered]@{
        extraDirs = $extra
      }
    }
  }
  ($cfg | ConvertTo-Json -Depth 20) | Set-Content -Path $ocJson -Encoding UTF8
}

setx GUARDMESH_BRIDGE_SCRIPT $bridge | Out-Null
$toolsFrag = Join-Path $here "openclaw.recommended-tools-fragment.json"
Write-Host "Wrote $ocJson"
Write-Host "Set user env GUARDMESH_BRIDGE_SCRIPT = $bridge"
Write-Host "Optional OpenClaw tools snippet (merge into openclaw.json by hand): $toolsFrag"
Write-Host "Open a NEW terminal (or restart OpenClaw Gateway) so setx is visible."
