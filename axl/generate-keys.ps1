# PowerShell script to generate ed25519 keys and configuration files for the axl node test

# Add System.Security.Cryptography assembly
Add-Type -AssemblyName System.Security.Cryptography

# Generate first private key
$keyAlgorithm = [System.Security.Cryptography.ED25519]::Create()
$privateKeyBytes = $keyAlgorithm.ExportSeed()

# Convert to base64 for PEM format
$base64Key = [Convert]::ToBase64String($privateKeyBytes)

# Create PEM format for first key
$pemContent1 = "-----BEGIN PRIVATE KEY-----`n"
$pemContent1 += [Convert]::ToBase64String($keyAlgorithm.ExportPkcs8PrivateKey())
$pemContent1 += "`n-----END PRIVATE KEY-----"

# Write first private key
Set-Content -Path "private.pem" -Value $pemContent1
Write-Host "Generated private.pem"

# Generate second private key
$keyAlgorithm2 = [System.Security.Cryptography.ED25519]::Create()
$pemContent2 = "-----BEGIN PRIVATE KEY-----`n"
$pemContent2 += [Convert]::ToBase64String($keyAlgorithm2.ExportPkcs8PrivateKey())
$pemContent2 += "`n-----END PRIVATE KEY-----"

# Write second private key
Set-Content -Path "private-2.pem" -Value $pemContent2
Write-Host "Generated private-2.pem"

# Create first config file
$config1 = @{
    "PrivateKeyPath" = "private.pem"
    "Peers" = @()
} | ConvertTo-Json

Set-Content -Path "node-config.json" -Value $config1
Write-Host "Generated node-config.json"

# Create second config file
$config2 = @{
    "PrivateKeyPath" = "private-2.pem"
    "Peers" = @()
    "Listen" = @()
    "api_port" = 9012
    "tcp_port" = 7001
} | ConvertTo-Json

Set-Content -Path "node-config-2.json" -Value $config2
Write-Host "Generated node-config-2.json"

Write-Host "Done! Keys and config files created."
Write-Host "Files created: private.pem, private-2.pem, node-config.json, node-config-2.json"
