$ErrorActionPreference = "Continue"
$wslexe = "C:\Windows\System32\wsl.exe"
$arg = "sh -c 'cd /mnt/c/Users/Sugan/projects/open/axl && ./node -config node-config.json'"
$proc = Start-Process -FilePath $wslexe -ArgumentList $arg -PassThru -WindowStyle Hidden
Write-Host "WSL process started: $($proc.Id)"
Start-Sleep 5
$netstat = netstat -ano | Select-String "9001|9002|7000"
if ($netstat) {
    Write-Host "Ports found:"
    $netstat | ForEach-Object { Write-Host $_ }
} else {
    Write-Host "Ports 9001/9002/7000 not listening yet"
}
