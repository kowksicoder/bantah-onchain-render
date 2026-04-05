import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import dotenv from "dotenv";
import { BANTAH_SKILL_VERSION, bantahRequiredSkillActionValues } from "@shared/agentSkill";

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

type AgentKitLikeModule = {
  CdpSmartWalletProvider: {
    configureWithWallet(config: {
      networkId: string;
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
