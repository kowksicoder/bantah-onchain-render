# BantahBro Eliza Platform Integration

Version: v1

This note maps BantahBro to the official Eliza platform integration pattern.

## Telegram

Official pattern:

- `plugins: [bootstrapPlugin, telegramPlugin]`
- `clients: ["telegram"]`
- `settings.TELEGRAM_BOT_TOKEN`
- custom actions can return `buttons` with `callback_data`
- callback handlers read `message.content.callback_data`
- production may use webhook, but only one inbound owner should be active

BantahBro implementation:

- Runtime plugin: `@elizaos/plugin-telegram`
- Custom runtime plugins:
  - `server/bantahBroTelegramBannerPlugin.ts`
  - `server/bantahBroTelegramCommandsPlugin.ts`
  - `server/bantahBroKnowledgePlugin.ts`
  - `server/bantahBroLiveMarketPlugin.ts`
- Character clients: `["telegram"]`
- Dedicated bot env: `BANTAHBRO_TELEGRAM_BOT_TOKEN`

Why the command bridge exists:

The installed Telegram plugin version accepts URL buttons directly but does not reliably convert `callback_data` buttons from content responses. BantahBro therefore attaches a small Telegraf callback bridge to the official Telegram service and keeps all callback data under the `bb:*` namespace.

## Twitter/X

Official pattern:

- `plugins: [bootstrapPlugin, twitterPlugin]`
- `clients: ["twitter"]`
- settings include Twitter API keys and behavior flags
- autonomous posting is controlled by `TWITTER_POST_ENABLE`
- replies/search are controlled by `TWITTER_SEARCH_ENABLE`, `TWITTER_AUTO_RESPOND_MENTIONS`, and `TWITTER_AUTO_RESPOND_REPLIES`
- target-user monitoring uses `TWITTER_TARGET_USERS`

BantahBro target implementation:

- Add `@elizaos/plugin-twitter` dependency.
- Add the Twitter plugin to BantahBro managed runtimes only when Twitter is enabled.
- Keep BantahBro Twitter behavior in:
  - `twitterMessageHandlerTemplate`
  - `twitterShouldRespondTemplate`
  - BantahBro-specific actions for token scan, call-out, market creation, and receipt posting.
- Keep tweet monitoring separate from Telegram state so a Telegram button click never leaks into Twitter behavior.

## Rule

Eliza plugins own transport.

BantahBro plugins own product actions.

Static knowledge explains Bantah/BXBT rules.

Live providers answer volatile market state.
