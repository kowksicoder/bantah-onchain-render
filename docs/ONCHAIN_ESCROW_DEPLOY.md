# Onchain Escrow Deployment (Testnet)

This project now includes a minimal escrow contract and Hardhat deploy flow.

## 1) Required env

Set these in `Onchain/.env`:

- `ADMIN_PRIVATE_KEY=0x...` (deployer wallet private key)
- `ADMIN_ADDRESS=0x...` (optional owner override; defaults to deployer)
- `ONCHAIN_BASE_SEPOLIA_RPC_URL=...`
- `ONCHAIN_BSC_TESTNET_RPC_URL=...`
- `ONCHAIN_ARBITRUM_SEPOLIA_RPC_URL=...`

## 2) Compile

```bash
npx hardhat compile
```

## 3) Deploy

Single chain:

```bash
npx hardhat run scripts/deploy-escrow.ts --network baseSepolia
npx hardhat run scripts/deploy-escrow.ts --network bscTestnet
npx hardhat run scripts/deploy-escrow.ts --network arbitrumSepolia
```

All chains (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-escrow-all.ps1
```

## 4) Wire deployed addresses

Put deployed addresses into env:

- `ONCHAIN_BASE_SEPOLIA_ESCROW_ADDRESS=0x...`
- `ONCHAIN_BSC_TESTNET_ESCROW_ADDRESS=0x...`
- `ONCHAIN_ARBITRUM_SEPOLIA_ESCROW_ADDRESS=0x...`

For current frontend helper defaults:

- `ONCHAIN_ESCROW_STAKE_METHOD_ERC20=depositToken(address,uint256)`
- `ONCHAIN_ESCROW_SETTLE_METHOD=settle()`

## 5) Enable contract mode

Set:

- `ONCHAIN_EXECUTION_MODE=contract`

Then restart the server.

## Notes

- This contract is a minimal custody + signaling vault for testnet integration.
- Final production-grade settlement/release constraints can be hardened in a subsequent contract iteration.
