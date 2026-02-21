export type OnchainTokenSymbol = "USDC" | "USDT" | "ETH";
export type OnchainChainKey =
  | "base-sepolia"
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
  // ERC20 staking function signature, e.g. depositToken(address,uint256)
  escrowStakeMethodErc20?: string | null;
  // Settlement function signature, e.g. settle()
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

export const DEFAULT_ONCHAIN_CHAIN_ID = 84532; // Base Sepolia

export const DEFAULT_ONCHAIN_TOKENS: Record<OnchainTokenSymbol, OnchainTokenConfig> = {
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
};

export const DEFAULT_ONCHAIN_TESTNET_CHAINS: Record<OnchainChainKey, OnchainChainConfig> = {
  "base-sepolia": {
    key: "base-sepolia",
    chainId: 84532,
    name: "Base Sepolia",
    nativeSymbol: "ETH",
    rpcUrl: "https://sepolia.base.org",
    blockExplorerUrl: "https://sepolia.basescan.org",
    tokens: DEFAULT_ONCHAIN_TOKENS,
  },
  "bsc-testnet": {
    key: "bsc-testnet",
    chainId: 97,
    name: "BSC Testnet",
    nativeSymbol: "BNB",
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    blockExplorerUrl: "https://testnet.bscscan.com",
    tokens: DEFAULT_ONCHAIN_TOKENS,
  },
  "arbitrum-sepolia": {
    key: "arbitrum-sepolia",
    chainId: 421614,
    name: "Arbitrum Sepolia",
    nativeSymbol: "ETH",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    blockExplorerUrl: "https://sepolia.arbiscan.io",
    tokens: DEFAULT_ONCHAIN_TOKENS,
  },
  "celo-sepolia": {
    key: "celo-sepolia",
    chainId: 11142220,
    name: "Celo Sepolia",
    nativeSymbol: "CELO",
    rpcUrl: "https://forno.celo-sepolia.celo-testnet.org",
    blockExplorerUrl: "https://celo-sepolia.blockscout.com",
    tokens: DEFAULT_ONCHAIN_TOKENS,
  },
  "unichain-sepolia": {
    key: "unichain-sepolia",
    chainId: 1301,
    name: "Unichain Sepolia",
    nativeSymbol: "ETH",
    rpcUrl: "https://sepolia.unichain.org",
    blockExplorerUrl: "https://sepolia.uniscan.xyz",
    tokens: DEFAULT_ONCHAIN_TOKENS,
  },
};

export function normalizeOnchainTokenSymbol(input: unknown): OnchainTokenSymbol {
  const raw = String(input || "").trim().toUpperCase();
  if (raw === "USDT") return "USDT";
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
