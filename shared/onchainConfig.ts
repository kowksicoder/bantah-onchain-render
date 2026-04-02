export type OnchainTokenSymbol = "USDC" | "USDT" | "ETH" | "BNB";
export type OnchainChainKey =
  | "base"
  | "base-sepolia"
  | "arbitrum"
  | "celo"
  | "unichain"
  | "bsc"
  | "bsc-testnet"
  | "arbitrum-sepolia"
  | "celo-sepolia"
  | "unichain-sepolia";
export type OnchainExecutionMode = "metadata_only" | "contract";

export interface OnchainTokenConfig {
  symbol: OnchainTokenSymbol;
  decimals: number;
  address: string | null;
  isNative: boolean;
}

export interface OnchainChainConfig {
  key: OnchainChainKey;
  chainId: number;
  name: string;
  nativeSymbol: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  escrowContractAddress?: string | null;
  // ERC20 staking function signature, e.g. lockStakeToken(address,uint256)
  escrowStakeMethodErc20?: string | null;
  // Settlement function signature, e.g. settleChallenge(uint256,uint8)
  escrowSettleMethod?: string | null;
  tokens: Record<OnchainTokenSymbol, OnchainTokenConfig>;
}

export interface OnchainPublicConfig {
  // Backward-compatible fields (resolved to default chain)
  chainId: number;
  rpcUrl: string;
  tokens: Record<OnchainTokenSymbol, OnchainTokenConfig>;
  // Multi-chain fields
  defaultChainId: number;
  defaultToken: OnchainTokenSymbol;
  enforceWallet: boolean;
  executionMode: OnchainExecutionMode;
  contractEnabled: boolean;
  chains: Record<string, OnchainChainConfig>;
}

export const DEFAULT_ONCHAIN_CHAIN_ID = 8453; // Base Mainnet

export const DEFAULT_ONCHAIN_ETH_NATIVE_TOKENS: Record<
  OnchainTokenSymbol,
  OnchainTokenConfig
> = {
  USDC: {
    symbol: "USDC",
    decimals: 6,
    address: null,
    isNative: false,
  },
  USDT: {
    symbol: "USDT",
    decimals: 6,
    address: null,
    isNative: false,
  },
  ETH: {
    symbol: "ETH",
    decimals: 18,
    address: null,
    isNative: true,
  },
  BNB: {
    symbol: "BNB",
    decimals: 18,
    address: null,
    isNative: false,
  },
};

export const DEFAULT_ONCHAIN_BNB_NATIVE_TOKENS: Record<
  OnchainTokenSymbol,
  OnchainTokenConfig
> = {
  USDC: {
    symbol: "USDC",
    decimals: 6,
    address: null,
    isNative: false,
  },
  USDT: {
    symbol: "USDT",
    decimals: 6,
    address: null,
    isNative: false,
  },
  ETH: {
    symbol: "ETH",
    decimals: 18,
    address: null,
    isNative: false,
  },
  BNB: {
    symbol: "BNB",
    decimals: 18,
    address: null,
    isNative: true,
  },
};

// Backward-compatible alias for existing imports.
export const DEFAULT_ONCHAIN_TOKENS = DEFAULT_ONCHAIN_ETH_NATIVE_TOKENS;

export const DEFAULT_ONCHAIN_TESTNET_CHAINS: Record<OnchainChainKey, OnchainChainConfig> = {
  base: {
    key: "base",
    chainId: 8453,
    name: "Base",
    nativeSymbol: "ETH",
    rpcUrl: "https://mainnet.base.org",
    blockExplorerUrl: "https://basescan.org",
    tokens: DEFAULT_ONCHAIN_ETH_NATIVE_TOKENS,
  },
  unichain: {
    key: "unichain",
    chainId: 130,
    name: "Unichain",
    nativeSymbol: "ETH",
    rpcUrl: "https://mainnet.unichain.org",
    blockExplorerUrl: "https://uniscan.xyz",
    tokens: DEFAULT_ONCHAIN_ETH_NATIVE_TOKENS,
  },
  "base-sepolia": {
    key: "base-sepolia",
    chainId: 84532,
    name: "Base Sepolia",
    nativeSymbol: "ETH",
    rpcUrl: "https://sepolia.base.org",
    blockExplorerUrl: "https://sepolia.basescan.org",
    tokens: DEFAULT_ONCHAIN_ETH_NATIVE_TOKENS,
  },
  arbitrum: {
    key: "arbitrum",
    chainId: 42161,
    name: "Arbitrum One",
    nativeSymbol: "ETH",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorerUrl: "https://arbiscan.io",
    tokens: DEFAULT_ONCHAIN_ETH_NATIVE_TOKENS,
  },
  bsc: {
    key: "bsc",
    chainId: 56,
    name: "BNB Smart Chain",
    nativeSymbol: "BNB",
    rpcUrl: "https://bsc-dataseed.binance.org",
    blockExplorerUrl: "https://bscscan.com",
    tokens: DEFAULT_ONCHAIN_BNB_NATIVE_TOKENS,
  },
  celo: {
    key: "celo",
    chainId: 42220,
    name: "Celo Mainnet",
    nativeSymbol: "CELO",
    rpcUrl: "https://forno.celo.org",
    blockExplorerUrl: "https://celoscan.io",
    tokens: DEFAULT_ONCHAIN_ETH_NATIVE_TOKENS,
  },
  "bsc-testnet": {
    key: "bsc-testnet",
    chainId: 97,
    name: "BSC Testnet",
    nativeSymbol: "BNB",
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    blockExplorerUrl: "https://testnet.bscscan.com",
    tokens: DEFAULT_ONCHAIN_BNB_NATIVE_TOKENS,
  },
  "arbitrum-sepolia": {
    key: "arbitrum-sepolia",
    chainId: 421614,
    name: "Arbitrum Sepolia",
    nativeSymbol: "ETH",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    blockExplorerUrl: "https://sepolia.arbiscan.io",
    tokens: DEFAULT_ONCHAIN_ETH_NATIVE_TOKENS,
  },
  "celo-sepolia": {
    key: "celo-sepolia",
    chainId: 11142220,
    name: "Celo Sepolia",
    nativeSymbol: "CELO",
    rpcUrl: "https://forno.celo-sepolia.celo-testnet.org",
    blockExplorerUrl: "https://celo-sepolia.blockscout.com",
    tokens: DEFAULT_ONCHAIN_ETH_NATIVE_TOKENS,
  },
  "unichain-sepolia": {
    key: "unichain-sepolia",
    chainId: 1301,
    name: "Unichain Sepolia",
    nativeSymbol: "ETH",
    rpcUrl: "https://sepolia.unichain.org",
    blockExplorerUrl: "https://sepolia.uniscan.xyz",
    tokens: DEFAULT_ONCHAIN_ETH_NATIVE_TOKENS,
  },
};

export function normalizeOnchainTokenSymbol(input: unknown): OnchainTokenSymbol {
  const raw = String(input || "").trim().toUpperCase();
  if (raw === "USDT") return "USDT";
  if (raw === "BNB") return "BNB";
  if (raw === "ETH") return "ETH";
  return "USDC";
}

export function normalizeEvmAddress(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
  return value.toLowerCase();
}

export function parseWalletAddresses(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const normalized = input
    .map((entry) => normalizeEvmAddress(entry))
    .filter((entry): entry is string => !!entry);
  return Array.from(new Set(normalized));
}

export function toAtomicUnits(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "0";
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return "0";
  let multiplier = BigInt(1);
  for (let index = 0; index < decimals; index += 1) {
    multiplier *= BigInt(10);
  }
  const scaled = BigInt(Math.trunc(amount)) * multiplier;
  return scaled.toString();
}
