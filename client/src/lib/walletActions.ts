import type { BantahBroPreparedWalletAction } from "@shared/bantahBroWallet";
import type { OnchainPublicConfig, OnchainChainConfig } from "@shared/onchainConfig";
import { encodeFunctionData, parseAbi, toHex } from "viem";
import { Attribution } from "ox/erc8021";

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
  "function transfer(address recipient, uint256 amount) returns (bool)",
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
  if (value < 0n) {
    throw new Error("Negative transaction value is invalid.");
  }
  return toHex(value);
}

function appendBuilderDataSuffix(data: `0x${string}`, chainId?: number): `0x${string}` {
  if (!chainId || !BASE_ATTRIBUTION_CHAIN_IDS.has(Number(chainId)) || !BASE_BUILDER_DATA_SUFFIX) {
    return data;
  }

  const normalizedData = String(data).toLowerCase();
  const suffixWithoutPrefix = BASE_BUILDER_DATA_SUFFIX.slice(2).toLowerCase();
  if (normalizedData.endsWith(suffixWithoutPrefix)) {
    return data;
  }

  return `${data}${BASE_BUILDER_DATA_SUFFIX.slice(2)}` as `0x${string}`;
}

function resolveWallet(wallets: PrivyWallet[], preferredAddress?: string | null) {
  if (!Array.isArray(wallets) || wallets.length === 0) {
    throw new Error("No connected wallet found. Connect your wallet and try again.");
  }

  const preferred = normalizeAddress(preferredAddress);
  if (!preferred) return wallets[0];

  return (
    wallets.find((wallet) => normalizeAddress(wallet?.address) === preferred) ||
    wallets[0]
  );
}

function resolveChainConfig(config: OnchainPublicConfig, chainId: number): OnchainChainConfig {
  return (
    config.chains[String(chainId)] ||
    config.chains[String(config.defaultChainId)] ||
    Object.values(config.chains || {})[0]
  );
}

function buildExplorerUrl(chain: OnchainChainConfig, txHash: string) {
  const baseUrl = String((chain as any).blockExplorerUrl || "").replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}/tx/${txHash}` : null;
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
  const txHash = normalizeHash(
    await params.provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: params.from,
          to: params.to,
          data: appendBuilderDataSuffix(params.data || "0x", params.chainId),
          value: params.value === undefined ? "0x0" : ensureHexQuantity(params.value),
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

export async function executeBantahBroPreparedWalletAction(params: {
  wallets: PrivyWallet[];
  preferredWalletAddress?: string | null;
  onchainConfig: OnchainPublicConfig;
  action: BantahBroPreparedWalletAction;
}) {
  const executionChainId =
    params.action.kind === "bridge" ? params.action.fromChainId : params.action.chainId;
  const chain = resolveChainConfig(params.onchainConfig, executionChainId);
  const wallet = resolveWallet(params.wallets, params.preferredWalletAddress);
  await wallet.switchChain(chain.chainId);
  const provider = await wallet.getEthereumProvider();
  const sender = normalizeAddress(wallet.address);
  if (!sender) {
    throw new Error("Connected wallet address is invalid.");
  }

  if (params.action.kind === "send") {
    if (params.action.token.isNative) {
      const txHash = await sendTransactionAndWait({
        provider,
        from: sender,
        to: params.action.recipientAddress,
        value: BigInt(params.action.amountAtomic),
        chainId: chain.chainId,
      });
      return {
        walletAddress: sender,
        chainId: chain.chainId,
        txHash,
        explorerUrl: buildExplorerUrl(chain, txHash),
      };
    }

    const tokenAddress = normalizeAddress(params.action.token.address);
    if (!tokenAddress) {
      throw new Error(`${params.action.token.symbol} is missing a token contract address.`);
    }

    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [params.action.recipientAddress as `0x${string}`, BigInt(params.action.amountAtomic)],
    });
    const txHash = await sendTransactionAndWait({
      provider,
      from: sender,
      to: tokenAddress,
      data: transferData,
      value: 0n,
      chainId: chain.chainId,
    });
    return {
      walletAddress: sender,
      chainId: chain.chainId,
      txHash,
      explorerUrl: buildExplorerUrl(chain, txHash),
    };
  }

  if (params.action.kind === "approve" || params.action.kind === "revoke") {
    const tokenAddress = normalizeAddress(params.action.token.address);
    if (!tokenAddress) {
      throw new Error(`${params.action.token.symbol} is missing a token contract address.`);
    }

    const approvalData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [params.action.spender as `0x${string}`, BigInt(params.action.amountAtomic)],
    });
    const txHash = await sendTransactionAndWait({
      provider,
      from: sender,
      to: tokenAddress,
      data: approvalData,
      value: 0n,
      chainId: chain.chainId,
    });
    return {
      walletAddress: sender,
      chainId: chain.chainId,
      txHash,
      explorerUrl: buildExplorerUrl(chain, txHash),
    };
  }

  if (params.action.kind === "swap" || params.action.kind === "bridge") {
    const sourceToken = params.action.kind === "swap" ? params.action.sellToken : params.action.token;
    let approvalTxHash: `0x${string}` | undefined;

    if (!sourceToken.isNative && params.action.quote.allowanceTarget) {
      const tokenAddress = normalizeAddress(sourceToken.address);
      const allowanceTarget = normalizeAddress(params.action.quote.allowanceTarget);
      const amountAtomic =
        params.action.kind === "swap" ? params.action.sellAmountAtomic : params.action.amountAtomic;
      if (!tokenAddress || !allowanceTarget) {
        throw new Error("Swap approval target is invalid.");
      }

      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [allowanceTarget, BigInt(amountAtomic)],
      });
      approvalTxHash = await sendTransactionAndWait({
        provider,
        from: sender,
        to: tokenAddress,
        data: approveData,
        value: 0n,
        chainId: chain.chainId,
      });
    }

    const txHash = await sendTransactionAndWait({
      provider,
      from: sender,
      to: params.action.quote.transaction.to,
      data: params.action.quote.transaction.data as `0x${string}`,
      value:
        params.action.quote.transaction.value != null
          ? BigInt(params.action.quote.transaction.value)
          : 0n,
      chainId: chain.chainId,
    });

    return {
      walletAddress: sender,
      chainId: chain.chainId,
      approvalTxHash,
      txHash,
      explorerUrl: buildExplorerUrl(chain, txHash),
      approvalExplorerUrl: approvalTxHash ? buildExplorerUrl(chain, approvalTxHash) : null,
    };
  }

  throw new Error("Unsupported wallet action.");
}
