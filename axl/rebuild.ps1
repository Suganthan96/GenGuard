$ErrorActionPreference = "Continue"
$wslexe = "C:\Windows\System32\wsl.exe"
$axldir = "/mnt/c/Users/Sugan/projects/open/axl"

Write-Host "=== Building node binary in WSL ==="
$build = Start-Process -FilePath $wslexe -ArgumentList "sh -c ""cd $axldir && GOTOOLCHAIN=auto go build -o node ./cmd/node/ 2>&1""" -PassThru -NoNewWindow -Wait -WindowStyle Hidden
$buildOutput = @()
if ($build.ExitCode -ne 0) {
    Write-Host "Build failed with exit code: $($build.ExitCode)"
} else {
    Write-Host "Build succeeded"
}

Start-Sleep 2

Write-Host "=== Checking new node binary ==="
Start-Process -FilePath $wslexe -ArgumentList "sh -c ""file $axldir/node && ls -la $axldir/node""" -PassThru -NoNewWindow -Wait -WindowStyle Hidden
