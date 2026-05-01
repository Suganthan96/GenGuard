$ErrorActionPreference = "Continue"
$wslexe = "C:\Windows\System32\wsl.exe"

# Check Go version in WSL
Write-Host "=== Go version in WSL ==="
Start-Process -FilePath $wslexe -ArgumentList "sh -c go version" -PassThru -NoNewWindow -Wait -WindowStyle Hidden

Write-Host "=== Check if go.mod exists ==="
Start-Process -FilePath $wslexe -ArgumentList "sh -c ""ls /mnt/c/Users/Sugan/projects/open/axl/go.mod""" -PassThru -NoNewWindow -Wait -WindowStyle Hidden

Write-Host "=== Build node binary ==="
$build = Start-Process -FilePath $wslexe -ArgumentList "sh -c ""cd /mnt/c/Users/Sugan/projects/open/axl && GOTOOLCHAIN=auto go build -o node ./cmd/node/ 2>&1""" -PassThru -NoNewWindow -Wait -WindowStyle Hidden
Write-Host "Build exit code: $($build.ExitCode)"

Start-Sleep 2

Write-Host "=== Check new node file ==="
Start-Process -FilePath $wslexe -ArgumentList "sh -c ""ls -la /mnt/c/Users/Sugan/projects/open/axl/node""" -PassThru -NoNewWindow -Wait -WindowStyle Hidden

Write-Host "=== Check node file type ==="
Start-Process -FilePath $wslexe -ArgumentList "sh -c ""file /mnt/c/Users/Sugan/projects/open/axl/node""" -PassThru -NoNewWindow -Wait -WindowStyle Hidden
