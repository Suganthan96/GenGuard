$ErrorActionPreference = "Continue"
$wslexe = "C:\Windows\System32\wsl.exe"

# Test 1: Simple ls
Write-Host "=== Test 1: ls /mnt/c/Users/Sugan/projects/open/axl ==="
$proc1 = Start-Process -FilePath $wslexe -ArgumentList "sh -c ""ls /mnt/c/Users/Sugan/projects/open/axl""" -PassThru -NoNewWindow -Wait -WindowStyle Hidden
Write-Host "Exit code: $($proc1.ExitCode)"

Start-Sleep 1

# Test 2: Run node with version flag or help
Write-Host "=== Test 2: node --version ==="
$proc2 = Start-Process -FilePath $wslexe -ArgumentList "sh -c ""cd /mnt/c/Users/Sugan/projects/open/axl && ./node --help 2>&1""" -PassThru -NoNewWindow -Wait -WindowStyle Hidden
Write-Host "Exit code: $($proc2.ExitCode)"

Start-Sleep 1

# Test 3: Check if node binary is executable
Write-Host "=== Test 3: file node ==="
$proc3 = Start-Process -FilePath $wslexe -ArgumentList "sh -c ""cd /mnt/c/Users/Sugan/projects/open/axl && file node""" -PassThru -NoNewWindow -Wait -WindowStyle Hidden
Write-Host "Exit code: $($proc3.ExitCode)"
