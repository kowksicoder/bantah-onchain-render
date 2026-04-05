import { randomUUID } from "crypto";
import { Router, type Request, type Response } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ZodError } from "zod";
import {
  agentImportRequestSchema,
  agentListQuerySchema,
  agentCreateRequestSchema,
  agentSkillCheckRequestSchema,
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
import { pairQueue } from "@shared/schema";
import {
  normalizeOnchainTokenSymbol,
  toAtomicUnits,
  type OnchainTokenSymbol,
} from "@shared/onchainConfig";
import { storage } from "../storage";
import { db } from "../db";
import { runAgentSkillCheck } from "../agentSkillCheck";
import { PrivyAuthMiddleware } from "../privyAuth";
import { normalizeEvmAddress } from "@shared/onchainConfig";
import { getOnchainServerConfig } from "../onchainConfig";
import {
  buildBantahAgentEndpointUrl,
  buildSkillErrorEnvelope,
  buildSkillSuccessEnvelope,
  DEFAULT_BANTAH_AGENT_NETWORK_ID,
  DEFAULT_BANTAH_AGENT_SKILLS,
  provisionBantahAgentWallet,
} from "../agentProvisioning";

const router = Router();
const MAX_AGENT_IMPORTS_PER_DAY = 5;
const ONCHAIN_CONFIG = getOnchainServerConfig();

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

    const existingByEndpoint = await storage.getAgentByEndpointUrl(endpointUrl);
    if (existingByEndpoint) {
      throw new HttpError(409, "A Bantah agent with this endpoint already exists");
    }

    const provisionedWallet = await provisionBantahAgentWallet(
      agentId,
      DEFAULT_BANTAH_AGENT_NETWORK_ID,
    );
    const existingByWallet = await storage.getAgentByWalletAddress(provisionedWallet.walletAddress);
    if (existingByWallet) {
      throw new HttpError(409, "A Bantah agent wallet collision occurred. Please try again.");
    }

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
      isTokenized: false,
    });

    const skillCheck = await runAgentSkillCheck(endpointUrl);
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
        walletNetworkId: provisionedWallet.walletNetworkId,
        walletProvider: provisionedWallet.walletProvider,
        skillActions: DEFAULT_BANTAH_AGENT_SKILLS,
      },
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

    switch (envelope.action) {
      case "create_market": {
        const parsed = createMarketInputSchema.safeParse(envelope.payload);
        if (!parsed.success) {
          return res.status(400).json(
            buildSkillErrorEnvelope(requestId, "invalid_input", "Market payload is invalid."),
          );
        }

        const deadline = new Date(parsed.data.deadline);
        if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
          return res.status(400).json(
            buildSkillErrorEnvelope(
              requestId,
              "invalid_input",
              "Deadline must be a future ISO datetime.",
            ),
          );
        }

        const { tokenConfig, tokenSymbol, chainConfig } = resolveOnchainRuntimeToken(
          parsed.data.chainId,
          parsed.data.currency,
        );
        const { roundedAmount } = parseStakeAmount(parsed.data.stakeAmount);
        const createdChallenge = await storage.createAdminChallenge({
          title: parsed.data.question.trim(),
          description: `Created by ${storedAgent.agentName} via Bantah agent runtime`,
          category: storedAgent.specialty === "general" ? "general" : storedAgent.specialty,
          amount: roundedAmount,
          status: "open",
          creatorType: "agent",
          creatorAgentId: storedAgent.agentId,
          createdByAgent: true,
          agentInvolved: true,
          dueDate: deadline,
          settlementRail: "onchain",
          chainId: chainConfig.chainId,
          tokenSymbol,
          tokenAddress: tokenConfig.address,
          decimals: tokenConfig.decimals,
          stakeAtomic: toAtomicUnits(parsed.data.stakeAmount, tokenConfig.decimals),
          evidence: {
            source: "bantah_agent_runtime",
            createdByAgentId: storedAgent.agentId,
            marketOptions: parsed.data.options,
          },
        } as any);

        await storage.incrementAgentMarketCount(storedAgent.agentId);

        return res.json(
          buildSkillSuccessEnvelope(requestId, {
            marketId: String(createdChallenge.id),
            status: "open",
            question: createdChallenge.title,
            options: parsed.data.options.map((label, index) => ({
              id: `option_${index + 1}`,
              label,
            })),
            deadline: deadline.toISOString(),
            stakeAmount: parsed.data.stakeAmount,
            currency: parsed.data.currency,
            creatorWalletAddress: storedAgent.walletAddress,
          }),
        );
      }

      case "join_yes":
      case "join_no": {
        const parsed = joinMarketInputSchema.safeParse(envelope.payload);
        if (!parsed.success) {
          return res.status(400).json(
            buildSkillErrorEnvelope(requestId, "invalid_input", "Join payload is invalid."),
          );
        }

        const numericMarketId = parseRuntimeMarketId(parsed.data.marketId);
        const { challenge, dueDateIso } = await getRuntimeMarketSnapshot(numericMarketId);
        const side = envelope.action === "join_yes" ? "yes" : "no";
        const { roundedAmount } = parseStakeAmount(parsed.data.stakeAmount);

        if (!challenge.adminCreated && challenge.createdByAgent !== true) {
          return res.status(501).json(
            buildSkillErrorEnvelope(
              requestId,
              "unsupported_action",
              "Agent joins are currently limited to open Bantah market feeds.",
              { marketId: parsed.data.marketId },
            ),
          );
        }

        if (String(challenge.status || "").trim().toLowerCase() !== "open") {
          return res.status(409).json(
            buildSkillErrorEnvelope(requestId, "market_closed", "Market is no longer open.", {
              marketId: parsed.data.marketId,
            }),
          );
        }

        if (dueDateIso && new Date(dueDateIso).getTime() <= Date.now()) {
          return res.status(409).json(
            buildSkillErrorEnvelope(
              requestId,
              "market_closed",
              "Market deadline has already passed.",
              { marketId: parsed.data.marketId },
            ),
          );
        }

        if (String(challenge.settlementRail || "").trim().toLowerCase() === "onchain") {
          return res.status(501).json(
            buildSkillErrorEnvelope(
              requestId,
              "unsupported_action",
              "Wallet-backed onchain agent staking is not live yet. Market creation and reads are enabled first.",
              { marketId: parsed.data.marketId, side },
            ),
          );
        }

        if (String(challenge.tokenSymbol || "USDC").trim().toUpperCase() !== "USDC") {
          return res.status(501).json(
            buildSkillErrorEnvelope(
              requestId,
              "unsupported_action",
              "This runtime phase only supports USDC market joins.",
              { marketId: parsed.data.marketId },
            ),
          );
        }

        const requiredAmount = Number(challenge.amount || 0);
        if (!Number.isInteger(requiredAmount) || requiredAmount <= 0 || roundedAmount !== requiredAmount) {
          return res.status(400).json(
            buildSkillErrorEnvelope(
              requestId,
              "invalid_input",
              `Market requires exactly ${requiredAmount} USDC for each entry.`,
              { marketId: parsed.data.marketId, requiredAmount: String(requiredAmount) },
            ),
          );
        }

        const [existingEntry] = await db
          .select({
            id: pairQueue.id,
            status: pairQueue.status,
          })
          .from(pairQueue)
          .where(
            and(
              eq(pairQueue.challengeId, numericMarketId),
              eq(pairQueue.agentId, storedAgent.agentId),
              inArray(pairQueue.status, ["waiting", "matched"]),
            ),
          )
          .limit(1);

        if (existingEntry) {
          return res.json(
            buildSkillSuccessEnvelope(requestId, {
              marketId: String(numericMarketId),
              side,
              acceptedStakeAmount: String(requiredAmount),
              currency: "USDC",
              status: existingEntry.status === "matched" ? "matched" : "queued",
            }),
          );
        }

        const ownerBalance = await storage.getUserBalance(storedAgent.ownerId);
        if (Number(ownerBalance.balance || 0) < requiredAmount) {
          return res.status(409).json(
            buildSkillErrorEnvelope(
              requestId,
              "insufficient_balance",
              "Agent owner does not have enough offchain balance to queue this market.",
              { marketId: parsed.data.marketId, requiredAmount: String(requiredAmount) },
            ),
          );
        }

        await db.insert(pairQueue).values({
          challengeId: numericMarketId,
          userId: storedAgent.ownerId,
          participantType: "agent",
          agentId: storedAgent.agentId,
          side: side.toUpperCase(),
          stakeAmount: requiredAmount,
          status: "waiting",
          createdAt: new Date(),
        } as any);

        await storage.createTransaction({
          userId: storedAgent.ownerId,
          type: "challenge_queue_stake",
          amount: `-${requiredAmount}`,
          description: `Agent ${storedAgent.agentName} queued on challenge #${numericMarketId} (${side.toUpperCase()})`,
          relatedId: numericMarketId,
          status: "completed",
        });

        return res.json(
          buildSkillSuccessEnvelope(requestId, {
            marketId: String(numericMarketId),
            side,
            acceptedStakeAmount: String(requiredAmount),
            currency: "USDC",
            status: "queued",
          }),
        );
      }

      case "read_market": {
        const parsed = readMarketInputSchema.safeParse(envelope.payload);
        if (!parsed.success) {
          return res.status(400).json(
            buildSkillErrorEnvelope(requestId, "invalid_input", "Market lookup payload is invalid."),
          );
        }

        const numericMarketId = parseRuntimeMarketId(parsed.data.marketId);
        const marketSnapshot = await getRuntimeMarketSnapshot(numericMarketId);

        if (!marketSnapshot.dueDateIso) {
          return res.status(400).json(
            buildSkillErrorEnvelope(
              requestId,
              "invalid_input",
              "Market exists but does not have a valid deadline.",
              { marketId: parsed.data.marketId },
            ),
          );
        }

        const yesOdds = marketSnapshot.totalPool > 0
          ? marketSnapshot.yesPool / marketSnapshot.totalPool
          : 0.5;
        const noOdds = marketSnapshot.totalPool > 0
          ? marketSnapshot.noPool / marketSnapshot.totalPool
          : 0.5;

        return res.json(
          buildSkillSuccessEnvelope(requestId, {
            marketId: String(numericMarketId),
            status: marketSnapshot.status,
            odds: {
              yes: Number(yesOdds.toFixed(4)),
              no: Number(noOdds.toFixed(4)),
            },
            participants: marketSnapshot.participants.map((participant) => ({
              participantId: participant.participantId,
              participantType: participant.participantType,
              side: participant.side,
              stakeAmount: participant.stakeAmount,
            })),
            deadline: marketSnapshot.dueDateIso,
            totalPool: String(marketSnapshot.totalPool),
            yesPool: String(marketSnapshot.yesPool),
            noPool: String(marketSnapshot.noPool),
          }),
        );
      }

      case "check_balance": {
        const parsed = checkBalanceInputSchema.safeParse(envelope.payload);
        if (!parsed.success) {
          return res.status(400).json(
            buildSkillErrorEnvelope(requestId, "invalid_input", "Balance payload is invalid."),
          );
        }

        return res.json(
          buildSkillSuccessEnvelope(requestId, {
            walletAddress: storedAgent.walletAddress,
            currency: parsed.data.currency,
            chainId: parsed.data.chainId,
            availableBalance: "0",
            updatedAt: new Date().toISOString(),
          }),
        );
      }

      default:
        return res.status(501).json(
          buildSkillErrorEnvelope(
            requestId,
            "unsupported_action",
            `Action ${envelope.action} is not supported by the Bantah runtime yet.`,
          ),
        );
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json(
        buildSkillErrorEnvelope(requestId, "invalid_input", "Runtime payload failed validation.", {
          issues: error.issues,
        }),
      );
    }

    if (error instanceof HttpError) {
      const code =
        error.status === 401
          ? "unauthorized"
          : error.status === 429
            ? "rate_limited"
            : error.status === 500
              ? "internal_error"
              : "invalid_input";

      return res.status(error.status).json(
        buildSkillErrorEnvelope(
          requestId,
          code,
          error.message,
          error.details && typeof error.details === "object"
            ? (error.details as Record<string, unknown>)
            : undefined,
        ),
      );
    }

    console.error("Bantah agent runtime error:", error);
    return res.status(500).json(
      buildSkillErrorEnvelope(
        requestId,
        "internal_error",
        "Failed to execute Bantah agent runtime action",
      ),
    );
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
