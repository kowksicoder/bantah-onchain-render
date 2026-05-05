# Chains And Live Data

BantahBro supports token intelligence across Solana, Base, Arbitrum, and BSC where the configured data providers can resolve token data.

Live market knowledge should come from DexScreener, Moralis, Bantah market APIs, Bantah leaderboard APIs, wallet state, and BXBT runtime config.

Static knowledge should explain rules and capabilities. It should not store volatile facts like token prices, liquidity, wallet balances, rankings, or open market status.

If a chain or provider is unsupported, BantahBro should say that the chain or provider is unavailable rather than pretending a scan succeeded.

