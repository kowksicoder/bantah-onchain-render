# BantahBro Action Map

Version: Phase 1

## 1. Eliza Character

File:

- `docs/bantahbro/BantahBro_Character.json`

Owns:

- identity
- template id, replaced by the live agent id at runtime
- tone
- post examples
- chat examples
- style rules
- personality safety
- plugin declarations

## 2. Plugin Actions

### `analyzeToken`

Layer:

- read-only intelligence

Input:

- token address
- chain id

Output:

- normalized token analysis

Dependencies:

- DexScreener
- Pump.fun source
- onchain wallet/deployer source

### `calculateRugScore`

Layer:

- scoring

Input:

- token analysis

Output:

- score
- risk level
- reasons

### `calculateMomentumScore`

Layer:

- scoring

Input:

- token analysis

Output:

- score
- momentum level
- reasons

### `generateRugPost`

Layer:

- content

Input:

- token analysis
- rug score

Output:

- short post text
- optional card metadata

### `generateRunnerPost`

Layer:

- content

Input:

- token analysis
- momentum score

Output:

- short post text
- optional card metadata

### `generateAftermathPost`

Layer:

- content

Input:

- original signal
- current token state

Output:

- aftermath post text
- receipt metadata

### `recordReceipt`

Layer:

- memory and growth

Input:

- signal id
- token state at call
- current token state

Output:

- receipt record
- performance multiple
- follow-up market suggestion

### `broadcastAlert`

Layer:

- distribution

Input:

- alert type
- alert data

Output:

- feed item
- optional social post

### `createMarket`

Layer:

- Bantah market

Input:

- token
- condition
- duration
- resolution rules

Output:

- market id
- market url
- tx hash when onchain

### `createP2PMarket`

Layer:

- Bantah market

Input:

- challenger handle
- opponent handle
- question
- duration
- stake token
- chain id

Output:

- market id
- market url
- participant handles
- tx hash when onchain

### `joinMarket`

Layer:

- Bantah market

Input:

- market id
- side
- amount

Output:

- position id
- tx hash when onchain

### `readBantahLeaderboard`

Layer:

- Bantah market intelligence

Input:

- optional limit
- optional timeframe

Output:

- top agents
- top users
- top calls
- rank deltas

### `boostMarket`

Layer:

- BXBT utility

Input:

- market id
- multiplier
- duration

Output:

- boost id
- BXBT spent
- expiry

### `callOutUser`

Layer:

- distribution and market creation

Input:

- username
- claim

Output:

- call-out post
- optional market draft

### `launchTokenForUser`

Layer:

- token launch

Input:

- requester identity
- token name
- token symbol
- launch chain
- optional image url
- optional website
- optional social post url
- optional fee recipient

Output:

- token address
- pool or launch id
- launch tx hash
- trading url
- fee routing summary

Rules:

- explicit user intent required
- no ambiguous social text
- no silent deploy
- return confirmation summary before execution when possible

### `generateTokenLaunchPost`

Layer:

- content and distribution

Input:

- token launch result
- creator handle
- chain

Output:

- timeline-ready post
- shareable receipt
- trading link

## 3. Always-On Services

### `tokenRadarService`

Watches:

- fresh launches
- token pairs
- liquidity shifts
- volume spikes

Emits:

- token launch events
- suspicious activity events
- runner candidate events

### `rugMonitorService`

Consumes:

- token analysis events

Runs:

- rug score
- rug alert generation
- rug market suggestion

### `runnerMonitorService`

Consumes:

- token analysis events

Runs:

- momentum score
- runner alert generation
- runner market suggestion

### `receiptService`

Consumes:

- historical calls
- token price updates

Runs:

- 2x, 5x, 10x detection
- receipt generation
- follow-up market suggestions

### `bantahMarketOpsService`

Consumes:

- Bantah onchain api
- managed skill runtime
- market requests

Runs:

- create market
- create p2p market
- read live markets
- read leaderboard
- monitor market lifecycle

### `bxbtUtilityService`

Consumes:

- market actions
- premium scan requests
- boosts
- rewards

Runs:

- BXBT access checks
- BXBT spends
- BXBT rewards
- leaderboard updates

### `tokenLaunchService`

Consumes:

- explicit user launch requests
- social command requests
- optional partner launch api

Runs:

- launch draft validation
- fee routing validation
- token deployment
- launch receipt generation
- launch timeline post
- creator notification

## 4. API Routes

### `GET /api/bantahbro/scan/:tokenAddress`

Returns:

- token analysis
- rug score
- momentum score
- suggested action

### `GET /api/bantahbro/rug-score/:tokenAddress`

Returns:

- rug score
- reasons
- risk level

### `GET /api/bantahbro/alerts/live`

Returns:

- latest alert feed

### `POST /api/bantahbro/market/create-from-signal`

Creates:

- Bantah market from a validated signal

### `POST /api/bantahbro/p2p/create`

Creates:

- Bantah p2p market from two named sides

### `GET /api/bantahbro/leaderboard`

Returns:

- top agents
- top users
- top calls

### `POST /api/bantahbro/token-launch/draft`

Creates:

- preflight launch summary
- fee split preview
- chain selection

### `POST /api/bantahbro/token-launch/execute`

Creates:

- live token launch
- tx hash
- trading url

### `GET /api/bantahbro/receipts/:tokenAddress`

Returns:

- past BantahBro calls
- performance
- follow-up markets

## 5. Build Order

1. Character config.
2. Read-only token analysis. Implemented in `server/bantahBro/tokenIntelligence.ts`.
3. Rug and momentum scoring. Implemented in `server/bantahBro/tokenIntelligence.ts`.
4. Post generation.
5. Live alert feed.
6. Bantah market creation.
7. Bantah leaderboard and p2p market ops.
8. BXBT gating and boosts.
9. Token launch service.
10. Public BantahBro routes.

Phase 2 route docs live in `docs/bantahbro/Phase2_Token_Intelligence.md`.
