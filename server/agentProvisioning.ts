import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import dotenv from "dotenv";
import { encodeFunctionData, formatUnits, parseAbi, parseUnits, type Address, type Hex } from "viem";
import { BANTAH_SKILL_VERSION, bantahRequiredSkillActionValues } from "@shared/agentSkill";
import type { OnchainChainConfig, OnchainTokenSymbol } from "@shared/onchainConfig";
import { getBantahAgentKitNetworkIdForChainId } from "@shared/agentApi";

const LOCAL_AGENT_ENV_PATH = path.resolve(
  process.cwd(),
  "../Agent/typescript/examples/vercel-ai-sdk-smart-wallet-chatbot/.env",
);

const LOCAL_AGENTKIT_DIST_PATH = path.resolve(
  process.cwd(),
  "../Agent/typescript/agentkit/dist/index.js",
);

export const DEFAULT_BANTAH_AGENT_SKILLS = [...bantahRequiredSkillActionValues];
export const DEFAULT_BANTAH_AGENT_NETWORK_ID = "base-mainnet";

const erc20BalanceAbi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
]);
const erc20ApproveAbi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);
const escrowNativeAbi = parseAbi([
  "function lockStakeNative() payable returns (bool)",
]);

type BantahAgentWalletErrorCode =
  | "wallet_not_provisioned"
  | "unsupported_chain"
  | "wallet_restore_failed"
  | "transaction_incomplete"
  | "insufficient_balance";

type AgentKitLikeModule = {
  CdpSmartWalletProvider: {
    configureWithWallet(config: {
      networkId: string;
      owner?: string | Record<string, unknown>;
      address?: string;
      idempotencyKey?: string;
      apiKeyId?: string;
      apiKeySecret?: string;
      walletSecret?: string;
    }): Promise<{
      exportWallet(): Promise<{
        name?: string;
        address: `0x${string}`;
        ownerAddress: `0x${string}`;
      }>;
      getAddress(): string;
      getBalance(): Promise<bigint>;
      readContract(params: Record<string, unknown>): Promise<unknown>;
      sendTransaction(params: Record<string, unknown>): Promise<Hex>;
      waitForTransactionReceipt(txHash: Hex): Promise<Record<string, unknown>>;
    }>;
  };
};

export type ProvisionedBantahAgent = {
  walletAddress: `0x${string}`;
  ownerWalletAddress: `0x${string}`;
  walletProvider: "cdp_smart_wallet";
  walletNetworkId: string;
  walletData: {
    name?: string;
    address: `0x${string}`;
    ownerAddress: `0x${string}`;
  };
};

export type StoredBantahAgentWalletSnapshot = {
  agentId: string;
  walletProvider?: string | null;
  walletNetworkId?: string | null;
  walletAddress?: string | null;
  ownerWalletAddress?: string | null;
  walletData?: unknown;
};

export class BantahAgentWalletError extends Error {
  code: BantahAgentWalletErrorCode;

  constructor(code: BantahAgentWalletErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type RestoredBantahAgentWallet = {
  walletProvider: Awaited<ReturnType<AgentKitLikeModule["CdpSmartWalletProvider"]["configureWithWallet"]>>;
  walletAddress: `0x${string}`;
  ownerWalletAddress: `0x${string}`;
  walletNetworkId: string;
};

function normalizeAddress(input: unknown): `0x${string}` | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(value)) return null;
  return value as `0x${string}`;
}

function normalizeHash(input: unknown): `0x${string}` | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(value)) return null;
  return value as `0x${string}`;
}

function trimFormattedAmount(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed.includes(".")) return trimmed || "0";
  const normalized = trimmed.replace(/\.?0+$/, "");
  return normalized || "0";
}

function formatAtomicAmount(amountAtomic: bigint, decimals: number): string {
  return trimFormattedAmount(formatUnits(amountAtomic, decimals));
}

function mapChainIdToAgentKitNetworkId(chainId: number): string | null {
  return getBantahAgentKitNetworkIdForChainId(Number(chainId));
}

function parseStakeAtomicAmount(rawAmount: string | number, decimals: number): bigint {
  const input = String(rawAmount ?? "").trim();
  if (!input) {
    throw new Error("Amount is required for agent escrow transaction.");
  }
  if (!/^\d+(\.\d+)?$/.test(input)) {
    throw new Error("Amount format is invalid.");
  }
  return parseUnits(input, decimals);
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

function extractWalletSnapshot(snapshot: StoredBantahAgentWalletSnapshot) {
  const walletData =
    snapshot.walletData && typeof snapshot.walletData === "object"
      ? (snapshot.walletData as Record<string, unknown>)
      : null;

  const walletAddress =
    normalizeAddress(walletData?.address) || normalizeAddress(snapshot.walletAddress);
  const ownerWalletAddress =
    normalizeAddress(walletData?.ownerAddress) || normalizeAddress(snapshot.ownerWalletAddress);

  return {
    walletAddress,
    ownerWalletAddress,
    walletNetworkId: String(snapshot.walletNetworkId || "").trim() || DEFAULT_BANTAH_AGENT_NETWORK_ID,
  };
}

function resolveAgentKitRuntimeNetworkId(params: {
  snapshot: StoredBantahAgentWalletSnapshot;
  targetChainId?: number;
}) {
  const { walletNetworkId } = extractWalletSnapshot(params.snapshot);
  if (params.targetChainId === undefined) {
    return walletNetworkId;
  }

  const requestedNetworkId = mapChainIdToAgentKitNetworkId(params.targetChainId);
  if (!requestedNetworkId) {
    throw new BantahAgentWalletError(
      "unsupported_chain",
      `Coinbase AgentKit smart-wallet execution is not available for chain ${params.targetChainId} yet.`,
    );
  }

  if (walletNetworkId && walletNetworkId !== requestedNetworkId) {
    throw new BantahAgentWalletError(
      "unsupported_chain",
      `This Bantah agent wallet is provisioned on ${walletNetworkId}. Cross-network agent execution to ${requestedNetworkId} is not live yet.`,
    );
  }

  return requestedNetworkId;
}

function extractTransactionHash(receipt: unknown): `0x${string}` | null {
  if (!receipt || typeof receipt !== "object") return null;
  const payload = receipt as Record<string, unknown>;
  return (
    normalizeHash(payload.transactionHash) ||
    normalizeHash((payload.transaction as Record<string, unknown> | undefined)?.hash) ||
    normalizeHash(payload.hash)
  );
}

function ensureLocalCdpEnvFallback() {
  const hasCdpEnv =
    Boolean(process.env.CDP_API_KEY_ID) &&
    Boolean(process.env.CDP_API_KEY_SECRET) &&
    Boolean(process.env.CDP_WALLET_SECRET);

  if (hasCdpEnv) return;
  if (!fs.existsSync(LOCAL_AGENT_ENV_PATH)) return;

  dotenv.config({
    path: LOCAL_AGENT_ENV_PATH,
    override: false,
  });
}

async function loadLocalAgentKit(): Promise<AgentKitLikeModule> {
  if (!fs.existsSync(LOCAL_AGENTKIT_DIST_PATH)) {
    throw new Error(
      "AgentKit runtime is not available. Clear disk space and install @coinbase/agentkit in Onchain, or rebuild the local Agent workspace.",
    );
  }

  return (await import(pathToFileURL(LOCAL_AGENTKIT_DIST_PATH).href)) as AgentKitLikeModule;
}

function requireCdpEnvValue(name: "CDP_API_KEY_ID" | "CDP_API_KEY_SECRET" | "CDP_WALLET_SECRET") {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(
      `${name} is required to provision Bantah agents. Add it to Onchain env or keep the local Agent env available.`,
    );
  }
  return value;
}

export function getBantahAgentEndpointBaseUrl() {
  return (
    String(process.env.BANTAH_AGENT_ENDPOINT_BASE_URL || "").trim() ||
    String(process.env.BANTAH_ONCHAIN_BASE_URL || "").trim() ||
    String(process.env.RENDER_EXTERNAL_URL || "").trim() ||
    `http://localhost:${Number(process.env.PORT || 5000)}`
  );
}

export function buildBantahAgentEndpointUrl(agentId: string) {
  return new URL(`/api/agents/runtime/${agentId}`, getBantahAgentEndpointBaseUrl()).toString();
}

export async function provisionBantahAgentWallet(
  agentId: string,
  networkId = DEFAULT_BANTAH_AGENT_NETWORK_ID,
): Promise<ProvisionedBantahAgent> {
  ensureLocalCdpEnvFallback();

  const { CdpSmartWalletProvider } = await loadLocalAgentKit();
  const walletProvider = await CdpSmartWalletProvider.configureWithWallet({
    networkId,
    idempotencyKey: `bantah-agent-${agentId}`,
    apiKeyId: requireCdpEnvValue("CDP_API_KEY_ID"),
    apiKeySecret: requireCdpEnvValue("CDP_API_KEY_SECRET"),
    walletSecret: requireCdpEnvValue("CDP_WALLET_SECRET"),
  });

  const walletData = await walletProvider.exportWallet();

  return {
    walletAddress: walletData.address,
    ownerWalletAddress: walletData.ownerAddress,
    walletProvider: "cdp_smart_wallet",
    walletNetworkId: networkId,
    walletData,
  };
}

export async function restoreBantahAgentWallet(
  snapshot: StoredBantahAgentWalletSnapshot,
  options: {
    targetChainId?: number;
  } = {},
): Promise<RestoredBantahAgentWallet> {
  ensureLocalCdpEnvFallback();

  if (snapshot.walletProvider && snapshot.walletProvider !== "cdp_smart_wallet") {
    throw new BantahAgentWalletError(
      "wallet_not_provisioned",
      `Unsupported Bantah agent wallet provider: ${snapshot.walletProvider}`,
    );
  }

  const { walletAddress, ownerWalletAddress } = extractWalletSnapshot(snapshot);
  if (!walletAddress || !ownerWalletAddress) {
    throw new BantahAgentWalletError(
      "wallet_not_provisioned",
      "Bantah agent wallet data is incomplete. Recreate the agent wallet before using contract-mode actions.",
    );
  }

  const walletNetworkId = resolveAgentKitRuntimeNetworkId({
    snapshot,
    targetChainId: options.targetChainId,
  });
  const { CdpSmartWalletProvider } = await loadLocalAgentKit();

  try {
    const walletProvider = await CdpSmartWalletProvider.configureWithWallet({
      networkId: walletNetworkId,
      owner: ownerWalletAddress,
      address: walletAddress,
      idempotencyKey: `bantah-agent-runtime-${snapshot.agentId}`,
      apiKeyId: requireCdpEnvValue("CDP_API_KEY_ID"),
      apiKeySecret: requireCdpEnvValue("CDP_API_KEY_SECRET"),
      walletSecret: requireCdpEnvValue("CDP_WALLET_SECRET"),
    });

    return {
      walletProvider,
      walletAddress,
      ownerWalletAddress,
      walletNetworkId,
    };
  } catch (error: any) {
    throw new BantahAgentWalletError(
      "wallet_restore_failed",
      error?.message || "Failed to restore Bantah agent wallet from AgentKit.",
    );
  }
}

export async function getBantahAgentWalletBalance(params: {
  snapshot: StoredBantahAgentWalletSnapshot;
  chainId: number;
  chainConfig: OnchainChainConfig;
  tokenSymbol: OnchainTokenSymbol;
}): Promise<{
  walletAddress: `0x${string}`;
  walletNetworkId: string;
  amountAtomic: string;
  amountFormatted: string;
}> {
  const restoredWallet = await restoreBantahAgentWallet(params.snapshot, {
    targetChainId: params.chainId,
  });
  const tokenConfig = params.chainConfig.tokens[params.tokenSymbol];

  if (!tokenConfig) {
    throw new BantahAgentWalletError(
      "unsupported_chain",
      `Token ${params.tokenSymbol} is not configured on ${params.chainConfig.name}.`,
    );
  }

  let amountAtomic: bigint;
  if (tokenConfig.isNative) {
    amountAtomic = await restoredWallet.walletProvider.getBalance();
  } else {
    const tokenAddress = normalizeAddress(tokenConfig.address);
    if (!tokenAddress) {
      throw new BantahAgentWalletError(
        "unsupported_chain",
        `Token ${params.tokenSymbol} does not have a configured contract address on ${params.chainConfig.name}.`,
      );
    }

    const balanceResult = await restoredWallet.walletProvider.readContract({
      address: tokenAddress,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [restoredWallet.walletAddress],
    });
    amountAtomic = BigInt(String(balanceResult || "0"));
  }

  return {
    walletAddress: restoredWallet.walletAddress,
    walletNetworkId: restoredWallet.walletNetworkId,
    amountAtomic: amountAtomic.toString(),
    amountFormatted: trimFormattedAmount(formatUnits(amountAtomic, tokenConfig.decimals)),
  };
}

export async function executeBantahAgentEscrowStakeTx(params: {
  snapshot: StoredBantahAgentWalletSnapshot;
  chainId: number;
  chainConfig: OnchainChainConfig;
  tokenSymbol: OnchainTokenSymbol;
  amount: string | number;
  amountAtomic?: string | null;
}): Promise<{
  walletAddress: `0x${string}`;
  walletNetworkId: string;
  approveTxHash?: `0x${string}`;
  escrowTxHash: `0x${string}`;
}> {
  const restoredWallet = await restoreBantahAgentWallet(params.snapshot, {
    targetChainId: params.chainId,
  });
  const tokenConfig = params.chainConfig.tokens[params.tokenSymbol];
  const escrowAddress = normalizeAddress(params.chainConfig.escrowContractAddress);

  if (!tokenConfig) {
    throw new BantahAgentWalletError(
      "unsupported_chain",
      `Token ${params.tokenSymbol} is not configured on ${params.chainConfig.name}.`,
    );
  }
  if (!escrowAddress) {
    throw new BantahAgentWalletError(
      "unsupported_chain",
      `Escrow contract is not configured for ${params.chainConfig.name}.`,
    );
  }

  const rawAmountAtomic =
    typeof params.amountAtomic === "string" && /^\d+$/.test(params.amountAtomic.trim())
      ? BigInt(params.amountAtomic.trim())
      : parseStakeAtomicAmount(params.amount, tokenConfig.decimals);
  if (rawAmountAtomic <= 0n) {
    throw new BantahAgentWalletError(
      "transaction_incomplete",
      "Agent escrow amount must be greater than zero.",
    );
  }

  let availableAmountAtomic: bigint;
  if (tokenConfig.isNative) {
    availableAmountAtomic = await restoredWallet.walletProvider.getBalance();
  } else {
    const tokenAddress = normalizeAddress(tokenConfig.address);
    if (!tokenAddress) {
      throw new BantahAgentWalletError(
        "unsupported_chain",
        `Token ${params.tokenSymbol} does not have a configured contract address on ${params.chainConfig.name}.`,
      );
    }
    const balanceResult = await restoredWallet.walletProvider.readContract({
      address: tokenAddress,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [restoredWallet.walletAddress],
    });
    availableAmountAtomic = BigInt(String(balanceResult || "0"));
  }

  if (availableAmountAtomic < rawAmountAtomic) {
    const availableFormatted = formatAtomicAmount(availableAmountAtomic, tokenConfig.decimals);
    const requiredFormatted = formatAtomicAmount(rawAmountAtomic, tokenConfig.decimals);
    throw new BantahAgentWalletError(
      "insufficient_balance",
      `Agent wallet balance is too low for this ${params.tokenSymbol} stake. Available ${availableFormatted}, required ${requiredFormatted}.`,
    );
  }

  if (tokenConfig.isNative) {
    const nativeStakeData = encodeFunctionData({
      abi: escrowNativeAbi,
      functionName: "lockStakeNative",
      args: [],
    });
    const userOpHash = await restoredWallet.walletProvider.sendTransaction({
      to: escrowAddress,
      data: nativeStakeData,
      value: rawAmountAtomic,
    });
    const receipt = await restoredWallet.walletProvider.waitForTransactionReceipt(userOpHash);
    const escrowTxHash = extractTransactionHash(receipt);

    if (!escrowTxHash) {
      throw new BantahAgentWalletError(
        "transaction_incomplete",
        "Agent escrow transaction completed without an onchain transaction hash.",
      );
    }

    return {
      walletAddress: restoredWallet.walletAddress,
      walletNetworkId: restoredWallet.walletNetworkId,
      escrowTxHash,
    };
  }

  const tokenAddress = normalizeAddress(tokenConfig.address);
  if (!tokenAddress) {
    throw new BantahAgentWalletError(
      "unsupported_chain",
      `Token ${params.tokenSymbol} does not have a configured contract address on ${params.chainConfig.name}.`,
    );
  }

  const approveData = encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: "approve",
    args: [escrowAddress, rawAmountAtomic],
  });
  const approveUserOpHash = await restoredWallet.walletProvider.sendTransaction({
    to: tokenAddress,
    data: approveData,
    value: 0n,
  });
  const approveReceipt =
    await restoredWallet.walletProvider.waitForTransactionReceipt(approveUserOpHash);
  const approveTxHash = extractTransactionHash(approveReceipt);
  if (!approveTxHash) {
    throw new BantahAgentWalletError(
      "transaction_incomplete",
      "Agent token approval completed without an onchain transaction hash.",
    );
  }

  const erc20MethodSignature =
    params.chainConfig.escrowStakeMethodErc20?.trim() || "lockStakeToken(address,uint256)";
  const escrowData = buildErc20EscrowCalldata(
    erc20MethodSignature,
    tokenAddress,
    rawAmountAtomic,
  );
  const escrowUserOpHash = await restoredWallet.walletProvider.sendTransaction({
    to: escrowAddress,
    data: escrowData,
    value: 0n,
  });
  const escrowReceipt =
    await restoredWallet.walletProvider.waitForTransactionReceipt(escrowUserOpHash);
  const escrowTxHash = extractTransactionHash(escrowReceipt);
  if (!escrowTxHash) {
    throw new BantahAgentWalletError(
      "transaction_incomplete",
      "Agent escrow transaction completed without an onchain transaction hash.",
    );
  }

  return {
    walletAddress: restoredWallet.walletAddress,
    walletNetworkId: restoredWallet.walletNetworkId,
    approveTxHash,
    escrowTxHash,
  };
}

export function buildSkillSuccessEnvelope(requestId: string, result: unknown) {
  return {
    ok: true as const,
    requestId,
    skillVersion: BANTAH_SKILL_VERSION,
    result,
  };
}

export function buildSkillErrorEnvelope(
  requestId: string,
  code:
    | "insufficient_balance"
    | "market_closed"
    | "invalid_input"
    | "unauthorized"
    | "unsupported_action"
    | "rate_limited"
    | "internal_error",
  message: string,
  details?: Record<string, unknown>,
) {
  return {
    ok: false as const,
    requestId,
    skillVersion: BANTAH_SKILL_VERSION,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}
