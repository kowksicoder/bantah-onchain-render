$ErrorActionPreference = "Stop"

$networks = @(
  "base",
  "bsc",
  "arbitrum",
  "unichain"
)

foreach ($network in $networks) {
  Write-Host ""
  Write-Host "=== Deploying escrow V2 to $network ===" -ForegroundColor Cyan
  npx hardhat run scripts/deploy-escrow-v2.ts --network $network
  if ($LASTEXITCODE -ne 0) {
    throw "V2 deployment failed for network: $network"
  }
}

Write-Host ""
Write-Host "All escrow V2 mainnet deployments completed." -ForegroundColor Green
