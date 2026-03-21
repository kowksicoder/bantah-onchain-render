# Official Bantah AI Agent Onchain API Contract

Status
- Code-derived from the current onchain repo on 2026-03-20.
- This is an internal contract document, not a formal OpenAPI or Postman export.
- Source of truth is the code in `server/routes.ts`, `server/storage.ts`, `server/onchainEscrowService.ts`, `server/privyAuth.ts`, `server/adminAuth.ts`, `server/pairingEngine.ts`, `shared/schema.ts`, and `shared/onchainConfig.ts`.

Scope
- This document covers the onchain API surface the official Bantah AI agent can use for wallet binding, onchain challenge creation, acceptance, queue/join flows, proofs, votes, consensus release, final settlement recording, and related retrieval endpoints.

Environment and access model
- Base URLs are not hardcoded in source. Infra must provide canonical production and staging URLs.
- Browser CORS is restricted to `FRONTEND_URL`, so the intended integration path is server-to-server.
- The agent needs first-party internal access. Public read routes are not enough.

Auth model in code
- Main product auth: `Authorization: Bearer <Privy token>` via `PrivyAuthMiddleware`.
- `PrivyAuthMiddleware` also allows Passport session fallback when no bearer token is present.
- Local session auth and Replit OIDC still exist in this repo, but they are not the right long-term agent path.
- Canonical AI-agent path: delegated internal bearer tokens with `acting_as: <userId>`.
- Admin auth in this repo is stronger than the offchain repo:
  - primary format: signed token with prefix `adm1`
  - legacy `admin_<userId>_<timestamp>` fallback can also be allowed by env
- Several write routes also require a wallet via `requireOnchainWallet`.

Delegated AI agent auth
- Canonical header: `Authorization: Bearer <agent token>`
- Token format: `agt1.<payload>.<signature>`
- Required payload claims:
  - `sub`: internal service id such as `service:bantah-ai-agent`
  - `acting_as`: Bantah `users.id` for the logged-in user the agent is acting for
  - `iat`
  - `exp`
- Optional payload claims:
  - `scopes`
  - `aud`
  - `nonce`
- Verification secret: `AGENT_TOKEN_SECRET`
- Optional controls:
  - `AGENT_TOKEN_TTL_MS`
  - `AGENT_TOKEN_AUDIENCE`
- Effective behavior:
  - the token resolves `acting_as` to a real Bantah user
  - `req.user` is populated as that delegated user, including wallet fields when present
  - protected routes behind `PrivyAuthMiddleware` accept the token
  - optional-auth routes such as `GET /api/challenges` and `GET /api/wallet/balance` also recognize the delegated user
- Admin rule:
  - admin routes only work if `acting_as` is an actual admin user and the token carries `admin:access` or wildcard admin scope

Delegated token example
```json
{
  "v": 1,
  "sub": "service:bantah-ai-agent",
  "acting_as": "user_123",
  "scopes": ["challenges:read", "challenges:write", "wallet:read"],
  "aud": "bantah-onchain",
  "iat": 1760000000,
  "exp": 1760000900
}
```

Wallet enforcement
- Wallet can be supplied from:
  - `x-wallet-address` header
  - `walletAddress` in request body
  - Privy-linked wallet
  - stored `primaryWalletAddress`
  - stored `walletAddresses`
- If wallet enforcement is enabled and no wallet is found, route returns:
```json
{
  "message": "Wallet required. Connect an EVM wallet to continue.",
  "code": "WALLET_REQUIRED"
}
```

Identity model
- Canonical internal user key: `users.id`
- Public identity: username-backed routes such as `/u/:username`
- Wallet-linked identity fields:
  - `primaryWalletAddress`
  - `walletAddresses`
- Telegram fields also exist
- No X or Twitter identity mapping contract was found in backend code
- Vote signing uses a separate user-level public key set via `POST /api/users/me/signing-key`

Onchain runtime and configuration

### GET /api/onchain/config
- Auth: none
- Response: full `ONCHAIN_CONFIG`
- Includes:
  - `defaultChainId`
  - `defaultToken`
  - `enforceWallet`
  - `executionMode`
  - `contractEnabled`
  - supported `chains`

### GET /api/onchain/status
- Auth: none
- Response: runtime status summary including:
  - execution mode
  - wallet enforcement status
  - configured chains
  - configured token support
  - warnings when contract mode is misconfigured

Supported chains and tokens in checked-in config
- Tokens: `USDC`, `USDT`, `ETH`, `BNB`
- Chains:
  - Base
  - Base Sepolia
  - Arbitrum One
  - Arbitrum Sepolia
  - BNB Smart Chain
  - BSC Testnet
  - Celo Mainnet
  - Celo Sepolia
  - Unichain
  - Unichain Sepolia
- Default chain id in code: `84532` which is Base Sepolia

Challenge fields specific to onchain settlement
- `settlementRail`
- `chainId`
- `tokenSymbol`
- `tokenAddress`
- `stakeAtomic`
- `decimals`
- `escrowTxHash`
- `settleTxHash`
- `challengedWalletAddress`

Status values observed in code
- Core values: `open`, `pending`, `active`, `completed`, `cancelled`
- Dispute path writes `dispute`
- Schema comments still mention `disputed`
- Admin/scheduler code also uses `pending_admin`

Deep links and routing
- Canonical detail route used in sharing helpers: `/challenges/:id`
- Share activity route: `/challenges/:id/activity`
- Chat route: `/challenges/:id/chat`
- Legacy aliases also exist: `/challenge/:id`, `/challenge/:id/activity`, `/challenge/:id/chat`

Challenge retrieval

### GET /api/challenges/public
- Auth: none
- Purpose: public admin-created challenge feed

### GET /api/challenges
- Auth: optional in practice
- Behavior:
  - if no authenticated user or `feed=all`, returns `storage.getAllChallengesFeed(100)`
  - otherwise returns `storage.getChallenges(userId)`
- Onchain storage also considers wallet-targeted direct challenges through `challengedWalletAddress`

### GET /api/challenges/:id
- Auth: none
- Response:
```json
{
  "...challenge fields": "...",
  "onchainExecution": {
    "mode": "metadata_only|contract",
    "contractEnabled": true
  }
}
```

### GET /api/challenges/:id/activity
- Auth: none
- Purpose: synthetic activity timeline

### GET /api/challenges/:id/matches
- Auth: none in this repo
- Response: queue-match records joined with user objects

Wallet binding and signing prerequisites

### PUT /api/users/me/wallet
- Auth: required
- Body:
```json
{
  "walletAddress": "0x..."
}
```
- Response:
```json
{
  "success": true,
  "primaryWalletAddress": "0x...",
  "walletAddresses": ["0x..."]
}
```

### POST /api/users/me/signing-key
- Auth: required
- Body:
```json
{
  "publicKey": "base64 public signing key"
}
```
- Response:
```json
{
  "success": true,
  "result": {}
}
```

Onchain challenge creation and participation

### POST /api/challenges
- Auth: required
- Wallet: required
- Body:
```json
{
  "title": "string",
  "category": "string",
  "amount": 5000,
  "description": "string optional",
  "dueDate": "ISO string optional",
  "challenged": "userId optional",
  "challengedWalletAddress": "0x... optional",
  "challengerSide": "YES|NO optional",
  "chainId": 84532,
  "tokenSymbol": "USDC",
  "walletAddress": "0x... optional",
  "escrowTxHash": "0x... required in contract mode"
}
```
- Validation:
  - `title` required
  - `category` required
  - `amount` required, positive integer, maximum `1000000`
  - `chainId` must map to configured chain
  - `tokenSymbol` must map to configured token
  - non-native tokens are checked against `assertAllowedStakeToken()`
- Behavior:
  - `settlementRail` forced to `onchain`
  - `stakeAtomic`, `tokenAddress`, `decimals`, `chainId`, and `tokenSymbol` are stored
  - if `challenged` or `challengedWalletAddress` is present, status starts as `pending`
  - otherwise status starts as `open`
  - in contract mode:
    - `escrowTxHash` is required
    - tx is verified against chain, sender, escrow contract, and token
    - reused tx hashes are rejected
- Response:
```json
{
  "...challenge fields": "...",
  "onchainExecution": {
    "mode": "metadata_only|contract",
    "contractEnabled": true
  }
}
```

### POST /api/challenges/:id/accept
- Auth: required
- Wallet: required
- Body in contract mode:
```json
{
  "escrowTxHash": "0x..."
}
```
- Behavior:
  - rejects admin-created open challenges and points caller to join flow
  - if `challengedWalletAddress` exists and no `challenged` user exists yet, current wallet must match target wallet
  - in contract mode:
    - verifies `escrowTxHash`
    - rejects reused escrow tx hashes
    - merges the new tx hash into `challenge.escrowTxHash`
- Response: updated challenge plus `onchainExecution`

### POST /api/challenges/:id/join
- Auth: required
- Wallet: required
- Purpose: join admin-created YES/NO challenge
- Body:
```json
{
  "stake": "YES",
  "escrowTxHash": "0x... required in contract mode"
}
```
- Validation:
  - challenge must be admin-created
  - challenge must be `open`
  - `stake` must be `YES` or `NO`
  - amount must equal challenge amount
  - in contract mode, tx verification is required
- Response:
```json
{
  "success": true,
  "challenge": {},
  "message": "..."
}
```

### POST /api/challenges/:id/queue/join
- Auth: required
- Wallet: required
- Body:
```json
{
  "side": "YES",
  "stakeAmount": 5000,
  "escrowTxHash": "0x... required in contract mode"
}
```
- Validation:
  - challenge must be admin-created
  - challenge must be `open`
  - `side` must be `YES` or `NO`
  - `stakeAmount` must be a positive integer
  - in this repo, `stakeAmount` must exactly equal `challenge.amount`
  - in contract mode, escrow tx verification is required
- Response:
```json
{
  "success": true,
  "challenge": {},
  "message": "Added to YES queue. Your stake is held in escrow.",
  "escrowId": 123,
  "totalPot": 10000,
  "queuePosition": 1
}
```

### POST /api/challenges/:id/queue/cancel
- Auth: required
- Purpose: cancel caller queue entry
- Response: pairing engine result object

### GET /api/challenges/:id/queue/status
- Auth: required
- Response:
```json
{
  "challenge": {},
  "yesQueue": 0,
  "noQueue": 0,
  "yesStakeTotal": 0,
  "noStakeTotal": 0
}
```

### GET /api/challenges/:id/queue/user-status
- Auth: required
- Response:
```json
{
  "status": "not_joined|waiting|matched|cancelled",
  "side": "YES|NO",
  "stakeAmount": 5000,
  "matchedWith": "userId or null",
  "matchedAt": "timestamp or null",
  "joinedAt": "timestamp or null"
}
```

Proofs, votes, release, and settlement

### GET /api/challenges/:id/proofs
- Auth: required
- Access: participants only
- Response: proof rows

### POST /api/challenges/:id/proofs
- Auth: required
- Body:
```json
{
  "proofUri": "https://...",
  "proofHash": "sha256:..."
}
```
- Response: created proof row

### GET /api/challenges/:id/votes
- Auth: required
- Access: participants or admins
- Response is normalized by route:
```json
[
  {
    "userId": "user_123",
    "choice": "challenger|challenged",
    "timestamp": "2026-03-20T12:00:00.000Z",
    "proofHash": "sha256:..."
  }
]
```

### POST /api/challenges/:id/vote
- Auth: required
- Wallet: required
- Body:
```json
{
  "voteChoice": "challenger|challenged|creator|opponent",
  "proofHash": "sha256:...",
  "signedVote": "{\"signature\":\"...\",\"timestamp\":1710000000000,\"nonce\":\"abc123\"}"
}
```
- Preconditions:
  - user must have registered signing key
  - signed payload must be fresh and nonce-unique
  - signed message format is `${challengeId}:${voteChoice}:${proofHash}:${timestamp}:${nonce}`
- Response:
```json
{
  "success": true,
  "vote": {}
}
```

### POST /api/challenges/:id/try-release
- Auth: required
- Wallet: required
- Body: none
- Behavior:
  - fewer than 2 votes: returns `released: false`
  - mismatched votes: updates challenge status to `dispute`
  - matching votes on onchain challenge:
    - if `contractEnabled`, route records consensus result only and returns `reason: awaiting_onchain_settlement`
    - if not contract mode, challenge can be completed directly
- Response:
```json
{
  "released": false,
  "reason": "awaiting_onchain_settlement",
  "onchainExecution": {
    "mode": "metadata_only|contract",
    "contractEnabled": true
  }
}
```

### POST /api/challenges/:id/onchain/settle
- Auth: required
- Wallet: required
- Access: participants or admins
- Challenge must have `settlementRail=onchain`
- Contract mode must be enabled
- Body:
```json
{
  "settleTxHash": "0x...",
  "result": "challenger_won|challenged_won|draw optional"
}
```
- Behavior:
  - verifies settlement tx against selected chain and escrow contract
  - rejects reused settle tx hashes
  - if both participant votes agree, consensus result is used
  - admins may override with `result`
  - non-admin callers cannot settle without consensus
  - if requested result conflicts with consensus, route returns `409`
  - successful settlement updates:
    - `settleTxHash`
    - `result`
    - `status=completed`
    - `completedAt`
- Response:
```json
{
  "challenge": {},
  "result": "challenger_won",
  "settlementTx": {
    "hash": "0x...",
    "chainId": 84532,
    "recordedBy": "0x..."
  },
  "onchainExecution": {
    "mode": "metadata_only|contract",
    "contractEnabled": true
  }
}
```

### POST /api/challenges/:id/dispute
- Auth: required
- Body:
```json
{
  "reason": "string optional"
}
```
- Effect:
  - challenge status updated to `dispute`
  - state history written
  - admins and counterparties notified

Messages and collaboration

### GET /api/challenges/:id/messages
- Auth: optional bearer
- Access:
  - non-admin challenges: participants only
  - admin challenges: public read is allowed
- This is more permissive than the offchain repo

### POST /api/challenges/:id/messages
- Auth: required
- Body:
```json
{
  "message": "string",
  "type": "text",
  "evidence": null
}
```
- Access:
  - non-admin challenges: participants only
  - admin challenges: any authenticated user

Wallet and funding prerequisites

### GET /api/wallet/balance
- Auth: optional in current route
- Behavior:
  - if user is not authenticated, returns `{ "balance": 0, "coins": 0 }`
  - otherwise returns actual internal wallet balance

### GET /api/transactions
- Auth: required
- Response: transaction list

### POST /api/wallet/deposit
- Auth: required
- Purpose: initialize Paystack deposit

### POST /api/wallet/verify-payment
- Auth: required
- Purpose: verify Paystack payment and credit internal balance

### POST /api/wallet/swap
- Auth: required
- Purpose: internal money/coins swap path

### POST /api/wallet/withdraw
- Auth: required
- Warning:
  - this route is defined twice in `server/routes.ts`
  - behavior appears inconsistent between immediate completion and pending-request handling

Transaction verification contract
- `verifyEscrowTransaction()` checks:
  - tx hash format
  - transaction exists on selected chain
  - receipt status is success
  - sender matches expected wallet
  - destination matches configured escrow contract
  - chain id matches expected chain
  - native token transactions carry positive value
- Non-native stake tokens are checked by `assertAllowedStakeToken()`
- The code can block:
  - explicitly blocked token addresses
  - token names or symbols matching blocked keywords
  - mintable test tokens when strict block is enabled

Contract surface

### BantahEscrow
- `lockStakeNative()`
- `lockStakeToken(address,uint256)`
- `depositToken(address,uint256)`
- `settleChallenge()`
- `settleChallenge(uint256,uint8)`
- `settle()`
- `settle(uint256,uint8)`
- `logChallengeCreated(uint256,bytes32,string)`
- `withdrawNative(address,uint256)`
- `withdrawToken(address,address,uint256)`

### BantahEscrow events
- `OwnershipTransferred`
- `StakeLockedNative`
- `StakeLockedToken`
- `ChallengeSettledSignal`
- `ChallengeCreatedLogged`
- `NativeWithdrawn`
- `TokenWithdrawn`

Important architecture note
- The onchain contract is not the full adjudication engine.
- Current comments and route behavior show:
  - the contract handles custody and emits signals
  - the backend still verifies txs and records the final challenge outcome

Known inconsistencies and open questions
- Auth is mixed between Privy bearer, local session auth, and Replit OIDC.
- This repo uses signed admin tokens, while the offchain repo still uses legacy admin tokens.
- Storage writes `status='dispute'`, but schema comments and some guards still refer to `disputed`.
- `pending_admin` exists in admin/scheduler flows but is not cleanly reflected in the main schema comment.
- `GET /api/wallet/balance` is optional-auth here, unlike the offchain repo.
- `GET /api/challenges/:id/messages` allows public reads for admin-created challenges here, unlike the offchain repo.
- `POST /api/track-share` exists twice.
- Notification routes are defined both inline and in mounted router files.
- `server/telegramMiniAppApi.ts` defines extra mini-app routes, but its registration function does not appear mounted.
- There is a hardcoded fallback Privy secret in source and it should be removed after rotation.

Recommended AI-agent integration stance
- Treat this repo as an internal API, not a public developer API.
- Prefer server-to-server bearer auth over session flows.
- For onchain writes, treat wallet binding and tx-hash verification as required preconditions.
- Do not assume `try-release` completes an onchain challenge in contract mode.
- Treat final completion as occurring only after `POST /api/challenges/:id/onchain/settle`.
