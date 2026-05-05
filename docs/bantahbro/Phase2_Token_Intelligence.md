# BantahBro Phase 2: Token Intelligence

Status: Implemented

Phase 2 gives BantahBro a read-only scanner. It does not create markets, spend BXBT, post alerts, or touch wallets.

## Endpoints

### Full Scan

```text
GET /api/bantahbro/scan/:tokenAddress?chainId=solana
GET /api/bantahbro/scan/:chainId/:tokenAddress
```

Returns:

- token and pair summary
- aggregate liquidity and volume
- rug score
- momentum score
- suggested read-only action
- generated rug or runner post candidate

By default, the response hides the full pair list to keep payloads small.

Use:

```text
?includePairs=true
```

to include normalized pair snapshots.

### Rug Score

```text
GET /api/bantahbro/rug-score/:tokenAddress?chainId=solana
GET /api/bantahbro/rug-score/:chainId/:tokenAddress
```

Returns:

- primary pair
- rug score
- risk level
- reasons
- missing signals
- rug post candidate

### Momentum Score

```text
GET /api/bantahbro/momentum-score/:tokenAddress?chainId=solana
GET /api/bantahbro/momentum-score/:chainId/:tokenAddress
```

Returns:

- primary pair
- momentum score
- momentum level
- reasons
- runner post candidate

## Data Source

Initial source:

- DexScreener token pair API.
- Moralis holder APIs when `MORALIS_API_KEY` is configured.

Current fields used:

- pair age
- liquidity
- volume
- buy/sell transaction counts
- price change
- market cap
- FDV
- active boosts
- holder count
- top holder concentration where available
- top 10 holder supply percentage where available
- holder growth where available

## Scoring Limits

DexScreener and Moralis do not provide every signal BantahBro ultimately needs.

Missing or partially covered Phase 2 signals:

- liquidity lock percentage
- contract flags
- deployer wallet history
- holder distribution on chains without Moralis support or without `MORALIS_API_KEY`

The scanner reports those as `missingSignals` instead of pretending they were checked.

## Moralis Setup

Set this in local `.env` or deployment environment:

```env
MORALIS_API_KEY=your_key_here
```

Never commit a real Moralis key.

Moralis endpoints used:

- Solana holder metrics: `https://solana-gateway.moralis.io/token/{network}/holders/{address}`
- Solana top holders: `https://solana-gateway.moralis.io/token/{network}/{address}/top-holders`
- EVM top holders: `https://deep-index.moralis.io/api/v2.2/erc20/{token_address}/owners`

## Files

- `shared/bantahBro.ts`
- `server/bantahBro/tokenIntelligence.ts`
- `server/routes/bantahBroApi.ts`
- `tsconfig.bantahbro.json`

## Verification

Focused typecheck:

```bash
npx.cmd tsc --project tsconfig.bantahbro.json
```

Smoke scan used:

```text
chainId=solana
tokenAddress=So11111111111111111111111111111111111111112
```
