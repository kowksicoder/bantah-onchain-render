import { Router } from "express";
import { z, ZodError } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  bantahBroAlertSchema,
  bantahBroBoostMarketRequestSchema,
  bantahBroBxbtRewardRequestSchema,
  bantahBroBxbtSpendRequestSchema,
  bantahBroCreateMarketFromSignalRequestSchema,
  bantahBroCreateP2PMarketRequestSchema,
  bantahBroEnsureSystemAgentRequestSchema,
  bantahBroEvaluateReceiptRequestSchema,
  bantahBroPublishAlertRequestSchema,
  bantahBroTokenRefSchema,
} from "@shared/bantahBro";
import { analyzeToken } from "../bantahBro/tokenIntelligence";
import {
  getBantahBroAlert,
  listBantahBroAlerts,
  listBantahBroReceiptsByToken,
  listMarketBoosts,
  publishBantahBroAlert,
  publishBantahBroReceipt,
} from "../bantahBro/alertFeed";
import { buildAlertFromAnalysis, buildReceiptFromAlert } from "../bantahBro/contentEngine";
import {
  boostBantahBroMarket,
  createBantahBroMarketFromSignal,
} from "../bantahBro/marketService";
import {
  createBantahBroP2PMarket,
  getBantahBroLeaderboard,
} from "../bantahBro/communityService";
import {
  getLiveBantahBroLeaderboard,
  getLiveBantahBroMarkets,
} from "../bantahBro/liveDiscoveryService";
import { getBantahBroHotTickers } from "../bantahBro/hotTickersService";
import {
  ensureBantahBroSystemAgent,
  ensureBantahBroTelegramRuntimeStarted,
  getBantahBroSystemAgentStatus,
  isBantahBroElizaTelegramEnabled,
  reprovisionBantahBroSystemAgentWallet,
} from "../bantahBro/systemAgent";
import { getBantahBroAutomationStatus } from "../bantahBro/automationService";
import {
  buildCurrentBattleTweetDraft,
  buildCurrentBattleThreadDraft,
  getBantahBroTwitterAgentStatus,
  postCurrentBattleMediaTweet,
  postCurrentBattleThread,
  postCurrentBattleTweet,
  previewBantahBroTwitterAgentResponse,
  runBantahBroTwitterAgentCycle,
} from "../bantahBro/twitterAgentService";
import {
  getBantahBroBxbtStatus,
  rewardBantahBroBxbt,
  spendBantahBroBxbt,
} from "../bantahBro/bxbtUtility";
import {
  deployBantahLaunchToken,
  getBantahLauncherStatus,
  listBantahTokenLaunches,
  validateBantahLaunchDraft,
} from "../bantahBro/tokenLauncher";
import { handleTokenLaunchIntent } from "../bantahBro/launchIntent";
import {
  getBantahBroSocialFeed,
  type BantahBroFeedSource,
} from "../bantahBro/socialFeedService";
import { getLiveBantahBroAgentBattles } from "../bantahBro/agentBattleService";
import {
  getAgentBattleP2PPool,
  markAgentBattleP2PEscrowLocked,
  placeAgentBattleP2PStake,
  settleAgentBattleP2PRound,
} from "../bantahBro/agentBattleP2PService";
import {
  getLivePredictionVisualizationBattles,
  preparePredictionVisualizationOrderIntent,
} from "../bantahBro/predictionVisualizationService";
import {
  getPredictionVisualizationExecutionPreflight,
  listPredictionVisualizationPositions,
  markPredictionVisualizationPositionSourceOpened,
  savePredictionVisualizationPosition,
} from "../bantahBro/predictionVisualizationPositionService";
import {
  getBantahBroTrollboxFeed,
  recordBantahBroTrollboxMessage,
} from "../bantahBro/trollboxService";
import { PrivyAuthMiddleware } from "../privyAuth";
import { db } from "../db";
import { storage } from "../storage";
import { getBantahBroTelegramBot } from "../telegramBot";
import { getTelegramSync } from "../telegramSync";
import { sendManagedBantahAgentRuntimeMessage } from "../bantahElizaRuntimeManager";
import { agents, transactions, users } from "@shared/schema";

const router = Router();

const BANTCREDIT_TRANSACTION_TYPES = [
  "signup_bonus",
  "referral_bonus",
  "referral_reward",
  "daily_signin",
  "challenge_creation_reward",
  "admin_points",
];

const bantahBroChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  tool: z
    .enum(["assistant", "analyze", "rug", "runner", "alerts", "markets", "bxbt", "launcher"])
    .default("assistant"),
  sessionId: z.string().min(1).max(120).optional(),
});

const bantahBroTrollboxPostSchema = z.object({
  roomId: z.string().trim().min(1).max(120).default("agent-battle"),
  battleId: z.string().trim().min(1).max(180).optional(),
  user: z.string().trim().min(1).max(64).optional(),
  message: z.string().trim().min(1).max(1000),
});

const predictionVisualizationOrderIntentSchema = z.object({
  side: z.enum(["yes", "no"]),
  amountUsd: z.coerce.number().positive().max(100_000).default(10),
  maxPrice: z.coerce.number().min(0.01).max(0.99).optional(),
  walletAddress: z.string().trim().min(8).max(128).optional().nullable(),
});

const predictionVisualizationExecutionPreflightSchema = z.object({
  walletAddress: z.string().trim().min(8).max(128).optional().nullable(),
});

const agentBattleP2PStakeSchema = z.object({
  sideId: z.string().trim().min(1).max(500),
  stakeAmount: z.coerce.number().positive().max(1_000_000),
  stakeCurrency: z.enum(["BXBT", "USDC", "USDT", "ETH", "BNB"]).default("USDC"),
  walletAddress: z.string().trim().min(8).max(128).optional().nullable(),
});

const agentBattleP2PEscrowSchema = z.object({
  walletAddress: z.string().trim().min(8).max(128).optional().nullable(),
  escrowTxHash: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional()
    .nullable(),
});

const agentBattleP2PSettlementSchema = z.object({
  roundId: z.string().trim().min(1).max(320),
  winnerSideId: z.string().trim().min(1).max(500),
  maxPairs: z.coerce.number().int().positive().max(100).default(20),
  dryRun: z.coerce.boolean().default(false),
});

const bantahBroTwitterBattlePostSchema = z.object({
  battleId: z.string().trim().min(1).max(240).optional().nullable(),
  force: z.coerce.boolean().default(false),
  dryRun: z.coerce.boolean().default(true),
});

const bantahBroTwitterAgentRunSchema = z.object({
  dryRun: z.coerce.boolean().optional(),
  maxMentions: z.coerce.number().int().positive().max(100).optional(),
  maxSearch: z.coerce.number().int().positive().max(100).optional(),
});

const bantahBroTwitterPreviewSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});

function parseBoolean(value: unknown): boolean {
  return String(value || "").trim().toLowerCase() === "true";
}

function handleError(res: any, error: unknown) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Invalid BantahBro request",
      details: error.flatten(),
    });
  }

  const status =
    typeof error === "object" && error && typeof (error as { status?: unknown }).status === "number"
      ? Number((error as { status: number }).status)
      : undefined;
  const message = error instanceof Error ? error.message : "BantahBro scan failed";
  if (status) {
    return res.status(status).json({ message });
  }
  if (/not found/i.test(message)) {
    return res.status(404).json({ message });
  }
  if (/admin/i.test(message)) {
    return res.status(403).json({ message });
  }
  if (/ONCHAIN_ENABLED_CHAINS/i.test(message)) {
    return res.status(400).json({ message });
  }
  if (/AgentKit provisioning is not configured for chain|smart-wallet execution is not available/i.test(message)) {
    return res.status(503).json({ message });
  }
  if (/invalid|must|needs either/i.test(message)) {
    return res.status(400).json({ message });
  }
  if (/not configured|unavailable|provisioned/i.test(message)) {
    return res.status(503).json({ message });
  }
  return res.status(502).json({ message });
}

function toTokenRef(params: { chainId?: string; tokenAddress?: string }, query: unknown) {
  const queryRecord =
    query && typeof query === "object" && !Array.isArray(query)
      ? (query as Record<string, unknown>)
      : {};

  return bantahBroTokenRefSchema.parse({
    chainId: params.chainId || queryRecord.chainId || "solana",
    tokenAddress: params.tokenAddress,
  });
}

function maybeStripPairs(analysis: Awaited<ReturnType<typeof analyzeToken>>, includePairs: boolean) {
  if (includePairs) return analysis;
  return {
    ...analysis,
    pairs: [],
  };
}

function parseLimit(value: unknown, fallback = 50, max = 100) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, max));
}

function parseFeedSource(value: unknown): BantahBroFeedSource | undefined {
  const source = String(value || "").trim().toLowerCase();
  if (source === "bantah" || source === "twitter" || source === "telegram") {
    return source;
  }
  return undefined;
}

function requireAdmin(req: any, res: any, next: any) {
  if (!req.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  return next();
}

router.get("/alerts/live", async (req, res) => {
  try {
    res.json({
      alerts: listBantahBroAlerts(parseLimit(req.query.limit)),
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/feed", async (req, res) => {
  try {
    res.json(
      getBantahBroSocialFeed({
        limit: parseLimit(req.query.limit, 50, 100),
        source: parseFeedSource(req.query.source),
      }),
    );
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/alerts/:alertId", async (req, res) => {
  try {
    const alert = getBantahBroAlert(String(req.params.alertId || ""));
    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }
    res.json(alert);
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/boosts/live", async (req, res) => {
  try {
    res.json({
      boosts: listMarketBoosts(parseLimit(req.query.limit)),
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/markets", async (req, res) => {
  try {
    const feed = await getLiveBantahBroMarkets(parseLimit(req.query.limit, 24, 100));
    res.json(feed);
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/hot-tickers", async (req, res) => {
  try {
    const feed = await getBantahBroHotTickers(parseLimit(req.query.limit, 5, 5));
    res.json(feed);
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/agent-battles/live", async (req, res) => {
  try {
    const feed = await getLiveBantahBroAgentBattles(parseLimit(req.query.limit, 3, 40));
    res.json(feed);
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/agent-battles/:battleId/p2p/pool", async (req, res) => {
  try {
    const pool = await getAgentBattleP2PPool({
      battleId: String(req.params.battleId || ""),
    });
    res.json(pool);
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/agent-battles/:battleId/p2p/my", PrivyAuthMiddleware, async (req: any, res) => {
  try {
    const pool = await getAgentBattleP2PPool({
      battleId: String(req.params.battleId || ""),
      userId: req.user.id,
    });
    res.json(pool);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/agent-battles/:battleId/p2p/stake", PrivyAuthMiddleware, async (req: any, res) => {
  try {
    const parsed = agentBattleP2PStakeSchema.parse(req.body || {});
    const response = await placeAgentBattleP2PStake({
      userId: req.user.id,
      battleId: String(req.params.battleId || ""),
      sideId: parsed.sideId,
      stakeAmount: parsed.stakeAmount,
      stakeCurrency: parsed.stakeCurrency,
      walletAddress: parsed.walletAddress || req.user.walletAddress || null,
    });
    res.json(response);
  } catch (error) {
    handleError(res, error);
  }
});

router.post(
  "/agent-battles/p2p/positions/:positionId/escrow",
  PrivyAuthMiddleware,
  async (req: any, res) => {
    try {
      const parsed = agentBattleP2PEscrowSchema.parse(req.body || {});
      const position = await markAgentBattleP2PEscrowLocked({
        userId: req.user.id,
        positionId: String(req.params.positionId || ""),
        walletAddress: parsed.walletAddress || req.user.walletAddress || null,
        escrowTxHash: parsed.escrowTxHash || null,
      });
      res.json({ position });
    } catch (error) {
      handleError(res, error);
    }
  },
);

router.post(
  "/admin/agent-battles/p2p/settle-round",
  PrivyAuthMiddleware,
  requireAdmin,
  async (req: any, res) => {
    try {
      const parsed = agentBattleP2PSettlementSchema.parse(req.body || {});
      const result = await settleAgentBattleP2PRound({
        roundId: parsed.roundId,
        winnerSideId: parsed.winnerSideId,
        maxPairs: parsed.maxPairs,
        dryRun: parsed.dryRun,
      });
      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  },
);

router.get("/prediction-battles/live", async (req, res) => {
  try {
    const feed = await getLivePredictionVisualizationBattles(parseLimit(req.query.limit, 12, 30));
    res.json(feed);
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/prediction-battles/positions/my", PrivyAuthMiddleware, async (req: any, res) => {
  try {
    const positions = await listPredictionVisualizationPositions(
      req.user.id,
      parseLimit(req.query.limit, 20, 100),
    );
    res.json({
      positions,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/prediction-battles/:battleId/order-intent", async (req, res) => {
  try {
    const parsed = predictionVisualizationOrderIntentSchema.parse(req.body || {});
    const intent = await preparePredictionVisualizationOrderIntent({
      battleId: String(req.params.battleId || ""),
      side: parsed.side,
      amountUsd: parsed.amountUsd,
      maxPrice: parsed.maxPrice,
    });
    res.json(intent);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/prediction-battles/:battleId/positions", PrivyAuthMiddleware, async (req: any, res) => {
  try {
    const parsed = predictionVisualizationOrderIntentSchema.parse(req.body || {});
    const response = await savePredictionVisualizationPosition({
      userId: req.user.id,
      battleId: String(req.params.battleId || ""),
      side: parsed.side,
      amountUsd: parsed.amountUsd,
      maxPrice: parsed.maxPrice,
      walletAddress: parsed.walletAddress,
    });
    res.json(response);
  } catch (error) {
    handleError(res, error);
  }
});

router.post(
  "/prediction-battles/positions/:positionId/source-opened",
  PrivyAuthMiddleware,
  async (req: any, res) => {
    try {
      const position = await markPredictionVisualizationPositionSourceOpened({
        userId: req.user.id,
        positionId: String(req.params.positionId || ""),
      });
      res.json({ position });
    } catch (error) {
      handleError(res, error);
    }
  },
);

router.post(
  "/prediction-battles/positions/:positionId/execution-preflight",
  PrivyAuthMiddleware,
  async (req: any, res) => {
    try {
      const parsed = predictionVisualizationExecutionPreflightSchema.parse(req.body || {});
      const preflight = await getPredictionVisualizationExecutionPreflight({
        userId: req.user.id,
        positionId: String(req.params.positionId || ""),
        walletAddress: parsed.walletAddress,
      });
      res.json(preflight);
    } catch (error) {
      handleError(res, error);
    }
  },
);

router.post(
  "/prediction-battles/positions/:positionId/submit-clob-order",
  PrivyAuthMiddleware,
  async (req: any, res) => {
    try {
      const parsed = predictionVisualizationExecutionPreflightSchema.parse(req.body || {});
      const preflight = await getPredictionVisualizationExecutionPreflight({
        userId: req.user.id,
        positionId: String(req.params.positionId || ""),
        walletAddress: parsed.walletAddress,
      });

      if (!preflight.executionReady) {
        return res.status(503).json({
          message:
            "Polymarket CLOB submission is not ready. No order was submitted; open the source market for live execution.",
          preflight,
        });
      }

      return res.status(501).json({
        message:
          "CLOB preflight passed, but signed order submission is intentionally locked until wallet EIP-712 signing is wired.",
        preflight,
      });
    } catch (error) {
      handleError(res, error);
    }
  },
);

router.get("/trollbox", async (req, res) => {
  try {
    res.json(
      getBantahBroTrollboxFeed({
        roomId: String(req.query.roomId || "agent-battle"),
        battleId: req.query.battleId ? String(req.query.battleId) : null,
        limit: parseLimit(req.query.limit, 60, 100),
      }),
    );
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/trollbox", async (req, res) => {
  try {
    const parsed = bantahBroTrollboxPostSchema.parse(req.body || {});
    const user = parsed.user || "Web Degen";
    const message = recordBantahBroTrollboxMessage({
      roomId: parsed.roomId,
      battleId: parsed.battleId || null,
      source: "web",
      user,
      message: parsed.message,
    });

    let forwardedToTelegram = false;
    const telegramSync = getTelegramSync();
    if (telegramSync?.isReady()) {
      forwardedToTelegram = await telegramSync.sendMessageToTelegram(
        parsed.message,
        `${user} via BantahBro TrollBox`,
      );
    }

    res.json({
      message,
      forwardedToTelegram,
      feed: getBantahBroTrollboxFeed({
        roomId: parsed.roomId,
        battleId: parsed.battleId || null,
        limit: 60,
      }),
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/stats/bantcredit", async (_req, res) => {
  try {
    const [userBalanceRow, agentBalanceRow, earnedTransactionRow] = await Promise.all([
      db
        .select({
          total: sql<string>`COALESCE(SUM(COALESCE(${users.points}, 0)), 0)`,
          count: sql<string>`COUNT(*)`,
        })
        .from(users)
        .then((rows) => rows[0]),
      db
        .select({
          total: sql<string>`COALESCE(SUM(COALESCE(${agents.points}, 0)), 0)`,
          count: sql<string>`COUNT(*)`,
        })
        .from(agents)
        .then((rows) => rows[0]),
      db
        .select({
          total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
          count: sql<string>`COUNT(*)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.status, "completed"),
            inArray(transactions.type, BANTCREDIT_TRANSACTION_TYPES),
          ),
        )
        .then((rows) => rows[0]),
    ]);

    const currentUserPoints = Math.max(0, Math.round(Number(userBalanceRow?.total || 0)));
    const currentAgentPoints = Math.max(0, Math.round(Number(agentBalanceRow?.total || 0)));
    const earnedFromTransactions = Math.max(
      0,
      Math.round(Number(earnedTransactionRow?.total || 0)),
    );
    const currentAggregate = currentUserPoints + currentAgentPoints;
    const lifetimeEarned = Math.max(currentAggregate, earnedFromTransactions + currentAgentPoints);

    res.json({
      token: "BantCredit",
      lifetimeEarned,
      currentAggregate,
      currentUserPoints,
      currentAgentPoints,
      earnedFromTransactions,
      userCount: Number(userBalanceRow?.count || 0),
      agentCount: Number(agentBalanceRow?.count || 0),
      rewardTransactionCount: Number(earnedTransactionRow?.count || 0),
      basis:
        "Offchain aggregate from users.points, agents.points, and completed BantCredit reward transactions.",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/scan/:tokenAddress", async (req, res) => {
  try {
    const ref = toTokenRef(req.params, req.query);
    const analysis = await analyzeToken(ref);
    res.json(maybeStripPairs(analysis, parseBoolean(req.query.includePairs)));
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/scan/:chainId/:tokenAddress", async (req, res) => {
  try {
    const ref = toTokenRef(req.params, req.query);
    const analysis = await analyzeToken(ref);
    res.json(maybeStripPairs(analysis, parseBoolean(req.query.includePairs)));
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/rug-score/:tokenAddress", async (req, res) => {
  try {
    const ref = toTokenRef(req.params, req.query);
    const analysis = await analyzeToken(ref);
    res.json({
      chainId: analysis.chainId,
      tokenAddress: analysis.tokenAddress,
      tokenSymbol: analysis.tokenSymbol,
      primaryPair: analysis.primaryPair,
      holders: analysis.holders,
      rug: analysis.rug,
      suggestedActions: analysis.suggestedActions,
      post: analysis.posts.rug,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/rug-score/:chainId/:tokenAddress", async (req, res) => {
  try {
    const ref = toTokenRef(req.params, req.query);
    const analysis = await analyzeToken(ref);
    res.json({
      chainId: analysis.chainId,
      tokenAddress: analysis.tokenAddress,
      tokenSymbol: analysis.tokenSymbol,
      primaryPair: analysis.primaryPair,
      holders: analysis.holders,
      rug: analysis.rug,
      suggestedActions: analysis.suggestedActions,
      post: analysis.posts.rug,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/holders/:tokenAddress", async (req, res) => {
  try {
    const ref = toTokenRef(req.params, req.query);
    const analysis = await analyzeToken(ref);
    res.json({
      chainId: analysis.chainId,
      tokenAddress: analysis.tokenAddress,
      tokenSymbol: analysis.tokenSymbol,
      holders: analysis.holders,
      rug: analysis.rug,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/holders/:chainId/:tokenAddress", async (req, res) => {
  try {
    const ref = toTokenRef(req.params, req.query);
    const analysis = await analyzeToken(ref);
    res.json({
      chainId: analysis.chainId,
      tokenAddress: analysis.tokenAddress,
      tokenSymbol: analysis.tokenSymbol,
      holders: analysis.holders,
      rug: analysis.rug,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/receipts/:tokenAddress", async (req, res) => {
  try {
    res.json({
      receipts: listBantahBroReceiptsByToken(
        String(req.params.tokenAddress || ""),
        typeof req.query.chainId === "string" ? req.query.chainId : undefined,
      ).slice(0, parseLimit(req.query.limit)),
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/receipts/:chainId/:tokenAddress", async (req, res) => {
  try {
    res.json({
      receipts: listBantahBroReceiptsByToken(
        String(req.params.tokenAddress || ""),
        String(req.params.chainId || ""),
      ).slice(0, parseLimit(req.query.limit)),
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/system-agent/status", async (_req, res) => {
  try {
    const systemAgent = await getBantahBroSystemAgentStatus();
    res.json({
      exists: Boolean(systemAgent),
      systemAgent,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/automation/status", async (_req, res) => {
  try {
    res.json(getBantahBroAutomationStatus());
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/twitter/status", async (_req, res) => {
  try {
    res.json(getBantahBroTwitterAgentStatus());
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/twitter/battle-post/preview", async (req, res) => {
  try {
    res.json({
      status: getBantahBroTwitterAgentStatus(),
      draft: await buildCurrentBattleTweetDraft(
        typeof req.query.battleId === "string" ? req.query.battleId : null,
      ),
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/twitter/thread/preview", async (req, res) => {
  try {
    res.json({
      status: getBantahBroTwitterAgentStatus(),
      draft: await buildCurrentBattleThreadDraft(
        typeof req.query.battleId === "string" ? req.query.battleId : null,
      ),
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post(
  "/admin/twitter/battle-post",
  PrivyAuthMiddleware,
  requireAdmin,
  async (req: any, res) => {
    try {
      const parsed = bantahBroTwitterBattlePostSchema.parse(req.body || {});
      const draft = await buildCurrentBattleTweetDraft(parsed.battleId || null);

      if (parsed.dryRun) {
        return res.json({
          posted: false,
          dryRun: true,
          status: getBantahBroTwitterAgentStatus(),
          draft,
        });
      }

      const result = await postCurrentBattleTweet({
        battleId: parsed.battleId,
        force: parsed.force,
      });

      return res.json({
        posted: true,
        dryRun: false,
        status: getBantahBroTwitterAgentStatus(),
        ...result,
      });
    } catch (error) {
      handleError(res, error);
    }
  },
);

router.post(
  "/admin/twitter/agent/run",
  PrivyAuthMiddleware,
  requireAdmin,
  async (req: any, res) => {
    try {
      const parsed = bantahBroTwitterAgentRunSchema.parse(req.body || {});
      const result = await runBantahBroTwitterAgentCycle({
        dryRun: parsed.dryRun,
        maxMentions: parsed.maxMentions,
        maxSearch: parsed.maxSearch,
      });
      res.json({
        status: getBantahBroTwitterAgentStatus(),
        result,
      });
    } catch (error) {
      handleError(res, error);
    }
  },
);

router.post(
  "/admin/twitter/agent/preview",
  PrivyAuthMiddleware,
  requireAdmin,
  async (req: any, res) => {
    try {
      const parsed = bantahBroTwitterPreviewSchema.parse(req.body || {});
      res.json(await previewBantahBroTwitterAgentResponse(parsed.text));
    } catch (error) {
      handleError(res, error);
    }
  },
);

router.post(
  "/admin/twitter/thread-post",
  PrivyAuthMiddleware,
  requireAdmin,
  async (req: any, res) => {
    try {
      const parsed = bantahBroTwitterBattlePostSchema.parse(req.body || {});
      const draft = await buildCurrentBattleThreadDraft(parsed.battleId || null);

      if (parsed.dryRun) {
        return res.json({
          posted: false,
          dryRun: true,
          status: getBantahBroTwitterAgentStatus(),
          draft,
        });
      }

      const result = await postCurrentBattleThread({
        battleId: parsed.battleId,
        force: parsed.force,
      });
      return res.json({
        posted: true,
        dryRun: false,
        status: getBantahBroTwitterAgentStatus(),
        ...result,
      });
    } catch (error) {
      handleError(res, error);
    }
  },
);

router.post(
  "/admin/twitter/media-battle-post",
  PrivyAuthMiddleware,
  requireAdmin,
  async (req: any, res) => {
    try {
      const parsed = bantahBroTwitterBattlePostSchema.parse(req.body || {});
      const draft = await buildCurrentBattleTweetDraft(parsed.battleId || null);

      if (parsed.dryRun) {
        return res.json({
          posted: false,
          dryRun: true,
          status: getBantahBroTwitterAgentStatus(),
          draft,
          note: "Dry run only. Media upload and tweet posting were skipped.",
        });
      }

      const result = await postCurrentBattleMediaTweet({
        battleId: parsed.battleId,
        force: parsed.force,
      });
      return res.json({
        posted: true,
        dryRun: false,
        status: getBantahBroTwitterAgentStatus(),
        ...result,
      });
    } catch (error) {
      handleError(res, error);
    }
  },
);

router.get("/leaderboard", async (req, res) => {
  try {
    const leaderboard = await getBantahBroLeaderboard(parseLimit(req.query.limit, 10, 50));
    res.json(leaderboard);
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/leaderboard/live", async (req, res) => {
  try {
    const leaderboard = await getLiveBantahBroLeaderboard(parseLimit(req.query.limit, 20, 100));
    res.json(leaderboard);
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/friends", PrivyAuthMiddleware, async (req: any, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const friends = await storage.getFriends(req.user.id);
    res.json({
      friends: friends.map((friend) => {
        const counterpart =
          friend.requesterId === req.user.id ? friend.addressee : friend.requester;

        return {
          id: friend.id,
          connectedAt: friend.createdAt,
          userId: counterpart?.id || null,
          username: counterpart?.username || null,
          firstName: counterpart?.firstName || null,
          lastName: counterpart?.lastName || null,
          profileImageUrl: counterpart?.profileImageUrl || null,
          telegramId: counterpart?.telegramId || null,
        };
      }),
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/bxbt/status", async (_req, res) => {
  try {
    const status = await getBantahBroBxbtStatus();
    res.json(status);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/chat", async (req, res) => {
  try {
    const parsed = bantahBroChatRequestSchema.parse(req.body || {});
    const launchIntent = handleTokenLaunchIntent(parsed.message);
    if (parsed.tool === "launcher" || launchIntent.handled) {
      if (launchIntent.handled) {
        return res.json({
          reply: launchIntent.reply,
          actions: ["LAUNCH_TOKEN_DRAFT"],
          providers: [],
          launcher: launchIntent.launcher,
          agent: null,
          roomId: parsed.sessionId || `web-${parsed.tool}`,
        });
      }

      return res.json({
        reply:
          "Tell me the token name, symbol, initial supply, owner wallet, and chain. Example: launch token name Bantah Demo symbol BDEMO supply 1000000 owner 0xYourWallet on Base",
        actions: ["LAUNCH_TOKEN_GUIDE"],
        providers: [],
        launcher: { missingFields: ["token name", "symbol", "initial supply", "owner wallet"] },
        agent: null,
        roomId: parsed.sessionId || `web-${parsed.tool}`,
      });
    }

    const systemAgent = await ensureBantahBroSystemAgent({ preferLiveWallet: true });
    const reply = await sendManagedBantahAgentRuntimeMessage(systemAgent.agentId, {
      text: parsed.message,
      tool: parsed.tool,
      sessionId: parsed.sessionId || `web-${parsed.tool}`,
    });

    res.json({
      reply: reply.text,
      actions: reply.actions,
      providers: reply.providers,
      agent: {
        agentId: systemAgent.agentId,
        agentName: systemAgent.agentName,
        runtimeStatus: systemAgent.runtimeStatus,
      },
      roomId: reply.roomId,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/momentum-score/:tokenAddress", async (req, res) => {
  try {
    const ref = toTokenRef(req.params, req.query);
    const analysis = await analyzeToken(ref);
    res.json({
      chainId: analysis.chainId,
      tokenAddress: analysis.tokenAddress,
      tokenSymbol: analysis.tokenSymbol,
      primaryPair: analysis.primaryPair,
      momentum: analysis.momentum,
      suggestedActions: analysis.suggestedActions,
      post: analysis.posts.runner,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/momentum-score/:chainId/:tokenAddress", async (req, res) => {
  try {
    const ref = toTokenRef(req.params, req.query);
    const analysis = await analyzeToken(ref);
    res.json({
      chainId: analysis.chainId,
      tokenAddress: analysis.tokenAddress,
      tokenSymbol: analysis.tokenSymbol,
      primaryPair: analysis.primaryPair,
      momentum: analysis.momentum,
      suggestedActions: analysis.suggestedActions,
      post: analysis.posts.runner,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/alerts/publish", PrivyAuthMiddleware, requireAdmin, async (req, res) => {
  try {
    const parsed = bantahBroPublishAlertRequestSchema.parse(req.body || {});
    const analysis = await analyzeToken({
      chainId: parsed.chainId,
      tokenAddress: parsed.tokenAddress,
    });
    const alert = publishBantahBroAlert(buildAlertFromAnalysis(analysis, parsed.mode));
    const telegramBot = getBantahBroTelegramBot();
    if (telegramBot) {
      await telegramBot.broadcastBantahBroAlert(alert, analysis);
    }
    res.json({ alert, analysis });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/receipts/evaluate", PrivyAuthMiddleware, requireAdmin, async (req, res) => {
  try {
    const parsed = bantahBroEvaluateReceiptRequestSchema.parse(req.body || {});
    const sourceAlert = getBantahBroAlert(parsed.sourceAlertId);
    if (!sourceAlert) {
      return res.status(404).json({ message: "Source alert not found" });
    }

    const analysis = await analyzeToken({
      chainId: sourceAlert.chainId,
      tokenAddress: sourceAlert.tokenAddress,
    });
    const receipt = publishBantahBroReceipt(buildReceiptFromAlert(sourceAlert, analysis));
    const receiptAlert = publishBantahBroAlert(
      bantahBroAlertSchema.parse({
        id: `bb_alert_receipt_${Date.now()}`,
        type:
          receipt.status === "printed" || receipt.status === "top_signal"
            ? "receipt"
            : "aftermath",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        chainId: receipt.chainId,
        tokenAddress: receipt.tokenAddress,
        tokenSymbol: receipt.tokenSymbol,
        tokenName: receipt.tokenName,
        headline: receipt.headline,
        body: receipt.body,
        sentiment:
          receipt.status === "rekt"
            ? "bearish"
            : receipt.status === "watching"
              ? "mixed"
              : "bullish",
        confidence: receipt.status === "top_signal" ? 0.95 : receipt.status === "printed" ? 0.8 : 0.55,
        rugScore: analysis.rug.score,
        momentumScore: analysis.momentum.score,
        referencePriceUsd: receipt.latestPriceUsd,
        sourceAnalysisAt: analysis.generatedAt,
        market: receipt.market,
        boost: null,
        metadata: {
          receiptId: receipt.id,
          sourceAlertId: sourceAlert.id,
          rewardEligible: receipt.rewardEligible,
          multiple: receipt.multiple,
        },
      }),
    );
    const telegramBot = getBantahBroTelegramBot();
    if (telegramBot) {
      await telegramBot.broadcastBantahBroReceipt(receipt);
    }

    res.json({
      sourceAlert,
      analysis,
      receipt,
      receiptAlert,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/markets/create-from-signal", PrivyAuthMiddleware, requireAdmin, async (req, res) => {
  try {
    const parsed = bantahBroCreateMarketFromSignalRequestSchema.parse(req.body || {});
    const result = await createBantahBroMarketFromSignal(parsed);
    const telegramBot = getBantahBroTelegramBot();
    if (telegramBot && result.marketAlert) {
      await telegramBot.broadcastBantahBroAlert(result.marketAlert, result.analysis);
    }
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/markets/boost", PrivyAuthMiddleware, requireAdmin, async (req, res) => {
  try {
    const parsed = bantahBroBoostMarketRequestSchema.parse(req.body || {});
    const result = await boostBantahBroMarket(parsed);
    const telegramBot = getBantahBroTelegramBot();
    if (telegramBot && result.boostAlert) {
      await telegramBot.broadcastBantahBroAlert(result.boostAlert);
    }
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/p2p/create", PrivyAuthMiddleware, requireAdmin, async (req, res) => {
  try {
    const parsed = bantahBroCreateP2PMarketRequestSchema.parse(req.body || {});
    const result = await createBantahBroP2PMarket(parsed);
    const telegramBot = getBantahBroTelegramBot();

    if (telegramBot) {
      await telegramBot.broadcastChallenge({
        id: result.market.challengeId,
        title: String(result.marketResult.question || parsed.question || "BantahBro P2P Market"),
        description:
          typeof result.marketResult.description === "string"
            ? result.marketResult.description
            : parsed.description,
        creator: {
          name: result.systemAgent.agentName,
          username: process.env.BANTAHBRO_SYSTEM_USERNAME || undefined,
        },
        challenged: {
          name: String(result.marketResult.challengedLabel || "Opponent"),
        },
        stake_amount: Number(result.marketResult.stakeAmount || parsed.stakeAmount || 0),
        tokenSymbol: String(result.marketResult.currency || parsed.currency || "ETH"),
        status: String(result.marketResult.status || "pending"),
        end_time:
          typeof result.marketResult.deadline === "string"
            ? result.marketResult.deadline
            : parsed.deadline,
        category: parsed.category,
      });

      if (result.marketAlert) {
        await telegramBot.broadcastBantahBroAlert(result.marketAlert, result.analysis);
      }

      const challengedUserId =
        typeof result.marketResult.challengedUserId === "string"
          ? result.marketResult.challengedUserId
          : null;
      if (challengedUserId) {
        const challengedUser = await storage.getUser(challengedUserId);
        if (challengedUser?.telegramId) {
          await telegramBot.sendChallengeAcceptCard(Number(challengedUser.telegramId), {
            id: result.market.challengeId,
            title: String(result.marketResult.question || parsed.question || "BantahBro P2P Market"),
            description:
              typeof result.marketResult.description === "string"
                ? result.marketResult.description
                : parsed.description,
            challenger: {
              name: result.systemAgent.agentName,
              username: process.env.BANTAHBRO_SYSTEM_USERNAME || undefined,
            },
            challenged: {
              name:
                challengedUser.firstName ||
                challengedUser.username ||
                "You",
              username: challengedUser.username || undefined,
            },
            amount: Number(result.marketResult.stakeAmount || parsed.stakeAmount || 0),
            tokenSymbol: String(result.marketResult.currency || parsed.currency || "ETH"),
            category: parsed.category,
          });
        }
      }
    }

    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/system-agent/ensure", PrivyAuthMiddleware, requireAdmin, async (req, res) => {
  try {
    const parsed = bantahBroEnsureSystemAgentRequestSchema.parse(req.body || {});
    if (isBantahBroElizaTelegramEnabled()) {
      const result = await ensureBantahBroTelegramRuntimeStarted();
      return res.json(result);
    }
    const systemAgent = await ensureBantahBroSystemAgent(parsed);
    res.json({ systemAgent, runtime: null });
  } catch (error) {
    handleError(res, error);
  }
});

router.post(
  "/system-agent/reprovision-wallet",
  PrivyAuthMiddleware,
  requireAdmin,
  async (_req, res) => {
    try {
      const systemAgent = await reprovisionBantahBroSystemAgentWallet();
      res.json({ systemAgent });
    } catch (error) {
      handleError(res, error);
    }
  },
);

router.post("/bxbt/spend", PrivyAuthMiddleware, requireAdmin, async (req, res) => {
  try {
    const parsed = bantahBroBxbtSpendRequestSchema.parse(req.body || {});
    const transfer = await spendBantahBroBxbt(parsed);
    res.json(transfer);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/bxbt/reward", PrivyAuthMiddleware, requireAdmin, async (req, res) => {
  try {
    const parsed = bantahBroBxbtRewardRequestSchema.parse(req.body || {});
    const transfer = await rewardBantahBroBxbt(parsed);
    res.json(transfer);
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/launcher/status", async (_req, res) => {
  try {
    res.json(getBantahLauncherStatus());
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/launcher/validate", async (req, res) => {
  try {
    res.json(validateBantahLaunchDraft(req.body || {}));
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/launcher/launches", async (req, res) => {
  try {
    res.json({
      launches: await listBantahTokenLaunches(null, parseLimit(req.query.limit, 20, 50)),
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/launcher/my-launches", PrivyAuthMiddleware, async (req: any, res) => {
  try {
    const userId = String(req.user?.id || "").trim();
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    res.json({
      launches: await listBantahTokenLaunches(userId, parseLimit(req.query.limit, 20, 50)),
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/launcher/deploy", PrivyAuthMiddleware, async (req: any, res) => {
  try {
    const userId = String(req.user?.id || "").trim();
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const result = await deployBantahLaunchToken(req.body || {}, { userId });
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
