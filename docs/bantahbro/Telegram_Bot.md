# BantahBro Telegram Bot

This repo now exposes BantahBro through a dedicated Telegram bot config.

It does not share the platform bot token or channel keys.

Primary mode is now the official Eliza Telegram plugin.

## Current model

- Inbound BantahBro Telegram chat is handled by the managed Eliza runtime.
- `@elizaos/plugin-telegram` is the primary transport.
- The old custom BantahBro bot path is now legacy / fallback only.
- A dedicated BantahBro bot instance can still be used for outbound broadcasts, alerts, receipts, and challenge cards.
- Platform alignment notes live in `docs/bantahbro/Eliza_Platform_Integration.md`.

## Telegram interaction phases

Telegram-1 callback/state alignment is active:

- `/start` uses inline `bb:*` callback buttons.
- Button taps are handled by the Eliza Telegram service's Telegraf bot.
- Token flows keep pending per-chat/per-user state for 10 minutes.
- If a user taps Analyze, Rug Score, Runner Score, or Create Market, they can paste the token in the next message.

Telegram-2 real interactive menus are active for:

- Analyze Token
- Rug Score
- Runner Score
- Live Alerts
- Live Markets
- Leaderboard
- BXBT Status
- Create Market

Telegram-3 group behavior is controlled by the BantahBro character templates:

- Private chats are interactive and helpful.
- Groups are selective, shorter, and trigger on mentions, replies, slash commands, Bantah/BXBT terms, token questions, or strong trading claims.

Telegram-4 production webhook setup remains host-dependent:

- The managed Eliza plugin currently owns inbound Telegram operation.
- Legacy webhook routes remain available only for the fallback custom bot mode.
- Production should keep one inbound owner active at a time to avoid double replies.

## Eliza-first behavior

When these are set:

- `BANTAHBRO_TELEGRAM_BOT_TOKEN`
- `BANTAHBRO_TELEGRAM_USE_ELIZA_PLUGIN=true`

BantahBro is booted with:

- `clients: ["telegram"]`
- `@elizaos/plugin-telegram` in the managed runtime
- Telegram settings injected into the Eliza character/runtime

Startup then:

1. ensures the BantahBro system agent exists
2. provisions or restores the real AgentKit wallet
3. repairs runtime config if Telegram plugin settings or character profile are missing
4. starts the managed Eliza runtime
5. starts BantahBro automation loops for watchlist scans, scheduled receipts, and auto-market triggers when enabled

In this mode, Telegram is handled through Eliza polling / launch. A BantahBro webhook URL is not the primary path.

## Chat behavior

Private Telegram:

- BantahBro should be interactive and helpful.
- It should answer token, market, leaderboard, BXBT, and receipt questions directly.
- It should suggest next actions like scanning, opening a market, or checking receipts.

Telegram groups:

- BantahBro should be more selective.
- It should mainly respond when mentioned, replied to, called with a command, or when the message is clearly about Bantah, BXBT, token calls, or market conviction.
- In groups it should stay shorter and more provocative.

Later Twitter/X:

- The character templates are already prepared for a Twitter mode.
- The live Twitter transport is still scaffolded and not yet active in this repo.

## Knowledge layers

BantahBro now has a static knowledge provider in the Eliza runtime:

- Static corpus: `docs/bantahbro/knowledge/`
- Provider: `BANTAHBRO_KNOWLEDGE_CONTEXT`
- Architecture note: `docs/bantahbro/Knowledge_Base.md`

Static knowledge is for Bantah, BXBT, market rules, Telegram help, chains, and safety.

Live prices, token scans, balances, leaderboards, and market status still come from live APIs/providers only.

## Legacy custom-bot behavior

If `BANTAHBRO_TELEGRAM_USE_ELIZA_PLUGIN=false`, BantahBro falls back to the older custom Telegram bot wiring.

That legacy mode still supports:

- `/analyze <token>`
- `/analyze <chain> <token>`
- `/rug <token>`
- `/runner <token>`
- `/alerts`
- `/markets`
- `/create <token>`
- `/leaderboard`
- `/friends`
- `/bxbt`
- inline buttons for create market, view chart, open Bantah, and receipt checks

## Environment

Required:

- `BANTAHBRO_TELEGRAM_BOT_TOKEN`
- `BANTAHBRO_TELEGRAM_CHANNEL_ID`

Recommended:

- `BANTAHBRO_TELEGRAM_BOT_USERNAME`
- `BANTAHBRO_TELEGRAM_USE_ELIZA_PLUGIN=true`
- `BANTAHBRO_TELEGRAM_ALLOWED_CHATS=["123456789"]`
- `BANTAHBRO_TELEGRAM_BOT_ENABLE_WEBHOOK=true`
- `BANTAHBRO_TELEGRAM_BOT_WEBHOOK_URL=https://your-app-host/api/telegram/bantahbro-webhook`
- `BANTAHBRO_TELEGRAM_DEFAULT_CHAIN=solana`
- `BANTAHBRO_TELEGRAM_CHARGE_BXBT_MARKETS=false`
- `BANTAHBRO_AUTOMATION_ENABLED=true`
- `BANTAHBRO_TOKEN_WATCHLIST=solana:So11111111111111111111111111111111111111112`
- `BANTAHBRO_AUTO_MARKET_ENABLED=true`

## Webhook behavior

Webhook registration is only relevant to the legacy custom BantahBro bot mode.

If `BANTAHBRO_TELEGRAM_USE_ELIZA_PLUGIN=false` and `BANTAHBRO_TELEGRAM_BOT_ENABLE_WEBHOOK` is not set to `false`, startup will try to register the webhook automatically.

Resolution order:

1. `BANTAHBRO_TELEGRAM_BOT_WEBHOOK_URL`
2. `RENDER_EXTERNAL_URL + /api/telegram/bantahbro-webhook`

## Notes

- Eliza-mode inbound chat is now the main path and main goal.
- Outbound BantahBro alerts can still use the dedicated BantahBro bot instance while Eliza owns inbound chat.
- Legacy slash-command behavior remains available only when the custom bot path is enabled.
- `/friends` reads the user's linked Bantah friend list once their Telegram account is linked.
- Token scans use the same DexScreener and Moralis-backed BantahBro intelligence layer as the web API.
- If AgentKit provisioning fails, BantahBro Telegram startup fails before the managed runtime can come up.
- Twitter monitor and reply loops are scaffolded for later and remain disabled until the live Twitter transport is wired.

## Supported chain shortcuts

- `solana`
- `base`
- `arbitrum`
- `bsc`
