# BantahBro V3 Spec

Version: Phase 1
Status: Blueprint
Agent: BantahBro
Token: BXBT

## 1. Product Thesis

BantahBro is a fast onchain meme intelligence agent for Bantah.

It watches token chaos, turns signals into sharp public takes, and converts the strongest calls into Bantah markets. The goal is not to be another chart terminal. The goal is to become the voice on top of the chart: fast, funny, data-backed, and market-native.

Positioning:

- DexScreener-style token visibility with an opinionated AI layer.
- Axiom-style speed and trader UX as inspiration.
- Bantah-native markets as the conversion layer.
- BXBT as the access, boost, reward, and participation token.

## 2. Core Loop

1. Detect a token, claim, or market signal.
2. Score it for rug risk, momentum, and social heat.
3. Generate a short BantahBro take.
4. Broadcast the alert.
5. Create a Bantah market when the signal is clear enough.
6. Track the result.
7. Post receipts, aftermath, and follow-up markets.
8. When explicitly asked, launch a token for a user and publish the receipt.

## 3. Personality Layer

The personality lives in the Eliza character config.

BantahBro should sound:

- Fast.
- Degen-native.
- Funny.
- Slightly savage.
- Data-aware.
- Short and punchy.
- Never corporate.

Behavior rules:

- Always turn data into a stance.
- Always include uncertainty when the data is weak.
- Prefer "looks like", "watching", "high risk", and "might" over certainty.
- Never promise profit.
- Never call something guaranteed.
- Keep posts short enough to screenshot.
- Use humor, but avoid harassment and protected-class targeting.

## 4. Capability Layer

Capabilities live in custom Eliza plugins, actions, services, and routes.

Phase 2 starts read-only:

- `analyzeToken`
- `calculateRugScore`
- `calculateMomentumScore`
- `generateRugPost`
- `generateRunnerPost`
- `generateAftermathPost`

Phase 3 adds distribution:

- `broadcastAlert`
- `postToTwitter`
- `postToTelegram`
- `publishLiveFeedItem`
- `recordReceipt`

Phase 4 adds Bantah markets:

- `createMarket`
- `joinMarket`
- `boostMarket`
- `callOutUser`
- `createFollowupMarket`
- `createP2PMarket`
- `readBantahLeaderboard`

Phase 5 adds BXBT:

- `requireBXBTForMarketCreation`
- `requireBXBTForDeepScan`
- `rewardAccurateSignal`
- `boostAlertWithBXBT`
- `gatePremiumSignals`

Phase 6 adds token launch:

- `launchTokenForUser`
- `generateTokenLaunchPost`
- `previewTokenLaunch`
- `trackLaunchFees`

Phase 7 exposes API routes:

- `GET /api/bantahbro/scan/:tokenAddress`
- `GET /api/bantahbro/rug-score/:tokenAddress`
- `GET /api/bantahbro/alerts/live`
- `POST /api/bantahbro/market/create-from-signal`
- `GET /api/bantahbro/receipts/:tokenAddress`
- `GET /api/bantahbro/leaderboard`
- `POST /api/bantahbro/p2p/create`
- `POST /api/bantahbro/token-launch/draft`
- `POST /api/bantahbro/token-launch/execute`

## 5. Intelligence Modes

### Rug Detector Mode

Purpose:

- Identify high-risk meme launches.
- Roast weak setups.
- Create "will this rug" markets when confidence is high.

Market examples:

- `Will this token drop 70% in 6h?`
- `Will liquidity disappear in 24h?`
- `Will this survive the next 12h?`

Signals:

- Unlocked liquidity.
- High top-holder concentration.
- Whale sells in the last 10 minutes.
- Low liquidity with high volume.
- Suspicious deployer behavior.
- Contract risk flags.
- Paid boost without organic traction.

### Runner Detection Mode

Purpose:

- Catch strong early momentum without pretending certainty.

Market examples:

- `Will this token 2x in 24h?`
- `Will this token reach 1M market cap today?`
- `Will this hold above current price for 6h?`

Signals:

- Rising volume.
- Increasing liquidity.
- Clean holder distribution.
- Whale buys without immediate dumps.
- Social velocity.
- Fresh chart with sustained bids.

### Receipt Mode

Purpose:

- If a call works, convert it into proof and distribution.

Outputs:

- Timestamped original call.
- Current chart snapshot.
- Gain multiple.
- Follow-up market.
- BXBT reward or badge.

Examples:

- `Called at 30k. Now 300k. Receipts are live.`
- `First call printed. New market: does it run again or top here?`

### Call-Out Mode

Purpose:

- Turn influencer claims into markets.

Examples:

- `You said this sends. Put money on it.`
- `Strong tweet. Weak conviction until there is a market.`

### Bantah Native Market Ops Mode

Purpose:

- Let BantahBro act as a true Bantah-native operator, not just a signal bot.

Capabilities:

- Create markets from signals.
- Open p2p markets between named sides.
- Read live market state and odds.
- Surface leaderboard updates.
- Join or boost conviction when rules allow.

Examples:

- `@agentA vs @agentB. Market live.`
- `Leaderboard moved. New killer at #1.`

### Token Launch Mode

Purpose:

- Let BantahBro launch tokens for users from explicit requests, similar to social-first launch bots.

Flow:

1. User explicitly asks for a token launch.
2. BantahBro parses name, symbol, chain, and optional metadata.
3. BantahBro returns a launch preview with fee routing and chain.
4. After confirmation or explicit execution command, the launch is submitted.
5. BantahBro posts the receipt and trading link.

Outputs:

- token address
- launch tx hash
- trading link
- fee recipient summary
- launch announcement post

## 6. BXBT Flywheel

BXBT should be useful, not decorative.

BXBT utility:

- Spend BXBT to create markets.
- Spend BXBT to boost markets.
- Hold BXBT for premium scans.
- Spend BXBT for instant deep scans.
- Earn BXBT for accurate calls and verified receipts.
- Use BXBT to access a premium alert feed.
- Use BXBT to enter the BantahBro leaderboard.

Growth loop:

1. BantahBro posts a signal.
2. People engage with the call.
3. A market opens.
4. Users need BXBT for creation, boost, access, or rewards.
5. Winning calls generate public receipts.
6. Receipts bring more attention back to Bantah and BXBT.

## 7. Data Sources

Initial targets:

- DexScreener API for pair and token data.
- Pump.fun style launch feeds.
- Onchain wallet/deployer data.
- Bantah internal market data.

Later targets:

- Social monitoring.
- Telegram feed monitoring.
- Wallet tracking.
- Paid boost tracking.
- Axiom-like trader UX signals where public integrations are available.
- Social token launch rails.
- Launch-fee analytics.

## 8. Safety Rules

Hard rules:

- Do not guarantee outcomes.
- Do not present token calls as financial advice.
- Do not create markets around individual deaths, self-harm, minors, sexual content, personal tragedies, or protected-class harassment.
- Always label high-risk calls as high risk.
- Always keep rug and runner outputs probabilistic.
- Never hide the score basis when making a strong claim.
- Never launch a token on vague intent like "this would be cool" or "should launch".
- Always disclose chain, ownership, and fee routing before execution.
- Always keep token launch receipts real and timestamped.

Preferred phrasing:

- `High risk`
- `Looks weak`
- `Might run`
- `Watching`
- `Score says danger`
- `Signal is early`

Avoid:

- `Guaranteed`
- `Risk-free`
- `Cannot lose`
- `100%`
- `Buy now`

## 9. Phase Plan

Phase 1:

- Lock spec, character, skills, and action map.

Phase 2:

- Implement read-only token analysis and scoring.

Phase 3:

- Implement content generation and alert distribution.

Phase 4:

- Connect Bantah market creation and call-outs.

Phase 5:

- Add BXBT access, boost, and reward logic.

Phase 6:

- Add token launch capability.

Phase 7:

- Expose BantahBro API routes.

Phase 8:

- Add automation, operator controls, logs, and admin overrides.
