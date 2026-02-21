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
  Write-Host "=== Deploying escrow to $network ===" -ForegroundColor Cyan
  npx hardhat run scripts/deploy-escrow.ts --network $network
  if ($LASTEXITCODE -ne 0) {
    throw "Deployment failed for network: $network"
  }
}

Write-Host ""
Write-Host "All escrow deployments completed." -ForegroundColor Green
