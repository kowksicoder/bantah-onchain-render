import { z } from "zod";

export const BANTAH_SKILL_VERSION = "1.0.0";
export const bantahSkillCurrencyValues = ["USDC", "USDT", "ETH", "BNB"] as const;

export const bantahAgentTypeValues = ["imported", "bantah_created"] as const;
export const bantahAgentSpecialtyValues = [
  "sports",
  "crypto",
  "politics",
  "general",
] as const;
export const bantahAgentStatusValues = ["active", "suspended", "rekt"] as const;

export type BantahAgentType = (typeof bantahAgentTypeValues)[number];
export type BantahAgentSpecialty = (typeof bantahAgentSpecialtyValues)[number];
export type BantahAgentStatus = (typeof bantahAgentStatusValues)[number];

export const bantahSkillActionValues = [
  "create_market",
  "join_yes",
  "join_no",
  "read_market",
  "check_balance",
  "read_leaderboard",
  "create_p2p_market",
  "challenge_user",
  "settle_market",
] as const;

export type BantahSkillAction = (typeof bantahSkillActionValues)[number];

export const bantahRequiredSkillActionValues = [
  "create_market",
  "join_yes",
  "join_no",
  "read_market",
  "check_balance",
] as const;

export type BantahRequiredSkillAction =
  (typeof bantahRequiredSkillActionValues)[number];

export const bantahSkillErrorCodeValues = [
  "insufficient_balance",
  "market_closed",
  "invalid_input",
  "unauthorized",
  "unsupported_action",
  "rate_limited",
  "internal_error",
] as const;

export type BantahSkillErrorCode = (typeof bantahSkillErrorCodeValues)[number];

export const bantahWebhookEventValues = [
  "market_settled",
  "bet_won",
  "bet_lost",
  "challenge_received",
] as const;

export type BantahWebhookEvent = (typeof bantahWebhookEventValues)[number];

export const evmAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Wallet address must be a valid EVM address");
export const evmTransactionHashSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Transaction hash must be a valid EVM hash");

export const marketOptionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
});

export const agentActionEnvelopeSchema = z.object({
  action: z.enum(bantahSkillActionValues),
  skillVersion: z.string().default(BANTAH_SKILL_VERSION),
  requestId: z.string().min(1).max(128),
  timestamp: z.string().datetime().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const createMarketInputSchema = z.object({
  question: z.string().min(5).max(280),
  options: z.array(z.string().min(1).max(120)).min(2).max(10),
  deadline: z.string().datetime(),
  stakeAmount: z.string().min(1).max(32),
  currency: z.enum(bantahSkillCurrencyValues).default("USDC"),
  chainId: z.number().int().positive().default(8453),
});

export const joinMarketInputSchema = z.object({
  marketId: z.string().min(1).max(128),
  stakeAmount: z.string().min(1).max(32),
});

export const readMarketInputSchema = z.object({
  marketId: z.string().min(1).max(128),
});

export const checkBalanceInputSchema = z.object({
  currency: z.enum(bantahSkillCurrencyValues).default("USDC"),
  chainId: z.number().int().positive().default(8453),
});

export const readLeaderboardInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
});

export const createP2PMarketInputSchema = z
  .object({
    question: z.string().min(5).max(280),
    description: z.string().trim().min(1).max(600).optional(),
    category: z.string().trim().min(1).max(64).default("crypto"),
    deadline: z.string().datetime(),
    stakeAmount: z.string().min(1).max(32),
    currency: z.enum(bantahSkillCurrencyValues).default("USDC"),
    chainId: z.number().int().positive().default(8453),
    challengerSide: z.enum(["yes", "no"]).default("yes"),
    challengedUsername: z.string().trim().min(1).max(64).optional(),
    challengedWalletAddress: evmAddressSchema.optional(),
    challengedAgentId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    const targetCount = Number(Boolean(value.challengedUsername))
      + Number(Boolean(value.challengedWalletAddress))
      + Number(Boolean(value.challengedAgentId));

    if (targetCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Create P2P market requires exactly one opponent target: challengedUsername, challengedWalletAddress, or challengedAgentId.",
        path: ["challengedUsername"],
      });
    } else if (targetCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Create P2P market accepts only one opponent target at a time.",
        path: ["challengedUsername"],
      });
    }
  });

export const marketParticipantSchema = z.object({
  participantId: z.string().min(1).max(128),
  participantType: z.enum(["agent", "human"]),
  side: z.enum(["yes", "no"]),
  stakeAmount: z.string().min(1).max(32),
});

export const readMarketResultSchema = z.object({
  marketId: z.string().min(1).max(128),
  status: z.enum(["open", "pending", "matched", "settled", "cancelled"]),
  currency: z.enum(bantahSkillCurrencyValues),
  chainId: z.number().int().positive(),
  odds: z.object({
    yes: z.number().min(0).max(1),
    no: z.number().min(0).max(1),
  }),
  participants: z.array(marketParticipantSchema),
  deadline: z.string().datetime(),
  totalPool: z.string().min(1).max(32),
  yesPool: z.string().min(1).max(32),
  noPool: z.string().min(1).max(32),
});

export const createMarketResultSchema = z.object({
  marketId: z.string().min(1).max(128),
  status: z.enum(["open", "pending"]),
  question: z.string().min(5).max(280),
  options: z.array(marketOptionSchema).min(2).max(10),
  deadline: z.string().datetime(),
  stakeAmount: z.string().min(1).max(32),
  currency: z.enum(bantahSkillCurrencyValues),
  chainId: z.number().int().positive(),
  creatorWalletAddress: evmAddressSchema,
});

export const joinMarketResultSchema = z.object({
  marketId: z.string().min(1).max(128),
  side: z.enum(["yes", "no"]),
  acceptedStakeAmount: z.string().min(1).max(32),
  currency: z.enum(bantahSkillCurrencyValues),
  chainId: z.number().int().positive(),
  status: z.enum(["queued", "matched", "accepted"]),
  escrowTxHash: evmTransactionHashSchema.optional(),
});

export const checkBalanceResultSchema = z.object({
  walletAddress: evmAddressSchema,
  currency: z.enum(bantahSkillCurrencyValues),
  chainId: z.number().int().positive(),
  availableBalance: z.string().min(1).max(32),
  updatedAt: z.string().datetime(),
});

export const leaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  userId: z.string().min(1).max(128),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  points: z.number().int().nonnegative(),
  coins: z.number().int().nonnegative(),
  eventsWon: z.number().int().nonnegative(),
  challengesWon: z.number().int().nonnegative(),
});

export const readLeaderboardResultSchema = z.object({
  entries: z.array(leaderboardEntrySchema),
  generatedAt: z.string().datetime(),
});

export const createP2PMarketResultSchema = z.object({
  marketId: z.string().min(1).max(128),
  status: z.enum(["pending", "open", "active"]),
  question: z.string().min(5).max(280),
  description: z.string().nullable(),
  deadline: z.string().datetime(),
  stakeAmount: z.string().min(1).max(32),
  currency: z.enum(bantahSkillCurrencyValues),
  chainId: z.number().int().positive(),
  challengerSide: z.enum(["yes", "no"]),
  challengedSide: z.enum(["yes", "no"]),
  challengerWalletAddress: evmAddressSchema,
  challengedUserId: z.string().min(1).max(128).nullable(),
  challengedAgentId: z.string().uuid().nullable(),
  challengedWalletAddress: evmAddressSchema.nullable(),
  challengedLabel: z.string().min(1).max(160),
  escrowTxHash: evmTransactionHashSchema.optional(),
});

export const skillErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(bantahSkillErrorCodeValues),
    message: z.string().min(1).max(280),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
  requestId: z.string().min(1).max(128),
  skillVersion: z.string().default(BANTAH_SKILL_VERSION),
});

export const skillSuccessEnvelopeSchema = z.object({
  ok: z.literal(true),
  requestId: z.string().min(1).max(128),
  skillVersion: z.string().default(BANTAH_SKILL_VERSION),
  result: z.unknown(),
});

export const webhookPayloadSchema = z.object({
  event: z.enum(bantahWebhookEventValues),
  webhookId: z.string().min(1).max(128),
  agentId: z.string().min(1).max(128),
  marketId: z.string().min(1).max(128),
  occurredAt: z.string().datetime(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type AgentActionEnvelope = z.infer<typeof agentActionEnvelopeSchema>;
export type CreateMarketInput = z.infer<typeof createMarketInputSchema>;
export type JoinMarketInput = z.infer<typeof joinMarketInputSchema>;
export type ReadMarketInput = z.infer<typeof readMarketInputSchema>;
export type CheckBalanceInput = z.infer<typeof checkBalanceInputSchema>;
export type ReadLeaderboardInput = z.infer<typeof readLeaderboardInputSchema>;
export type CreateP2PMarketInput = z.infer<typeof createP2PMarketInputSchema>;
export type MarketParticipant = z.infer<typeof marketParticipantSchema>;
export type ReadMarketResult = z.infer<typeof readMarketResultSchema>;
export type CreateMarketResult = z.infer<typeof createMarketResultSchema>;
export type JoinMarketResult = z.infer<typeof joinMarketResultSchema>;
export type CheckBalanceResult = z.infer<typeof checkBalanceResultSchema>;
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type ReadLeaderboardResult = z.infer<typeof readLeaderboardResultSchema>;
export type CreateP2PMarketResult = z.infer<typeof createP2PMarketResultSchema>;
export type SkillErrorResponse = z.infer<typeof skillErrorSchema>;
export type SkillSuccessEnvelope = z.infer<typeof skillSuccessEnvelopeSchema>;
export type BantahWebhookPayload = z.infer<typeof webhookPayloadSchema>;
