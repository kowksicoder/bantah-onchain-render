import { encodeFunctionData, parseAbi, parseUnits, toHex } from "viem";
import { Attribution } from "ox/erc8021";

export type OnchainTokenSymbol = "USDC" | "USDT" | "ETH" | "BNB";

export type OnchainTokenConfig = {
  symbol: OnchainTokenSymbol;
  decimals: number;
  address: string | null;
  isNative: boolean;
};

export type OnchainChainConfig = {
  chainId: number;
  name: string;
  nativeSymbol: string;
  rpcUrl: string;
  escrowContractAddress?: string | null;
  escrowStakeMethodErc20?: string | null;
  escrowSettleMethod?: string | null;
  tokens: Record<OnchainTokenSymbol, OnchainTokenConfig>;
  supportedTokens: OnchainTokenSymbol[];
};

export type OnchainRuntimeConfig = {
  defaultChainId: number;
  defaultToken: OnchainTokenSymbol;
  executionMode: "metadata_only" | "contract";
  contractEnabled: boolean;
  chains: Record<string, OnchainChainConfig>;
};

export type OnchainSettlementResult =
  | "challenger_won"
  | "challenged_won"
  | "draw";

type PrivyEthereumProvider = {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

type PrivyWallet = {
  address: string;
  switchChain: (targetChainId: `0x${string}` | number) => Promise<void>;
  getEthereumProvider: () => Promise<PrivyEthereumProvider>;
};

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);
const escrowNativeAbi = parseAbi([
  "function lockStakeNative() payable returns (bool)",
]);

const BASE_ATTRIBUTION_CHAIN_IDS = new Set<number>([8453, 84532]);
const BASE_BUILDER_CODE = String(
  (import.meta as any)?.env?.VITE_BASE_BUILDER_CODE || "bc_f32lu290",
).trim();
const BASE_BUILDER_DATA_SUFFIX = (() => {
  if (!BASE_BUILDER_CODE) return null;
  try {
    return Attribution.toDataSuffix({ codes: [BASE_BUILDER_CODE] });
  } catch {
    return null;
  }
})();

function normalizeAddress(input: unknown): `0x${string}` | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(value)) return null;
  return value as `0x${string}`;
}

function normalizeHash(input: unknown): `0x${string}` {
  const value = String(input || "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(value)) {
    throw new Error("Transaction hash is invalid");
  }
  return value as `0x${string}`;
}

function ensureHexQuantity(value: bigint): `0x${string}` {
  if (value < BigInt(0)) {
    throw new Error("Negative transaction value is invalid");
  }
  return toHex(value);
}

function appendBuilderDataSuffix(
  data: `0x${string}`,
  chainId?: number,
): `0x${string}` {
  if (!chainId || !BASE_ATTRIBUTION_CHAIN_IDS.has(Number(chainId))) {
    return data;
  }
  if (!BASE_BUILDER_DATA_SUFFIX) {
    return data;
  }

  const normalizedData = String(data).toLowerCase();
  const suffixWithoutPrefix = BASE_BUILDER_DATA_SUFFIX.slice(2).toLowerCase();
  if (normalizedData.endsWith(suffixWithoutPrefix)) {
    return data;
  }

  return `${data}${BASE_BUILDER_DATA_SUFFIX.slice(2)}` as `0x${string}`;
}

function resolveChainConfig(config: OnchainRuntimeConfig, chainId: number): OnchainChainConfig {
  return (
    config.chains[String(chainId)] ||
    config.chains[String(config.defaultChainId)] ||
    Object.values(config.chains || {})[0]
  );
}

function resolveWallet(wallets: PrivyWallet[], preferredAddress?: string | null): PrivyWallet {
  if (!Array.isArray(wallets) || wallets.length === 0) {
    throw new Error("No connected wallet found. Connect your wallet and try again.");
  }

  const preferred = normalizeAddress(preferredAddress);
  if (!preferred) return wallets[0];

  const matched = wallets.find(
    (wallet) => normalizeAddress(wallet?.address) === preferred,
  );
  return matched || wallets[0];
}

function parseMethodSignature(signature: string): {
  functionName: string;
  paramTypes: string[];
} {
  const raw = String(signature || "").trim();
  const match = raw.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/);
  if (!match) {
    throw new Error(`Invalid method signature: ${raw}`);
  }
  const functionName = match[1];
  const params = match[2].trim();
  const paramTypes = params
    ? params.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
  return { functionName, paramTypes };
}

function buildErc20EscrowCalldata(
  methodSignature: string,
  tokenAddress: `0x${string}`,
  amountAtomic: bigint,
): `0x${string}` {
  const { functionName, paramTypes } = parseMethodSignature(methodSignature);
  const args: Array<string | bigint> = [];

  for (const paramType of paramTypes) {
    const normalizedType = paramType.toLowerCase();
    if (normalizedType === "address") {
      args.push(tokenAddress);
      continue;
    }
    if (normalizedType.startsWith("uint") || normalizedType.startsWith("int")) {
      args.push(amountAtomic);
      continue;
    }
    throw new Error(
      `Unsupported escrow method parameter type "${paramType}" in ${methodSignature}`,
    );
  }

  const abi = parseAbi([`function ${methodSignature}` as any] as any);
  return encodeFunctionData({
    abi: abi as any,
    functionName: functionName as any,
    args: args as any,
  }) as `0x${string}`;
}

function buildSettlementCalldata(params: {
  methodSignature: string;
  challengeId: number;
  result: OnchainSettlementResult;
}): `0x${string}` {
  const { functionName, paramTypes } = parseMethodSignature(params.methodSignature);
  const resultCode =
    params.result === "challenger_won"
      ? BigInt(1)
      : params.result === "challenged_won"
        ? BigInt(2)
        : BigInt(3);
  const args: Array<string | bigint | boolean> = [];

  paramTypes.forEach((paramType, index) => {
    const normalizedType = paramType.toLowerCase();
    if (normalizedType.startsWith("uint") || normalizedType.startsWith("int")) {
      if (paramTypes.length >= 2 && index === 0) {
        args.push(BigInt(params.challengeId));
      } else {
        args.push(resultCode);
      }
      return;
    }
    if (normalizedType === "string") {
      args.push(params.result);
      return;
    }
    if (normalizedType === "bool") {
      args.push(params.result === "challenger_won");
      return;
    }
    throw new Error(
      `Unsupported settlement method parameter type "${paramType}" in ${params.methodSignature}`,
    );
  });

  const abi = parseAbi([`function ${params.methodSignature}` as any] as any);
  return encodeFunctionData({
    abi: abi as any,
    functionName: functionName as any,
    args: args as any,
  }) as `0x${string}`;
}

async function sendTransactionAndWait(params: {
  provider: PrivyEthereumProvider;
  from: string;
  to: string;
  data?: `0x${string}`;
  value?: bigint;
  chainId?: number;
  timeoutMs?: number;
}): Promise<`0x${string}`> {
  const txData = appendBuilderDataSuffix(
    params.data || "0x",
    params.chainId,
  );
  const txHash = normalizeHash(
    await params.provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: params.from,
          to: params.to,
          data: txData,
          value:
            params.value === undefined
              ? "0x0"
              : ensureHexQuantity(params.value),
        },
      ],
    }),
  );

  const timeoutMs = params.timeoutMs ?? 180_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const receipt = await params.provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });

    if (receipt) {
      const status = String(receipt?.status || "").toLowerCase();
      if (status === "0x1") return txHash;
      throw new Error("Transaction reverted onchain.");
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error("Transaction confirmation timed out.");
}

function toAtomicAmount(rawAmount: string | number, decimals: number): bigint {
  const input = String(rawAmount ?? "").trim();
  if (!input) {
    throw new Error("Amount is required for escrow transaction.");
  }
  if (!/^\d+(\.\d+)?$/.test(input)) {
    throw new Error("Amount format is invalid.");
  }
  return parseUnits(input, decimals);
}

export async function executeOnchainEscrowStakeTx(params: {
  wallets: PrivyWallet[];
  preferredWalletAddress?: string | null;
  onchainConfig: OnchainRuntimeConfig;
  chainId: number;
  tokenSymbol: OnchainTokenSymbol;
  amount: string | number;
  amountAtomic?: string | null;
}): Promise<{
  approveTxHash?: `0x${string}`;
  escrowTxHash: `0x${string}`;
  walletAddress: `0x${string}`;
}> {
  const chainConfig = resolveChainConfig(params.onchainConfig, Number(params.chainId));
  if (!chainConfig) {
    throw new Error("Unsupported chain for onchain escrow.");
  }

  const escrowAddress = normalizeAddress(chainConfig.escrowContractAddress);
  if (!escrowAddress) {
    throw new Error(
      `Escrow contract is not configured for chain ${chainConfig.name}.`,
    );
  }

  const token = chainConfig.tokens?.[params.tokenSymbol];
  if (!token) {
    throw new Error(`Token ${params.tokenSymbol} is not configured on ${chainConfig.name}.`);
  }

  const wallet = resolveWallet(params.wallets, params.preferredWalletAddress);
  await wallet.switchChain(chainConfig.chainId);
  const provider = await wallet.getEthereumProvider();
  const sender = normalizeAddress(wallet.address);
  if (!sender) {
    throw new Error("Connected wallet address is invalid.");
  }

  const amountAtomicRaw =
    typeof params.amountAtomic === "string" ? params.amountAtomic.trim() : "";
  const amountAtomic = /^\d+$/.test(amountAtomicRaw)
    ? BigInt(amountAtomicRaw)
    : toAtomicAmount(params.amount, token.decimals);
  if (amountAtomic <= BigInt(0)) {
    throw new Error("Stake amount must be greater than zero.");
  }

  if (token.isNative) {
    const nativeStakeData = encodeFunctionData({
      abi: escrowNativeAbi,
      functionName: "lockStakeNative",
      args: [],
    });
    const escrowTxHash = await sendTransactionAndWait({
      provider,
      from: sender,
      to: escrowAddress,
      data: nativeStakeData,
      value: amountAtomic,
      chainId: chainConfig.chainId,
    });
    return { escrowTxHash, walletAddress: sender };
  }

  const tokenAddress = normalizeAddress(token.address);
  if (!tokenAddress) {
    throw new Error(`Token contract for ${token.symbol} is not configured on ${chainConfig.name}.`);
  }

  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [escrowAddress, amountAtomic],
  });
  const approveTxHash = await sendTransactionAndWait({
    provider,
    from: sender,
    to: tokenAddress,
    data: approveData,
    chainId: chainConfig.chainId,
  });

  const erc20MethodSignature =
    chainConfig.escrowStakeMethodErc20?.trim() || "lockStakeToken(address,uint256)";
  const escrowData = buildErc20EscrowCalldata(
    erc20MethodSignature,
    tokenAddress,
    amountAtomic,
  );
  const escrowTxHash = await sendTransactionAndWait({
    provider,
    from: sender,
    to: escrowAddress,
    data: escrowData,
    value: BigInt(0),
    chainId: chainConfig.chainId,
  });

  return { approveTxHash, escrowTxHash, walletAddress: sender };
}

export async function executeOnchainSettleTx(params: {
  wallets: PrivyWallet[];
  preferredWalletAddress?: string | null;
  onchainConfig: OnchainRuntimeConfig;
  chainId: number;
  challengeId: number;
  result: OnchainSettlementResult;
}): Promise<{ settleTxHash: `0x${string}`; walletAddress: `0x${string}` }> {
  const chainConfig = resolveChainConfig(params.onchainConfig, Number(params.chainId));
  if (!chainConfig) {
    throw new Error("Unsupported chain for onchain settlement.");
  }

  const escrowAddress = normalizeAddress(chainConfig.escrowContractAddress);
  if (!escrowAddress) {
    throw new Error(
      `Escrow contract is not configured for chain ${chainConfig.name}.`,
    );
  }

  const wallet = resolveWallet(params.wallets, params.preferredWalletAddress);
  await wallet.switchChain(chainConfig.chainId);
  const provider = await wallet.getEthereumProvider();
  const sender = normalizeAddress(wallet.address);
  if (!sender) {
    throw new Error("Connected wallet address is invalid.");
  }

  const settleMethod =
    chainConfig.escrowSettleMethod?.trim() || "settleChallenge(uint256,uint8)";
  const settleData = buildSettlementCalldata({
    methodSignature: settleMethod,
    challengeId: params.challengeId,
    result: params.result,
  });

  const settleTxHash = await sendTransactionAndWait({
    provider,
    from: sender,
    to: escrowAddress,
    data: settleData,
    value: BigInt(0),
    chainId: chainConfig.chainId,
  });

  return { settleTxHash, walletAddress: sender };
}
