# BantahBro Knowledge Base

Version: v1

BantahBro uses three knowledge layers. This keeps the agent sharp without letting stale data leak into live market answers.

## 1. Static Knowledge Corpus

Source directory:

`docs/bantahbro/knowledge/`

Used for stable product and behavior questions:

- Bantah product rules
- BXBT utility rules
- market creation rules
- P2P market rules
- token-launch boundaries
- Telegram command help
- safety policy
- supported chains and action capabilities

Runtime path:

- Plugin: `server/bantahBroKnowledgePlugin.ts`
- Provider name: `BANTAHBRO_KNOWLEDGE_CONTEXT`

Rule:

BantahBro may use static knowledge for product, BXBT, market-rule, Telegram, chain-support, and safety-policy answers.

## 2. Live Market Knowledge

Used for volatile state that must not come from static docs:

- DexScreener token and pair data
- Moralis token intelligence
- Bantah leaderboard
- Bantah live markets
- wallet and BXBT balance state
- current token prices
- recent alerts and receipts

Runtime paths:

- `server/bantahBro/tokenIntelligence.ts`
- `server/bantahBroLiveMarketPlugin.ts`
- `server/bantahBro/communityService.ts`
- `server/bantahBro/bxbtUtility.ts`
- `server/bantahBro/marketService.ts`

Rule:

If the answer depends on current price, balance, leaderboard, or market status, BantahBro must use live APIs/providers.

## 3. Memory And State

Used for interaction context:

- pending Telegram menu action
- user preferences
- recent scans
- recent alert context
- group context
- recent market/receipt history

Runtime paths:

- Telegram callback state: `server/bantahBroTelegramCommandsPlugin.ts`
- alert memory: `server/bantahBro/alertFeed.ts`
- Eliza runtime memory adapter: `server/bantahElizaRuntimeMemoryAdapter.ts`

Rule:

Memory helps BantahBro continue a conversation. It must not be treated as proof of live market truth.
