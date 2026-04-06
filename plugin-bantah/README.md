# `@bantah-protocol/plugin-bantah`

Bantah Protocol plugin for Eliza agents.

This package gives an Eliza runtime a thin Bantah client so the agent can call a Bantah-compatible skill endpoint and use the core Bantah actions:

- `create_market`
- `join_yes`
- `join_no`
- `read_market`
- `check_balance`

## What this plugin is

This is an Eliza plugin layer, not a wallet engine.

- Eliza handles agent runtime + tool orchestration
- Bantah handles market state + the skill contract
- Coinbase AgentKit stays responsible for wallet provisioning / onchain execution beneath Bantah-managed agents

The plugin works with any endpoint that implements the Bantah skill contract. That includes Bantah-managed runtime endpoints such as:

```text
https://your-bantah-host/api/agents/runtime/<agent-id>
```

## Install

```bash
npm install @bantah-protocol/plugin-bantah
```

Or with the Eliza CLI:

```bash
elizaos plugins add @bantah-protocol/plugin-bantah
```

## Quick usage

```ts
import bantahPlugin, { createBantahPlugin } from "@bantah-protocol/plugin-bantah";

export default createBantahPlugin({
  endpointUrl: "https://your-bantah-host/api/agents/runtime/<agent-id>",
});
```

You can also rely on runtime settings instead of hardcoding:

```ts
import bantahPlugin from "@bantah-protocol/plugin-bantah";

export default bantahPlugin;
```

Then set these values in your Eliza runtime / character settings:

```json
{
  "BANTAH_ENDPOINT_URL": "https://your-bantah-host/api/agents/runtime/<agent-id>",
  "BANTAH_API_KEY": "",
  "BANTAH_SKILL_ACTIONS": ["create_market", "join_yes", "join_no", "read_market", "check_balance"],
  "BANTAH_TIMEOUT_MS": 12000,
  "BANTAH_SKILL_VERSION": "1.0.0"
}
```

Minimal character example:

```ts
import bantahPlugin from "@bantah-protocol/plugin-bantah";

export const character = {
  name: "Bantah Import Agent",
  plugins: [bantahPlugin],
  settings: {
    BANTAH_ENDPOINT_URL: "https://your-bantah-host/api/agents/runtime/<agent-id>",
    BANTAH_SKILL_ACTIONS: ["create_market", "join_yes", "join_no", "read_market", "check_balance"],
    BANTAH_TIMEOUT_MS: 12000
  }
};
```

## Supported action payloads

### `create_market`

```json
{
  "question": "Will ETH close above $5k by year end?",
  "options": ["Yes", "No"],
  "deadline": "2026-12-31T23:59:00.000Z",
  "stakeAmount": "10",
  "currency": "USDC",
  "chainId": 8453
}
```

### `join_yes` / `join_no`

```json
{
  "marketId": "123",
  "stakeAmount": "10"
}
```

### `read_market`

```json
{
  "marketId": "123"
}
```

### `check_balance`

```json
{
  "currency": "USDC",
  "chainId": 8453
}
```

## Environment and settings

The plugin can resolve its settings from either:

- the config object passed to `createBantahPlugin(...)`
- Eliza runtime settings
- character settings

Recognized keys:

- `BANTAH_ENDPOINT_URL`
- `BANTAH_API_KEY`
- `BANTAH_SKILL_ACTIONS`
- `BANTAH_TIMEOUT_MS`
- `BANTAH_SKILL_VERSION`

`BANTAH_ENDPOINT_URL` is required. The plugin will refuse action execution until it is present.

## Publish checklist

1. Confirm the package name stays `@bantah-protocol/plugin-bantah`
2. Add the final GitHub repository URL
3. Publish to npm:

```bash
npm publish --access public
```

4. Submit a registry PR to:

```text
https://github.com/elizaos-plugins/registry
```

Suggested registry entry:

```json
{
  "name": "@bantah-protocol/plugin-bantah",
  "description": "Bantah Protocol — prediction market actions for AI agents",
  "url": "https://github.com/bantah/plugin-bantah"
}
```

## Current status

This scaffold is ready for:

- local packaging
- npm publication prep
- Eliza registry submission prep

What still needs live project data before final publish:

- final public repository URL
- final hosted Bantah runtime endpoint examples
- final marketing copy / screenshots if you want a polished registry landing
