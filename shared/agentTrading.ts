import { z } from "zod";

export const agentStrategyTypeValues = ["probability_threshold"] as const;
export const agentTradingVisibilityValues = ["public", "private", "unlisted"] as const;
export const agentDecisionActionValues = ["buy_yes", "buy_no", "skip"] as const;
export const agentOrderStatusValues = [
  "pending",
  "submitted",
  "partially_filled",
  "filled",
  "failed",
  "cancelled",
] as const;
export const agentPositionStatusValues = ["open", "closed"] as const;
export const agentOrderSideValues = ["yes", "no"] as const;

export type AgentStrategyType = (typeof agentStrategyTypeValues)[number];
export type AgentTradingVisibility = (typeof agentTradingVisibilityValues)[number];
export type AgentDecisionAction = (typeof agentDecisionActionValues)[number];
export type AgentOrderStatus = (typeof agentOrderStatusValues)[number];
export type AgentPositionStatus = (typeof agentPositionStatusValues)[number];
export type AgentOrderSide = (typeof agentOrderSideValues)[number];

export const probabilityThresholdStrategyConfigSchema = z.object({
  strategyType: z.literal("probability_threshold").default("probability_threshold"),
  yesBuyBelow: z.number().min(0).max(1).default(0.42),
  noBuyBelow: z.number().min(0).max(1).default(0.42),
  maxPositionSizeUsd: z.number().positive().default(25),
  minLiquidity: z.number().nonnegative().default(1000),
  allowedCategories: z.array(z.string().min(1)).default(["crypto", "politics", "sports"]),
});

export const agentRiskProfileSchema = z.object({
  blockedCategories: z.array(z.string().min(1)).default([]),
  blockedMarketIds: z.array(z.string().min(1)).default([]),
  minLiquidity: z.number().nonnegative().default(1000),
  notes: z.string().max(280).nullable().optional(),
});

export type ProbabilityThresholdStrategyConfig = z.infer<
  typeof probabilityThresholdStrategyConfigSchema
>;
export type AgentRiskProfile = z.infer<typeof agentRiskProfileSchema>;

export const DEFAULT_PROBABILITY_THRESHOLD_STRATEGY_CONFIG: ProbabilityThresholdStrategyConfig = {
  strategyType: "probability_threshold",
  yesBuyBelow: 0.42,
  noBuyBelow: 0.42,
  maxPositionSizeUsd: 25,
  minLiquidity: 1000,
  allowedCategories: ["crypto", "politics", "sports"],
};

export const DEFAULT_AGENT_RISK_PROFILE: AgentRiskProfile = {
  blockedCategories: [],
  blockedMarketIds: [],
  minLiquidity: 1000,
  notes: null,
};

export const agentDecisionSchema = z.object({
  agentId: z.string().uuid(),
  marketId: z.string().min(1),
  externalMarketId: z.string().min(1),
  marketQuestion: z.string().min(1).nullable().optional(),
  action: z.enum(agentDecisionActionValues),
  confidence: z.number().min(0).max(1),
  intendedPrice: z.number().min(0).max(1).nullable(),
  intendedStakeUsd: z.number().positive().nullable(),
  reason: z.string().min(1),
  strategyType: z.enum(agentStrategyTypeValues),
  createdAt: z.string().datetime(),
});

export const riskCheckResultSchema = z.object({
  allowed: z.boolean(),
  reasons: z.array(z.string().min(1)).default([]),
});

export const agentOrderSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  marketId: z.string().min(1),
  externalMarketId: z.string().min(1),
  marketQuestion: z.string().min(1).nullable().optional(),
  side: z.enum(agentOrderSideValues),
  action: z.literal("buy"),
  intendedStakeUsd: z.number().positive(),
  intendedPrice: z.number().min(0).max(1),
  externalOrderId: z.string().min(1).nullable().optional(),
  status: z.enum(agentOrderStatusValues),
  failureReason: z.string().min(1).nullable().optional(),
  lastSyncedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const agentPositionSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  marketId: z.string().min(1),
  externalMarketId: z.string().min(1),
  marketQuestion: z.string().min(1).nullable().optional(),
  side: z.enum(agentOrderSideValues),
  totalShares: z.number().nonnegative(),
  avgEntryPrice: z.number().min(0).max(1),
  currentMarkPrice: z.number().min(0).max(1).nullable(),
  realizedPnl: z.number(),
  unrealizedPnl: z.number(),
  status: z.enum(agentPositionStatusValues),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable().optional(),
  lastSyncedAt: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime(),
});

export const tradingReadinessResponseSchema = z.object({
  agentId: z.string().uuid(),
  canTrade: z.boolean(),
  walletReady: z.boolean(),
  balanceSummary: z.object({
    address: z.string().min(1),
    currency: z.string().nullable(),
    amount: z.string().nullable(),
  }),
  openPositionsCount: z.number().int().nonnegative(),
  dailyTradesUsed: z.number().int().nonnegative(),
  dailyTradeLimit: z.number().int().positive(),
  maxOpenPositions: z.number().int().positive(),
  reasons: z.array(z.string().min(1)).default([]),
});

export const eligibleMarketsQuerySchema = z.object({
  category: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  minLiquidity: z.coerce.number().nonnegative().optional(),
});

export const eligibleMarketsResponseSchema = z.object({
  agentId: z.string().uuid(),
  items: z.array(
    z.object({
      source: z.literal("polymarket"),
      marketId: z.string().min(1),
      externalMarketId: z.string().min(1),
      question: z.string().min(1),
      yesPrice: z.number().min(0).max(1),
      noPrice: z.number().min(0).max(1),
      liquidity: z.number().nonnegative(),
      volume: z.number().nonnegative(),
      category: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      marketUrl: z.string().url().nullable().optional(),
      isTradable: z.boolean(),
    }),
  ),
});

export const agentDecisionRequestSchema = z.object({
  marketId: z.string().min(1),
  attemptExecution: z.boolean().optional().default(false),
});

export const agentExecuteRequestSchema = z.object({
  marketId: z.string().min(1),
  action: z.enum(["buy_yes", "buy_no"]),
});

export const agentDecisionResponseSchema = z.object({
  decision: agentDecisionSchema,
  risk: riskCheckResultSchema,
  routingAttempted: z.boolean(),
  order: agentOrderSchema.nullable().optional(),
});

export const agentOrdersResponseSchema = z.object({
  agentId: z.string().uuid(),
  items: z.array(agentOrderSchema),
});

export const agentPositionsResponseSchema = z.object({
  agentId: z.string().uuid(),
  items: z.array(agentPositionSchema),
});

export const agentPerformanceResponseSchema = z.object({
  agentId: z.string().uuid(),
  totalTrades: z.number().int().nonnegative(),
  openPositionsCount: z.number().int().nonnegative(),
  totalSubmittedVolume: z.number().nonnegative(),
  realizedPnl: z.number(),
  unrealizedPnl: z.number(),
  latestActivityAt: z.string().datetime().nullable(),
});

export type AgentDecision = z.infer<typeof agentDecisionSchema>;
export type RiskCheckResult = z.infer<typeof riskCheckResultSchema>;
export type AgentOrder = z.infer<typeof agentOrderSchema>;
export type AgentPosition = z.infer<typeof agentPositionSchema>;
export type TradingReadinessResponse = z.infer<typeof tradingReadinessResponseSchema>;
export type EligibleMarketsQuery = z.infer<typeof eligibleMarketsQuerySchema>;
export type EligibleMarketsResponse = z.infer<typeof eligibleMarketsResponseSchema>;
export type AgentDecisionRequest = z.infer<typeof agentDecisionRequestSchema>;
export type AgentExecuteRequest = z.infer<typeof agentExecuteRequestSchema>;
export type AgentDecisionResponse = z.infer<typeof agentDecisionResponseSchema>;
export type AgentOrdersResponse = z.infer<typeof agentOrdersResponseSchema>;
export type AgentPositionsResponse = z.infer<typeof agentPositionsResponseSchema>;
export type AgentPerformanceResponse = z.infer<typeof agentPerformanceResponseSchema>;
