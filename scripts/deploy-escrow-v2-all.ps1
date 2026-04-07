$ErrorActionPreference = "Stop"

$networks = @(
  "baseSepolia",
  "bscTestnet",
  "arbitrumSepolia",
  "celoSepolia",
  "unichainSepolia"
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
Write-Host "All escrow V2 deployments completed." -ForegroundColor Green
