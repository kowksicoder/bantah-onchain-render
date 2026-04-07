# Onchain Escrow Deployment

This project includes:

- `BantahEscrow.sol`
  Legacy minimal custody + signaling vault.
- `BantahEscrowV2.sol`
  Treasury-aware escrow with loser-side fee routing and challenge-aware stake tracking.

## 1) Required env

Set these in `Onchain/.env`:

- `ADMIN_PRIVATE_KEY=0x...` (deployer wallet private key)
- `ADMIN_ADDRESS=0x...` (optional owner override; defaults to deployer)
- `ONCHAIN_TREASURY_ADDRESS=0x...` (fallback treasury for V2; can also be chain-specific)
- `ONCHAIN_ESCROW_FEE_PPM=180` (`0.018%`; V2 only)
- `ONCHAIN_BASE_SEPOLIA_RPC_URL=...`
- `ONCHAIN_BSC_TESTNET_RPC_URL=...`
- `ONCHAIN_ARBITRUM_SEPOLIA_RPC_URL=...`

Optional chain-specific treasury / fee overrides:

- `ONCHAIN_BASE_SEPOLIA_TREASURY_ADDRESS=0x...`
- `ONCHAIN_BSC_TESTNET_TREASURY_ADDRESS=0x...`
- `ONCHAIN_ARBITRUM_SEPOLIA_TREASURY_ADDRESS=0x...`
- `ONCHAIN_BASE_SEPOLIA_ESCROW_FEE_PPM=180`
- `ONCHAIN_BSC_TESTNET_ESCROW_FEE_PPM=180`
- `ONCHAIN_ARBITRUM_SEPOLIA_ESCROW_FEE_PPM=180`

## 2) Compile

```bash
npx hardhat compile
```

## 3) Deploy legacy escrow

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

## 4) Deploy V2 treasury-aware escrow

Single chain:

```bash
npx hardhat run scripts/deploy-escrow-v2.ts --network baseSepolia
npx hardhat run scripts/deploy-escrow-v2.ts --network bscTestnet
npx hardhat run scripts/deploy-escrow-v2.ts --network arbitrumSepolia
```

All chains (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-escrow-v2-all.ps1
```

Active mainnet rollout for Bantah's current 4-chain setup:

```bash
npm run onchain:deploy:v2:base-mainnet
npm run onchain:deploy:v2:bsc-mainnet
npm run onchain:deploy:v2:arb-mainnet
npm run onchain:deploy:v2:unichain-mainnet
```

All four active mainnets:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-escrow-v2-mainnets.ps1
```

`BantahEscrowV2` constructor args:

- `owner`
- `treasury`
- `feePpm`

Default `feePpm=180` means `0.018%`.

## 5) Wire deployed addresses

Single chain:

```bash
npx hardhat run scripts/deploy-escrow.ts --network baseSepolia
npx hardhat run scripts/deploy-escrow.ts --network bscTestnet
npx hardhat run scripts/deploy-escrow.ts --network arbitrumSepolia
```

All chains (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-escrow-v2-all.ps1
```

Put deployed addresses into env:

- `ONCHAIN_BASE_SEPOLIA_ESCROW_ADDRESS=0x...`
- `ONCHAIN_BSC_TESTNET_ESCROW_ADDRESS=0x...`
- `ONCHAIN_ARBITRUM_SEPOLIA_ESCROW_ADDRESS=0x...`

For current frontend helper defaults:

- `ONCHAIN_ESCROW_STAKE_METHOD_ERC20=depositToken(address,uint256)`
- `ONCHAIN_ESCROW_SETTLE_METHOD=settle()`

For V2 treasury-aware config:

- `ONCHAIN_TREASURY_ADDRESS=0x...`
- `ONCHAIN_ESCROW_FEE_PPM=180`

## 6) Enable contract mode

Set:

- `ONCHAIN_EXECUTION_MODE=contract`

Then restart the server.

## Notes

- `BantahEscrowV2` adds challenge-aware methods for future full onchain payout routing:
  - `lockStakeNativeForChallenge(uint256 challengeId)`
  - `lockStakeTokenForChallenge(uint256 challengeId,address token,uint256 amount)`
  - `settleChallengeNativePayout(...)`
  - `settleChallengeTokenPayout(...)`
  - `refundChallengeNative(...)`
  - `refundChallengeToken(...)`
- Create flow now uses a draft-first V2 path on chains where `ONCHAIN_*_ESCROW_SUPPORTS_CHALLENGE_LOCK=true`.
- Join and accept flows will use challenge-aware V2 lock methods on those chains and automatically fall back to legacy generic lock methods on V1 chains.
- Old markets can keep settling against the old contract. Point new deployments to the V2 address once you are ready to switch.
