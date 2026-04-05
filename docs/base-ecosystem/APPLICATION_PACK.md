# Base Ecosystem Application Pack

This document is the working copy for Bantah's Base ecosystem applications.

It is intentionally honest about current status:

- Bantah has a live onchain product surface
- Bantah has Base-aligned agent infrastructure using Eliza + AgentKit
- Bantah does **not** yet have the final public Base mainnet contract address committed here
- x402 is part of the protocol direction, but is not fully live in the current Bantah app flow yet

That means this pack is ready for:

- Base builder / ecosystem applications
- Base AI agent ecosystem conversations
- grant or ecosystem review

And not yet ready for:

- DefiLlama submission
- final Dune analytics backed by Base mainnet contract events

## Submission summary

### Project name

`Bantah Protocol`

### Short description

Open protocol for AI agent and human prediction markets on Base.

### Category

`AI Agents` / `Prediction Markets` / `DeFi`

### One-line pitch

Bantah lets humans and AI agents create, join, and settle prediction markets with wallet-native execution and an agent runtime layer built for Base.

## What Bantah is building on Base

- Base-aligned agent infrastructure
- AgentKit wallet provisioning for Bantah-created agents
- prediction market UX where agents can create and participate in markets
- Base-first protocol launch path for public onchain credibility, TVL, and ecosystem integrations

## Current technical stack

### Live now

- React + TypeScript product surface
- Node/Express backend
- Drizzle + PostgreSQL
- Privy-based auth
- Bantah-managed Eliza runtime for agents
- Coinbase AgentKit wallet provisioning for Bantah-created agents
- Bantah skill contract for agent actions:
  - `create_market`
  - `join_yes`
  - `join_no`
  - `read_market`
  - `check_balance`

### In progress / next

- Base mainnet contract deployment finalization
- x402-powered paid agent service flows
- DefiLlama TVL adapter
- Dune dashboard from Base contract events

## Why Base is the right home

- Bantah agents already use Coinbase AgentKit patterns that align naturally with Base
- Base is actively investing in AI agent infrastructure, payments, and builder support
- Bantah’s prediction market design benefits from low-cost execution and agent-friendly wallet flows
- a Base-first protocol story is cleaner for grants, ecosystem distribution, and analytics integrations

## Suggested application answers

### What problem are you solving?

Prediction markets are still too fragmented across social apps, manual group coordination, and opaque trading interfaces. AI agents also lack a clean protocol-native environment where they can participate as first-class market actors.

### What is Bantah’s solution?

Bantah combines a prediction market UX with a structured agent protocol layer. Humans and AI agents can create or join markets, use wallet-native settlement rails, and operate under a shared action contract.

### What is unique here?

- agent-native prediction markets, not just human markets with AI wrappers
- Eliza for runtime orchestration
- AgentKit for wallet provisioning and Base-aligned execution
- a public skill contract for importing external agents into Bantah

### What have you built already?

- live onchain Bantah product surface
- agent registry
- Bantah-created agent flow
- imported agent flow
- managed Eliza runtime wiring
- Bantah skill action bridge

### What do you want from Base?

- ecosystem visibility
- builder support / distribution
- grant support where relevant
- deeper Base AI agent ecosystem alignment

## Links and assets to finalize

Replace placeholders before submission:

- Website: `https://bantah.xyz`
- GitHub org or repo: `https://github.com/bantah`
- Demo video: `TODO`
- Contact: `TODO`
- Base mainnet contract address: `TODO`
- Deployed app URL: `TODO`

## Reviewer notes

If a reviewer asks whether x402 is already live, the accurate answer is:

> Bantah is building toward x402-aligned paid agent service flows, but the current live agent product uses Eliza + AgentKit + Bantah-managed runtime actions first. x402 is the next commercial/payment layer, not a completed production primitive in the current app.

If a reviewer asks whether Bantah is Base-only, the accurate answer is:

> The app UX is becoming multi-chain, but Bantah’s protocol credibility, analytics, and first external listings should launch Base-first. Base is the cleanest chain for the initial ecosystem story.
