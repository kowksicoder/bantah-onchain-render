import { randomUUID } from "crypto";
import { Router, type Request, type Response } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ZodError } from "zod";
import {
  agentImportRequestSchema,
  agentListQuerySchema,
  agentCreateRequestSchema,
  agentSkillCheckRequestSchema,
  bantahAgentKitSupportedChainIds,
  getBantahAgentKitNetworkIdForChainId,
  type AgentRegistryProfile,
} from "@shared/agentApi";
import {
  agentActionEnvelopeSchema,
  BANTAH_SKILL_VERSION,
  checkBalanceInputSchema,
  createMarketInputSchema,
  joinMarketInputSchema,
  readMarketInputSchema,
} from "@shared/agentSkill";
import { agents, pairQueue } from "@shared/schema";
import {
  normalizeOnchainTokenSymbol,
  toAtomicUnits,
  type OnchainTokenSymbol,
} from "@shared/onchainConfig";
import { storage } from "../storage";
import { db } from "../db";
import { createPairingEngine } from "../pairingEngine";
import { runAgentSkillCheck } from "../agentSkillCheck";
import { PrivyAuthMiddleware } from "../privyAuth";
import { normalizeEvmAddress } from "@shared/onchainConfig";
import { getOnchainServerConfig } from "../onchainConfig";
import {
  buildBantahElizaCharacter,
  buildBantahElizaRuntimeConfig,
} from "../elizaAgentBuilder";
import {
  executeManagedBantahAgentRuntimeAction,
  startManagedBantahAgentRuntime,
  stopManagedBantahAgentRuntime,
} from "../bantahElizaRuntimeManager";
import {
  BantahAgentWalletError,
  buildBantahAgentEndpointUrl,
  executeBantahAgentEscrowStakeTx,
  getBantahAgentWalletBalance,
  buildSkillErrorEnvelope,
  buildSkillSuccessEnvelope,
  DEFAULT_BANTAH_AGENT_SKILLS,
  provisionBantahAgentWallet,
} from "../agentProvisioning";
import { assertAllowedStakeToken } from "../onchainEscrowService";
import { serializeBantahSkillError } from "../bantahAgentSkillExecutor";

const router = Router();
const MAX_AGENT_IMPORTS_PER_DAY = 5;
const ONCHAIN_CONFIG = getOnchainServerConfig();
const pairingEngine = createPairingEngine(db);

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
  };
};

class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function getAuthenticatedUserId(req: Request): string {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) {
    throw new HttpError(401, "Unauthorized");
  }
  return userId;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseRuntimeMarketId(marketId: string): number {
  const numericMarketId = Number.parseInt(String(marketId || "").trim(), 10);
  if (!Number.isInteger(numericMarketId) || numericMarketId <= 0) {
    throw new HttpError(400, "Market id must be a valid Bantah challenge id");
  }
  return numericMarketId;
}

function parseStakeAmount(stakeAmount: string): { parsedAmount: number; roundedAmount: number } {
  const parsedAmount = Number.parseFloat(String(stakeAmount || "").trim());
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new HttpError(400, "Stake amount must be a valid positive number");
  }

  return {
    parsedAmount,
    roundedAmount: Math.max(1, Math.round(parsedAmount)),
  };
}

function mergeEscrowTxHashes(existing: unknown, incomingHash: string): string {
  const incoming = String(incomingHash || "").trim().toLowerCase();
  if (!incoming) return String(existing || "");

  const raw = String(existing || "").trim();
  if (!raw) return incoming;

  if (raw.toLowerCase().includes(incoming)) {
    return raw;
  }

  return `${raw},${incoming}`;
}

function resolveOnchainRuntimeToken(chainId: number, currency: string) {
  const tokenSymbol = normalizeOnchainTokenSymbol(currency) as OnchainTokenSymbol;
  const chainConfig = ONCHAIN_CONFIG.chains[String(chainId)];

  if (!chainConfig) {
    throw new HttpError(400, "Unsupported chain for Bantah agent runtime");
  }

  const tokenConfig = chainConfig.tokens[tokenSymbol];
  const isSupportedToken = Array.isArray(chainConfig.supportedTokens)
    ? chainConfig.supportedTokens.includes(tokenSymbol)
    : Boolean(tokenConfig);

  if (!tokenConfig || !isSupportedToken) {
    throw new HttpError(400, `Token ${tokenSymbol} is not supported on chain ${chainConfig.name}`);
  }

  return { chainConfig, tokenConfig, tokenSymbol };
}

async function getRuntimeMarketSnapshot(challengeId: number) {
  const challenge = await storage.getChallengeById(challengeId);
  if (!challenge) {
    throw new HttpError(404, "Market not found");
  }

  const queueEntries = await db
    .select({
      userId: pairQueue.userId,
      participantType: pairQueue.participantType,
      agentId: pairQueue.agentId,
      side: pairQueue.side,
      stakeAmount: pairQueue.stakeAmount,
      status: pairQueue.status,
      createdAt: pairQueue.createdAt,
    })
    .from(pairQueue)
    .where(
      and(
        eq(pairQueue.challengeId, challengeId),
        inArray(pairQueue.status, ["waiting", "matched"]),
      ),
    )
    .orderBy(asc(pairQueue.createdAt));

  const participants = queueEntries.map((entry) => {
    const participantType =
      String(entry.participantType || "").trim().toLowerCase() === "agent" && entry.agentId
        ? "agent"
        : "human";
    const participantId =
      participantType === "agent"
        ? String(entry.agentId || "")
        : String(entry.userId || "");

    return {
      participantId,
      participantType: participantType as "agent" | "human",
      side: String(entry.side || "").trim().toLowerCase() === "no" ? "no" : "yes",
      stakeAmount: String(entry.stakeAmount || 0),
      createdAt: entry.createdAt ? new Date(entry.createdAt) : null,
    };
  });

  const yesPool = participants
    .filter((participant) => participant.side === "yes")
    .reduce((total, participant) => total + Number.parseFloat(participant.stakeAmount || "0"), 0);
  const noPool = participants
    .filter((participant) => participant.side === "no")
    .reduce((total, participant) => total + Number.parseFloat(participant.stakeAmount || "0"), 0);
  const totalPool = yesPool + noPool;

  const rawStatus = String(challenge.status || "").trim().toLowerCase();
  const dueDateIso = toIsoString(challenge.dueDate);
  const dueDateMs = dueDateIso ? new Date(dueDateIso).getTime() : NaN;

  let status: "open" | "pending" | "matched" | "settled" | "cancelled" = "open";
  if (rawStatus === "completed") {
    status = "settled";
  } else if (rawStatus === "cancelled" || rawStatus === "disputed") {
    status = "cancelled";
  } else if (rawStatus === "active" || (yesPool > 0 && noPool > 0)) {
    status = "matched";
  } else if ((yesPool > 0 || noPool > 0) || (Number.isFinite(dueDateMs) && dueDateMs <= Date.now())) {
    status = "pending";
  }

  return {
    challenge,
    participants,
    yesPool,
    noPool,
    totalPool,
    dueDateIso,
    status,
  };
}

async function serializeAgent(agentId: string): Promise<AgentRegistryProfile> {
  const storedAgent = await storage.getAgentById(agentId);
  if (!storedAgent) {
    throw new HttpError(404, "Agent not found");
  }

  return {
    agentId: storedAgent.agentId,
    ownerId: storedAgent.ownerId,
    agentName: storedAgent.agentName,
    agentType: storedAgent.agentType,
    walletAddress: storedAgent.walletAddress,
    endpointUrl: storedAgent.endpointUrl,
    bantahSkillVersion: storedAgent.bantahSkillVersion,
    specialty: storedAgent.specialty,
    status: storedAgent.status,
    skillActions: Array.isArray((storedAgent as any).skillActions)
      ? (storedAgent as any).skillActions
      : [],
    walletNetworkId: (storedAgent as any).walletNetworkId ?? null,
    walletProvider: (storedAgent as any).walletProvider ?? null,
    runtimeEngine: (storedAgent as any).runtimeEngine ?? null,
    runtimeStatus: (storedAgent as any).runtimeStatus ?? null,
    points: storedAgent.points,
    winCount: storedAgent.winCount,
    lossCount: storedAgent.lossCount,
    marketCount: storedAgent.marketCount,
    isTokenized: storedAgent.isTokenized,
    lastSkillCheckAt: toIsoString(storedAgent.lastSkillCheckAt),
    lastSkillCheckScore: storedAgent.lastSkillCheckScore,
    lastSkillCheckStatus:
      storedAgent.lastSkillCheckStatus === "passed" || storedAgent.lastSkillCheckStatus === "failed"
        ? storedAgent.lastSkillCheckStatus
        : null,
    createdAt: toIsoString(storedAgent.createdAt),
    updatedAt: toIsoString(storedAgent.updatedAt),
    owner: {
      id: storedAgent.owner.id,
      username: storedAgent.owner.username ?? null,
      firstName: storedAgent.owner.firstName ?? null,
      lastName: storedAgent.owner.lastName ?? null,
      profileImageUrl: storedAgent.owner.profileImageUrl ?? null,
    },
  };
}

function handleError(res: Response, error: unknown) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      details: error.issues,
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({
      message: error.message,
      details: error.details,
    });
  }

  console.error("Agents API error:", error);
  return res.status(500).json({ message: "Failed to process agent request" });
}

router.post("/skill-check", async (req, res) => {
  try {
    const parsedBody = agentSkillCheckRequestSchema.parse(req.body ?? {});
    const skillCheck = await runAgentSkillCheck(parsedBody.endpointUrl);
    res.json(skillCheck);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/import", PrivyAuthMiddleware, async (req, res) => {
  try {
    const ownerId = getAuthenticatedUserId(req);
    const parsedBody = agentImportRequestSchema.parse(req.body ?? {});
    const normalizedWalletAddress = normalizeEvmAddress(parsedBody.walletAddress);

    if (!normalizedWalletAddress) {
      throw new HttpError(400, "Wallet address must be a valid EVM address");
    }

    const normalizedEndpointUrl = new URL(parsedBody.endpointUrl).toString();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const importCount = await storage.countImportedAgentsByOwnerSince(ownerId, startOfDay);
    if (importCount >= MAX_AGENT_IMPORTS_PER_DAY) {
      throw new HttpError(429, "Daily import limit reached", {
        limit: MAX_AGENT_IMPORTS_PER_DAY,
      });
    }

    const [existingByWallet, existingByEndpoint] = await Promise.all([
      storage.getAgentByWalletAddress(normalizedWalletAddress),
      storage.getAgentByEndpointUrl(normalizedEndpointUrl),
    ]);

    if (existingByWallet) {
      throw new HttpError(409, "An agent with this wallet address is already registered");
    }

    if (existingByEndpoint) {
      throw new HttpError(409, "An agent with this endpoint URL is already registered");
    }

    const skillCheck = await runAgentSkillCheck(normalizedEndpointUrl);
    if (!skillCheck.overallPassed) {
      throw new HttpError(422, "Agent did not pass Bantah skill verification", skillCheck);
    }

    const createdAgent = await storage.createAgent({
      ownerId,
      agentName: parsedBody.agentName,
      agentType: "imported",
      walletAddress: normalizedWalletAddress,
      endpointUrl: normalizedEndpointUrl,
      bantahSkillVersion: "1.0.0",
      specialty: parsedBody.specialty,
      status: "active",
      isTokenized: parsedBody.isTokenized,
      lastSkillCheckAt: new Date(skillCheck.checkedAt),
      lastSkillCheckScore: skillCheck.complianceScore,
      lastSkillCheckStatus: "passed",
    });

    const agent = await serializeAgent(createdAgent.agentId);
    res.status(201).json({ agent, skillCheck });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/create", PrivyAuthMiddleware, async (req, res) => {
  try {
    const ownerId = getAuthenticatedUserId(req);
    const parsedBody = agentCreateRequestSchema.parse(req.body ?? {});
    const agentId = randomUUID();
    const endpointUrl = buildBantahAgentEndpointUrl(agentId);
    const requestedChainId = Number(parsedBody.chainId || ONCHAIN_CONFIG.defaultChainId || 8453);
    const requestedChainConfig = ONCHAIN_CONFIG.chains[String(requestedChainId)];
    const requestedNetworkId = getBantahAgentKitNetworkIdForChainId(requestedChainId);

    if (!requestedNetworkId) {
      throw new HttpError(
        422,
        `Coinbase AgentKit smart-wallet provisioning is not available on ${
          requestedChainConfig?.name || `chain ${requestedChainId}`
        } yet.`,
        {
          chainId: requestedChainId,
          supportedChainIds: bantahAgentKitSupportedChainIds,
        },
      );
    }

    const existingByEndpoint = await storage.getAgentByEndpointUrl(endpointUrl);
    if (existingByEndpoint) {
      throw new HttpError(409, "A Bantah agent with this endpoint already exists");
    }

    const provisionedWallet = await provisionBantahAgentWallet(agentId, requestedNetworkId);
    const existingByWallet = await storage.getAgentByWalletAddress(provisionedWallet.walletAddress);
    if (existingByWallet) {
      throw new HttpError(409, "A Bantah agent wallet collision occurred. Please try again.");
    }

    const elizaCharacter = buildBantahElizaCharacter({
      agentId,
      agentName: parsedBody.agentName.trim(),
      specialty: parsedBody.specialty,
      walletAddress: provisionedWallet.walletAddress,
      chainId: requestedChainId,
      chainName: requestedChainConfig?.name || `Chain ${requestedChainId}`,
      walletNetworkId: provisionedWallet.walletNetworkId,
      skillActions: [...DEFAULT_BANTAH_AGENT_SKILLS],
      endpointUrl,
    });
    const elizaRuntime = buildBantahElizaRuntimeConfig({
      agentId,
      endpointUrl,
      chainId: requestedChainId,
      chainName: requestedChainConfig?.name || `Chain ${requestedChainId}`,
      walletAddress: provisionedWallet.walletAddress,
      walletNetworkId: provisionedWallet.walletNetworkId,
      walletProvider: provisionedWallet.walletProvider,
      skillActions: [...DEFAULT_BANTAH_AGENT_SKILLS],
      character: elizaCharacter,
    });

    await storage.createAgent({
      agentId,
      ownerId,
      agentName: parsedBody.agentName.trim(),
      agentType: "bantah_created",
      walletAddress: provisionedWallet.walletAddress,
      endpointUrl,
      bantahSkillVersion: BANTAH_SKILL_VERSION,
      specialty: parsedBody.specialty,
      status: "active",
      skillActions: DEFAULT_BANTAH_AGENT_SKILLS,
      walletNetworkId: provisionedWallet.walletNetworkId,
      walletProvider: provisionedWallet.walletProvider,
      ownerWalletAddress: provisionedWallet.ownerWalletAddress,
      walletData: provisionedWallet.walletData,
      runtimeEngine: elizaRuntime.engine,
      runtimeStatus: elizaRuntime.status,
      runtimeConfig: elizaRuntime,
      isTokenized: false,
    });

    let activeRuntimeConfig = elizaRuntime;
    try {
      activeRuntimeConfig = await startManagedBantahAgentRuntime(agentId);
    } catch (error: any) {
      await db.delete(agents).where(eq(agents.agentId, agentId));
      throw new HttpError(
        502,
        error?.message || "Failed to start Bantah Eliza runtime.",
      );
    }

    let skillCheck;
    try {
      skillCheck = await runAgentSkillCheck(endpointUrl);
    } catch (error) {
      await stopManagedBantahAgentRuntime(agentId, { persist: false });
      await db.delete(agents).where(eq(agents.agentId, agentId));
      throw error;
    }
    await storage.updateAgentSkillCheck(agentId, {
      bantahSkillVersion: BANTAH_SKILL_VERSION,
      lastSkillCheckAt: new Date(skillCheck.checkedAt),
      lastSkillCheckScore: skillCheck.complianceScore,
      lastSkillCheckStatus: skillCheck.overallPassed ? "passed" : "failed",
    });

    const agent = await serializeAgent(agentId);
    res.status(201).json({
      agent,
      provisioned: {
        walletAddress: provisionedWallet.walletAddress,
        endpointUrl,
        chainId: requestedChainId,
        walletNetworkId: provisionedWallet.walletNetworkId,
        walletProvider: provisionedWallet.walletProvider,
        skillActions: DEFAULT_BANTAH_AGENT_SKILLS,
      },
      runtime: activeRuntimeConfig,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/", async (req, res) => {
  try {
    const parsedQuery = agentListQuerySchema.parse(req.query ?? {});
    const status = parsedQuery.status ?? "active";
    const { items, total } = await storage.listAgents({
      ...parsedQuery,
      status,
    });

    const serializedItems = items.map((item) => ({
      agentId: item.agentId,
      ownerId: item.ownerId,
      agentName: item.agentName,
      agentType: item.agentType,
      walletAddress: item.walletAddress,
      endpointUrl: item.endpointUrl,
      bantahSkillVersion: item.bantahSkillVersion,
      specialty: item.specialty,
      status: item.status,
      skillActions: Array.isArray((item as any).skillActions) ? (item as any).skillActions : [],
      walletNetworkId: (item as any).walletNetworkId ?? null,
      walletProvider: (item as any).walletProvider ?? null,
      runtimeEngine: (item as any).runtimeEngine ?? null,
      runtimeStatus: (item as any).runtimeStatus ?? null,
      points: item.points,
      winCount: item.winCount,
      lossCount: item.lossCount,
      marketCount: item.marketCount,
      isTokenized: item.isTokenized,
      lastSkillCheckAt: toIsoString(item.lastSkillCheckAt),
      lastSkillCheckScore: item.lastSkillCheckScore,
      lastSkillCheckStatus:
        item.lastSkillCheckStatus === "passed" || item.lastSkillCheckStatus === "failed"
          ? item.lastSkillCheckStatus
          : null,
      createdAt: toIsoString(item.createdAt),
      updatedAt: toIsoString(item.updatedAt),
      owner: {
        id: item.owner.id,
        username: item.owner.username ?? null,
        firstName: item.owner.firstName ?? null,
        lastName: item.owner.lastName ?? null,
        profileImageUrl: item.owner.profileImageUrl ?? null,
      },
    }));

    res.json({
      items: serializedItems,
      pagination: {
        page: parsedQuery.page,
        limit: parsedQuery.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / parsedQuery.limit),
      },
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/runtime/:agentId", async (req, res) => {
  let requestId =
    typeof req.body?.requestId === "string" && req.body.requestId.trim().length > 0
      ? req.body.requestId.trim()
      : `runtime_${req.params.agentId}`;

  try {
    const storedAgent = await storage.getAgentById(req.params.agentId);
    if (!storedAgent || storedAgent.agentType !== "bantah_created") {
      return res.status(404).json({ message: "Bantah agent runtime not found" });
    }

    const envelope = agentActionEnvelopeSchema.parse(req.body ?? {});
    requestId = envelope.requestId;
    const runtimeResponse = await executeManagedBantahAgentRuntimeAction(
      storedAgent.agentId,
      envelope,
    );
    return res.status(runtimeResponse.status).json(runtimeResponse.envelope);
  } catch (error) {
    const response = serializeBantahSkillError(requestId, error);
    return res.status(response.status).json(response.envelope);
  }
});

router.get("/:agentId", async (req, res) => {
  try {
    const agent = await serializeAgent(req.params.agentId);
    res.json(agent);
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
