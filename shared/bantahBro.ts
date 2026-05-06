import { z } from "zod";
import { bantahSkillCurrencyValues } from "./agentSkill";

export const bantahBroRiskLevelValues = ["low", "medium", "high"] as const;
export const bantahBroMomentumLevelValues = ["cold", "warming", "hot"] as const;
export const bantahBroHolderStatusValues = [
  "available",
  "disabled",
  "unsupported",
  "error",
] as const;
export const bantahBroAlertTypeValues = [
  "rug_alert",
  "runner_alert",
  "watch_alert",
  "market_live",
  "receipt",
  "aftermath",
  "boost_live",
  "wallet_status",
] as const;
export const bantahBroSentimentValues = ["bearish", "bullish", "mixed"] as const;
export const bantahBroReceiptStatusValues = [
  "watching",
  "printed",
  "top_signal",
  "rekt",
] as const;
export const bantahBroWalletHealthValues = [
  "live",
  "demo",
  "missing",
  "error",
] as const;

export const bantahBroTokenRefSchema = z.object({
  chainId: z.string().trim().min(1).max(48).default("solana"),
  tokenAddress: z.string().trim().min(2).max(128),
});

export const bantahBroPairTokenSchema = z.object({
  address: z.string(),
  name: z.string().nullable(),
  symbol: z.string().nullable(),
});

export const bantahBroPairSnapshotSchema = z.object({
  chainId: z.string(),
  dexId: z.string().nullable(),
  url: z.string().url().nullable(),
  pairAddress: z.string(),
  baseToken: bantahBroPairTokenSchema,
  quoteToken: bantahBroPairTokenSchema,
  priceUsd: z.number().nullable(),
  liquidityUsd: z.number(),
  marketCap: z.number().nullable(),
  fdv: z.number().nullable(),
  pairCreatedAt: z.string().nullable(),
  pairAgeMinutes: z.number().nullable(),
  volume: z.object({
    m5: z.number(),
    h1: z.number(),
    h6: z.number(),
    h24: z.number(),
  }),
  txns: z.object({
    m5: z.object({ buys: z.number(), sells: z.number() }),
    h1: z.object({ buys: z.number(), sells: z.number() }),
    h6: z.object({ buys: z.number(), sells: z.number() }),
    h24: z.object({ buys: z.number(), sells: z.number() }),
  }),
  priceChange: z.object({
    m5: z.number(),
    h1: z.number(),
    h6: z.number(),
    h24: z.number(),
  }),
  boostsActive: z.number(),
});

export const bantahBroScoreReasonSchema = z.object({
  code: z.string(),
  label: z.string(),
  impact: z.number(),
});

export const bantahBroRugScoreSchema = z.object({
  score: z.number().min(0).max(100),
  riskLevel: z.enum(bantahBroRiskLevelValues),
  verdict: z.string(),
  reasons: z.array(bantahBroScoreReasonSchema),
  missingSignals: z.array(z.string()),
});

export const bantahBroMomentumScoreSchema = z.object({
  score: z.number().min(0).max(100),
  momentumLevel: z.enum(bantahBroMomentumLevelValues),
  verdict: z.string(),
  reasons: z.array(bantahBroScoreReasonSchema),
});

export const bantahBroTopHolderSchema = z.object({
  address: z.string(),
  percentage: z.number().nullable(),
  balanceFormatted: z.string().nullable(),
  isContract: z.boolean().nullable(),
  label: z.string().nullable(),
  entity: z.string().nullable(),
});

export const bantahBroHolderMetricsSchema = z.object({
  source: z.literal("moralis"),
  status: z.enum(bantahBroHolderStatusValues),
  chainId: z.string(),
  network: z.string().nullable(),
  error: z.string().nullable(),
  totalHolders: z.number().nullable(),
  holderSupply: z.object({
    top10SupplyPercent: z.number().nullable(),
    top25SupplyPercent: z.number().nullable(),
    top50SupplyPercent: z.number().nullable(),
    top100SupplyPercent: z.number().nullable(),
  }),
  holderChange: z.object({
    m5ChangePercent: z.number().nullable(),
    h1ChangePercent: z.number().nullable(),
    h6ChangePercent: z.number().nullable(),
    h24ChangePercent: z.number().nullable(),
  }),
  holderDistribution: z.record(z.number()),
  topHolders: z.array(bantahBroTopHolderSchema),
});

export const bantahBroMarketLinkSchema = z.object({
  challengeId: z.number().int().positive(),
  url: z.string(),
});

export const bantahBroBoostSchema = z.object({
  id: z.string().min(1).max(128),
  marketId: z.string().min(1).max(128),
  multiplier: z.number().positive(),
  durationHours: z.number().int().positive(),
  bxbtSpent: z.string().min(1).max(64).nullable(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const bantahBroAlertSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(bantahBroAlertTypeValues),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  chainId: z.string(),
  tokenAddress: z.string(),
  tokenSymbol: z.string().nullable(),
  tokenName: z.string().nullable(),
  headline: z.string().min(1).max(280),
  body: z.string().min(1).max(1200),
  sentiment: z.enum(bantahBroSentimentValues),
  confidence: z.number().min(0).max(1),
  rugScore: z.number().min(0).max(100).nullable(),
  momentumScore: z.number().min(0).max(100).nullable(),
  referencePriceUsd: z.number().nullable(),
  sourceAnalysisAt: z.string().datetime(),
  market: bantahBroMarketLinkSchema.nullable(),
  boost: bantahBroBoostSchema.nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const bantahBroReceiptSchema = z.object({
  id: z.string().min(1).max(128),
  sourceAlertId: z.string().min(1).max(128),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  chainId: z.string(),
  tokenAddress: z.string(),
  tokenSymbol: z.string().nullable(),
  tokenName: z.string().nullable(),
  entryPriceUsd: z.number().positive(),
  latestPriceUsd: z.number().positive(),
  multiple: z.number().positive(),
  status: z.enum(bantahBroReceiptStatusValues),
  headline: z.string().min(1).max(280),
  body: z.string().min(1).max(1200),
  rewardEligible: z.boolean(),
  market: bantahBroMarketLinkSchema.nullable(),
});

export const bantahBroSystemAgentStatusSchema = z.object({
  ownerUserId: z.string().min(1),
  ownerUsername: z.string().min(1),
  agentId: z.string().uuid(),
  agentName: z.string().min(1),
  endpointUrl: z.string().url(),
  walletProvider: z.string().min(1).max(64),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  walletNetworkId: z.string().min(1).max(64),
  walletHealth: z.enum(bantahBroWalletHealthValues),
  runtimeStatus: z.string().nullable(),
  canCreateMarkets: z.boolean(),
  createdAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
});

export const bantahBroBxbtStatusSchema = z.object({
  configured: z.boolean(),
  tokenAddress: z.string().nullable(),
  tokenSymbol: z.literal("BXBT"),
  chainId: z.number().int().positive(),
  decimals: z.number().int().positive(),
  treasuryAddress: z.string().nullable(),
  marketCreationCost: z.string().min(1).max(64),
  boostUnitCost: z.string().min(1).max(64),
  rewardAmount: z.string().min(1).max(64),
  liveWalletRequired: z.boolean(),
  balance: z.object({
    available: z.boolean(),
    walletAddress: z.string().nullable(),
    amountAtomic: z.string().nullable(),
    amountFormatted: z.string().nullable(),
    error: z.string().nullable(),
  }),
});

export const bantahBroTokenAnalysisSchema = z.object({
  source: z.literal("dexscreener"),
  generatedAt: z.string().datetime(),
  chainId: z.string(),
  tokenAddress: z.string(),
  tokenSymbol: z.string().nullable(),
  tokenName: z.string().nullable(),
  primaryPair: bantahBroPairSnapshotSchema.nullable(),
  pairs: z.array(bantahBroPairSnapshotSchema),
  aggregate: z.object({
    pairCount: z.number(),
    totalLiquidityUsd: z.number(),
    totalVolumeH1: z.number(),
    totalVolumeH24: z.number(),
    totalBuysH1: z.number(),
    totalSellsH1: z.number(),
    strongestPriceChangeH1: z.number(),
    weakestPriceChangeH1: z.number(),
  }),
  holders: bantahBroHolderMetricsSchema,
  rug: bantahBroRugScoreSchema,
  momentum: bantahBroMomentumScoreSchema,
  suggestedActions: z.array(z.string()),
  posts: z.object({
    rug: z.string().nullable(),
    runner: z.string().nullable(),
  }),
});

export const bantahBroPublishAlertRequestSchema = z.object({
  chainId: z.string().trim().min(1).max(48).default("solana"),
  tokenAddress: z.string().trim().min(2).max(128),
  mode: z.enum(["auto", "rug", "runner", "watch"]).default("auto"),
});

export const bantahBroCreateMarketFromSignalRequestSchema = z.object({
  sourceAlertId: z.string().min(1).max(128).optional(),
  chainId: z.string().trim().min(1).max(48).optional(),
  tokenAddress: z.string().trim().min(2).max(128).optional(),
  durationHours: z.number().int().min(1).max(168).default(6),
  stakeAmount: z.string().min(1).max(32).default("10"),
  currency: z.enum(bantahSkillCurrencyValues).default("ETH"),
  executionChainId: z.number().int().positive().optional(),
  sourcePlatform: z.enum(["telegram", "twitter", "web", "system"]).optional(),
  chargeBxbt: z.boolean().default(false),
  question: z.string().min(5).max(280).optional(),
});

export const bantahBroEvaluateReceiptRequestSchema = z.object({
  sourceAlertId: z.string().min(1).max(128),
});

export const bantahBroEnsureSystemAgentRequestSchema = z.object({
  preferLiveWallet: z.boolean().default(true),
});

export const bantahBroBoostMarketRequestSchema = z.object({
  sourceAlertId: z.string().min(1).max(128).optional(),
  marketId: z.string().min(1).max(128),
  multiplier: z.number().positive().max(10).default(2),
  durationHours: z.number().int().min(1).max(72).default(6),
  chargeBxbt: z.boolean().default(true),
});

export const bantahBroCreateP2PMarketRequestSchema = z
  .object({
    sourceAlertId: z.string().min(1).max(128).optional(),
    chainId: z.string().trim().min(1).max(48).optional(),
    tokenAddress: z.string().trim().min(2).max(128).optional(),
    question: z.string().min(5).max(280).optional(),
    description: z.string().trim().min(1).max(600).optional(),
    category: z.string().trim().min(1).max(64).default("crypto"),
    durationHours: z.number().int().min(1).max(168).default(24),
    deadline: z.string().datetime().optional(),
    stakeAmount: z.string().min(1).max(32).default("10"),
    currency: z.enum(bantahSkillCurrencyValues).default("ETH"),
    executionChainId: z.number().int().positive().optional(),
    challengerSide: z.enum(["yes", "no"]).default("yes"),
    challengedUsername: z.string().trim().min(1).max(64).optional(),
    challengedWalletAddress: z
      .string()
      .trim()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
    challengedAgentId: z.string().uuid().optional(),
    chargeBxbt: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    const hasContext = Boolean(value.sourceAlertId || (value.chainId && value.tokenAddress) || value.question);
    if (!hasContext) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "P2P market creation needs either sourceAlertId, chainId plus tokenAddress, or an explicit question.",
        path: ["sourceAlertId"],
      });
    }

    const targetCount = Number(Boolean(value.challengedUsername))
      + Number(Boolean(value.challengedWalletAddress))
      + Number(Boolean(value.challengedAgentId));

    if (targetCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "P2P market creation requires exactly one opponent target.",
        path: ["challengedUsername"],
      });
    } else if (targetCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "P2P market creation accepts only one opponent target at a time.",
        path: ["challengedUsername"],
      });
    }
  });

export const bantahBroBxbtSpendRequestSchema = z.object({
  amount: z.string().min(1).max(64),
  reason: z.string().min(1).max(140),
  recipientAddress: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
});

export const bantahBroBxbtRewardRequestSchema = z.object({
  recipientAddress: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().min(1).max(64).optional(),
  reason: z.string().min(1).max(140).default("BantahBro reward"),
});

export type BantahBroRiskLevel = (typeof bantahBroRiskLevelValues)[number];
export type BantahBroMomentumLevel = (typeof bantahBroMomentumLevelValues)[number];
export type BantahBroHolderStatus = (typeof bantahBroHolderStatusValues)[number];
export type BantahBroAlertType = (typeof bantahBroAlertTypeValues)[number];
export type BantahBroSentiment = (typeof bantahBroSentimentValues)[number];
export type BantahBroReceiptStatus = (typeof bantahBroReceiptStatusValues)[number];
export type BantahBroWalletHealth = (typeof bantahBroWalletHealthValues)[number];
export type BantahBroTokenRef = z.infer<typeof bantahBroTokenRefSchema>;
export type BantahBroPairSnapshot = z.infer<typeof bantahBroPairSnapshotSchema>;
export type BantahBroScoreReason = z.infer<typeof bantahBroScoreReasonSchema>;
export type BantahBroRugScore = z.infer<typeof bantahBroRugScoreSchema>;
export type BantahBroMomentumScore = z.infer<typeof bantahBroMomentumScoreSchema>;
export type BantahBroHolderMetrics = z.infer<typeof bantahBroHolderMetricsSchema>;
export type BantahBroTokenAnalysis = z.infer<typeof bantahBroTokenAnalysisSchema>;
export type BantahBroMarketLink = z.infer<typeof bantahBroMarketLinkSchema>;
export type BantahBroBoost = z.infer<typeof bantahBroBoostSchema>;
export type BantahBroAlert = z.infer<typeof bantahBroAlertSchema>;
export type BantahBroReceipt = z.infer<typeof bantahBroReceiptSchema>;
export type BantahBroSystemAgentStatus = z.infer<typeof bantahBroSystemAgentStatusSchema>;
export type BantahBroBxbtStatus = z.infer<typeof bantahBroBxbtStatusSchema>;
export type BantahBroPublishAlertRequest = z.infer<typeof bantahBroPublishAlertRequestSchema>;
export type BantahBroCreateMarketFromSignalRequest = z.infer<
  typeof bantahBroCreateMarketFromSignalRequestSchema
>;
export type BantahBroEvaluateReceiptRequest = z.infer<
  typeof bantahBroEvaluateReceiptRequestSchema
>;
export type BantahBroEnsureSystemAgentRequest = z.infer<
  typeof bantahBroEnsureSystemAgentRequestSchema
>;
export type BantahBroBoostMarketRequest = z.infer<
  typeof bantahBroBoostMarketRequestSchema
>;
export type BantahBroCreateP2PMarketRequest = z.infer<
  typeof bantahBroCreateP2PMarketRequestSchema
>;
export type BantahBroBxbtSpendRequest = z.infer<typeof bantahBroBxbtSpendRequestSchema>;
export type BantahBroBxbtRewardRequest = z.infer<typeof bantahBroBxbtRewardRequestSchema>;
