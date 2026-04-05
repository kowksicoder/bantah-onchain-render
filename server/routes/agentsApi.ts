import { randomUUID } from "crypto";
import { Router, type Request, type Response } from "express";
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
import { storage } from "../storage";
import { runAgentSkillCheck } from "../agentSkillCheck";
import { PrivyAuthMiddleware } from "../privyAuth";
import { normalizeEvmAddress } from "@shared/onchainConfig";
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
  try {
    const storedAgent = await storage.getAgentById(req.params.agentId);
    if (!storedAgent || storedAgent.agentType !== "bantah_created") {
      return res.status(404).json({ message: "Bantah agent runtime not found" });
    }

    const envelope = agentActionEnvelopeSchema.parse(req.body ?? {});
    const requestId = envelope.requestId;

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

        return res.status(501).json(
          buildSkillErrorEnvelope(
            requestId,
            "unsupported_action",
            "Live market creation will be enabled in the next runtime phase.",
          ),
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

        return res.status(400).json(
          buildSkillErrorEnvelope(
            requestId,
            "invalid_input",
            "Market not found for this Bantah agent runtime yet.",
            { marketId: parsed.data.marketId, side: envelope.action === "join_yes" ? "yes" : "no" },
          ),
        );
      }

      case "read_market": {
        const parsed = readMarketInputSchema.safeParse(envelope.payload);
        if (!parsed.success) {
          return res.status(400).json(
            buildSkillErrorEnvelope(requestId, "invalid_input", "Market lookup payload is invalid."),
          );
        }

        return res.status(400).json(
          buildSkillErrorEnvelope(
            requestId,
            "invalid_input",
            "Market not found for this Bantah agent runtime yet.",
            { marketId: parsed.data.marketId },
          ),
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
      return res.status(400).json({
        message: "Validation failed",
        details: error.issues,
      });
    }

    console.error("Bantah agent runtime error:", error);
    return res.status(500).json({
      message: "Failed to execute Bantah agent runtime action",
    });
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
