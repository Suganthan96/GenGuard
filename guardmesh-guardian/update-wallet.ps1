# Update Guardian Wallet Script
# This script updates the .env file with your funded wallet

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  GuardMesh Guardian - Update Wallet" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "You need to use the same wallet that you used for:" -ForegroundColor Yellow
Write-Host "  0g-compute-cli login" -ForegroundColor Yellow
Write-Host "  0g-compute-cli deposit --amount 3" -ForegroundColor Yellow
Write-Host ""

$privateKey = Read-Host "Enter your private key (starts with 0x)"

if (-not $privateKey.StartsWith("0x")) {
    $privateKey = "0x" + $privateKey
}

# Update .env file
$envContent = @"
# 0G Network Configuration
PRIVATE_KEY=$privateKey
PROVIDER_ADDRESS=0xa48f01287233509FD694a22Bf840225062E67836
RPC_URL=https://evmrpc-testnet.0g.ai

# Guardian Configuration
GUARDIAN_ID=guardian-1
AXL_API_URL=http://127.0.0.1:9002

# Consensus Configuration
CONSENSUS_THRESHOLD=majority
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "✅ Wallet updated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Test the guardian: npm run test:simple" -ForegroundColor White
Write-Host "  2. Run full tests: npm test" -ForegroundColor White
Write-Host ""
