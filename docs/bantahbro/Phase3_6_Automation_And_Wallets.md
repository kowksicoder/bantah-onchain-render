# BantahBro Phases 3-6

This slice completes the backend path for:

- live token alerts
- receipt tracking
- market creation from strong signals
- market boosts
- BantahBro system agent provisioning
- BXBT spend and reward actions

## Routes

Public reads:

- `GET /api/bantahbro/alerts/live?limit=50`
- `GET /api/bantahbro/alerts/:alertId`
- `GET /api/bantahbro/boosts/live?limit=50`
- `GET /api/bantahbro/scan/:tokenAddress?chainId=solana`
- `GET /api/bantahbro/scan/:chainId/:tokenAddress`
- `GET /api/bantahbro/rug-score/:tokenAddress?chainId=solana`
- `GET /api/bantahbro/rug-score/:chainId/:tokenAddress`
- `GET /api/bantahbro/holders/:tokenAddress?chainId=solana`
- `GET /api/bantahbro/holders/:chainId/:tokenAddress`
- `GET /api/bantahbro/momentum-score/:tokenAddress?chainId=solana`
- `GET /api/bantahbro/momentum-score/:chainId/:tokenAddress`
- `GET /api/bantahbro/receipts/:tokenAddress?chainId=solana`
- `GET /api/bantahbro/receipts/:chainId/:tokenAddress`
- `GET /api/bantahbro/system-agent/status`
- `GET /api/bantahbro/bxbt/status`

Admin writes:

- `POST /api/bantahbro/alerts/publish`
- `POST /api/bantahbro/receipts/evaluate`
- `POST /api/bantahbro/markets/create-from-signal`
- `POST /api/bantahbro/markets/boost`
- `POST /api/bantahbro/system-agent/ensure`
- `POST /api/bantahbro/system-agent/reprovision-wallet`
- `POST /api/bantahbro/bxbt/spend`
- `POST /api/bantahbro/bxbt/reward`

All admin writes require `PrivyAuthMiddleware` plus an admin user.

## Example payloads

Publish an alert:

```json
{
  "chainId": "solana",
  "tokenAddress": "So11111111111111111111111111111111111111112",
  "mode": "auto"
}
```

Create a market from a signal:

```json
{
  "sourceAlertId": "bb_alert_123",
  "durationHours": 6,
  "stakeAmount": "10",
  "currency": "ETH",
  "executionChainId": 42161,
  "chargeBxbt": true
}
```

Create a market directly from a token scan:

```json
{
  "chainId": "bsc",
  "tokenAddress": "0x0000000000000000000000000000000000000000",
  "durationHours": 24,
  "stakeAmount": "10",
  "currency": "BNB",
  "executionChainId": 56,
  "question": "Will this 2x in 24h?",
  "chargeBxbt": false
}
```

Boost a market:

```json
{
  "sourceAlertId": "bb_alert_123",
  "marketId": "42",
  "multiplier": 2,
  "durationHours": 6,
  "chargeBxbt": true
}
```

Evaluate a receipt:

```json
{
  "sourceAlertId": "bb_alert_123"
}
```

Spend BXBT:

```json
{
  "amount": "25",
  "reason": "Market creation fee"
}
```

Reward BXBT:

```json
{
  "recipientAddress": "0x0000000000000000000000000000000000000000",
  "amount": "10",
  "reason": "Top signal reward"
}
```

## Environment

Required for phase 3 intelligence:

- `DEXSCREENER_API_BASE`
- `MORALIS_API_KEY`
- `MORALIS_SOLANA_API_BASE`
- `MORALIS_EVM_API_BASE`

Required for live AgentKit wallet:

- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET`
- `CDP_WALLET_SECRET`
- `BANTAHBRO_AGENT_CHAIN_ID`

Required for BXBT utility:

- `BANTAHBRO_BXBT_TOKEN_ADDRESS`
- `BANTAHBRO_BXBT_CHAIN_ID`
- `BANTAHBRO_BXBT_DECIMALS`
- `BANTAHBRO_BXBT_TREASURY_ADDRESS`
- `BANTAHBRO_BXBT_MARKET_CREATION_COST`
- `BANTAHBRO_BXBT_BOOST_UNIT_COST`
- `BANTAHBRO_BXBT_REWARD_AMOUNT`

Optional chain-specific BXBT envs:

- `BANTAHBRO_BXBT_TOKEN_ADDRESS_BASE`
- `BANTAHBRO_BXBT_TOKEN_ADDRESS_ARBITRUM`
- `BANTAHBRO_BXBT_TOKEN_ADDRESS_BSC`
- `BANTAHBRO_BXBT_DECIMALS_BASE`
- `BANTAHBRO_BXBT_DECIMALS_ARBITRUM`
- `BANTAHBRO_BXBT_DECIMALS_BSC`
- `BANTAHBRO_BXBT_TREASURY_ADDRESS_BASE`
- `BANTAHBRO_BXBT_TREASURY_ADDRESS_ARBITRUM`
- `BANTAHBRO_BXBT_TREASURY_ADDRESS_BSC`

## Notes

- BantahBro now fails hard if AgentKit or BXBT env config is missing. There is no demo wallet path.
- BXBT is handled as a BantahBro utility token layer and does not replace the existing runtime stake token union.
- Market creation reuses the existing Bantah agent runtime skill path instead of a separate parallel engine.
- `BANTAHBRO_DEFAULT_EXECUTION_CHAIN_ID` lets you set the default market-execution chain separately from the system-agent wallet chain.
- Token intelligence already works for DexScreener and Moralis-supported chains like Base, Arbitrum, and BSC when you pass the right `chainId`.
