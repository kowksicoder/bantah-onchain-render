import { z } from "zod";
import {
  BANTAH_SKILL_VERSION,
  bantahAgentSpecialtyValues,
  bantahAgentStatusValues,
  bantahSkillActionValues,
  bantahAgentTypeValues,
  bantahRequiredSkillActionValues,
  evmAddressSchema,
} from "./agentSkill";
import {
  bantahElizaRuntimeConfigSchema,
  bantahElizaRuntimeEngineValues,
  bantahElizaRuntimeStatusValues,
} from "./elizaAgent";

export const bantahAgentKitChainNetworkIds = {
  1: "ethereum-mainnet",
  10: "optimism-mainnet",
  137: "polygon-mainnet",
  8453: "base-mainnet",
  42161: "arbitrum-mainnet",
  80002: "polygon-amoy",
  84532: "base-sepolia",
  421614: "arbitrum-sepolia",
  11155111: "ethereum-sepolia",
  11155420: "optimism-sepolia",
} as const;

export type BantahAgentKitNetworkId =
  (typeof bantahAgentKitChainNetworkIds)[keyof typeof bantahAgentKitChainNetworkIds];

export const bantahAgentKitSupportedChainIds = Object.keys(
  bantahAgentKitChainNetworkIds,
).map((value) => Number(value));

export function getBantahAgentKitNetworkIdForChainId(
  chainId: number,
): BantahAgentKitNetworkId | null {
  const numericChainId = Number(chainId);
  if (!Number.isFinite(numericChainId)) return null;
  return (
    bantahAgentKitChainNetworkIds[
      numericChainId as keyof typeof bantahAgentKitChainNetworkIds
    ] || null
  );
}

export function getBantahAgentKitChainIdForNetworkId(networkId: string): number | null {
  const normalizedNetworkId = String(networkId || "").trim();
  if (!normalizedNetworkId) return null;

  const match = Object.entries(bantahAgentKitChainNetworkIds).find(
    ([, value]) => value === normalizedNetworkId,
  );
  return match ? Number(match[0]) : null;
}

const httpUrlSchema = z
  .string()
  .url("Endpoint URL must be a valid URL")
  .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
    message: "Endpoint URL must use http or https",
  });

export const agentImportRequestSchema = z.object({
  agentName: z.string().min(2).max(80),
  walletAddress: evmAddressSchema,
  endpointUrl: httpUrlSchema,
  specialty: z.enum(bantahAgentSpecialtyValues).default("general"),
  isTokenized: z.boolean().default(false),
});

export const agentSkillCheckRequestSchema = z.object({
  endpointUrl: httpUrlSchema,
});

export const agentCreateRequestSchema = z.object({
  agentName: z.string().min(2).max(80),
  specialty: z.enum(bantahAgentSpecialtyValues).default("general"),
  chainId: z.coerce.number().int().positive().default(8453),
  avatarUrl: z.string().url().nullable().optional(),
});

export const agentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  specialty: z.enum(bantahAgentSpecialtyValues).optional(),
  agentType: z.enum(bantahAgentTypeValues).optional(),
  status: z.enum(bantahAgentStatusValues).optional(),
  sort: z.enum(["newest", "points", "wins"]).default("newest"),
});

export const agentOwnerSummarySchema = z.object({
  id: z.string().min(1),
  username: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  profileImageUrl: z.string().nullable().optional(),
});

export const agentRegistryProfileSchema = z.object({
  agentId: z.string().uuid(),
  ownerId: z.string().min(1),
  agentName: z.string().min(2).max(80),
  avatarUrl: z.string().nullable().optional(),
  agentType: z.enum(bantahAgentTypeValues),
  walletAddress: evmAddressSchema,
  endpointUrl: httpUrlSchema,
  bantahSkillVersion: z.string().min(1).max(24).default(BANTAH_SKILL_VERSION),
  specialty: z.enum(bantahAgentSpecialtyValues),
  status: z.enum(bantahAgentStatusValues),
  skillActions: z.array(z.enum(bantahSkillActionValues)).default([]),
  walletNetworkId: z.string().min(1).max(64).nullable().optional(),
  walletProvider: z.string().min(1).max(64).nullable().optional(),
  runtimeEngine: z.enum(bantahElizaRuntimeEngineValues).nullable().optional(),
  runtimeStatus: z.enum(bantahElizaRuntimeStatusValues).nullable().optional(),
  points: z.number().int().nonnegative(),
  winCount: z.number().int().nonnegative(),
  lossCount: z.number().int().nonnegative(),
  marketCount: z.number().int().nonnegative(),
  isTokenized: z.boolean(),
  lastSkillCheckAt: z.string().datetime().nullable(),
  lastSkillCheckScore: z.number().int().min(0).max(100).nullable(),
  lastSkillCheckStatus: z.enum(["passed", "failed"]).nullable(),
  createdAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
  owner: agentOwnerSummarySchema,
});

export const agentSkillCheckActionResultSchema = z.object({
  action: z.enum(bantahRequiredSkillActionValues),
  passed: z.boolean(),
  ok: z.boolean(),
  responseType: z.enum(["success", "error", "invalid", "network_error"]),
  statusCode: z.number().int().nullable(),
  durationMs: z.number().int().nonnegative(),
  message: z.string().min(1),
});

export const agentSkillCheckResultSchema = z.object({
  endpointUrl: httpUrlSchema,
  checkedAt: z.string().datetime(),
  overallPassed: z.boolean(),
  complianceScore: z.number().int().min(0).max(100),
  results: z.array(agentSkillCheckActionResultSchema).length(
    bantahRequiredSkillActionValues.length,
  ),
});

export const agentImportResponseSchema = z.object({
  agent: agentRegistryProfileSchema,
  skillCheck: agentSkillCheckResultSchema,
});

export const agentCreateResponseSchema = z.object({
  agent: agentRegistryProfileSchema,
  provisioned: z.object({
    walletAddress: evmAddressSchema,
    endpointUrl: httpUrlSchema,
    chainId: z.number().int().positive(),
    walletNetworkId: z.string().min(1).max(64),
    walletProvider: z.string().min(1).max(64),
    skillActions: z.array(z.enum(bantahSkillActionValues)).min(1),
  }),
  runtime: bantahElizaRuntimeConfigSchema,
});

export const agentListResponseSchema = z.object({
  items: z.array(agentRegistryProfileSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export const agentActivityItemSchema = z.object({
  activityId: z.string().min(1),
  type: z.enum(["created_market", "joined_market", "won_market", "lost_market"]),
  challengeId: z.number().int().positive(),
  title: z.string().min(1),
  category: z.string().nullable().optional(),
  side: z.enum(["yes", "no"]).nullable().optional(),
  occurredAt: z.string().datetime().nullable(),
});

export const agentActivityResponseSchema = z.object({
  agentId: z.string().uuid(),
  items: z.array(agentActivityItemSchema),
});

export const agentFollowStateResponseSchema = z.object({
  agentId: z.string().uuid(),
  isFollowing: z.boolean(),
  followerCount: z.number().int().nonnegative(),
});

export const agentRuntimeStateResponseSchema = z.object({
  agentId: z.string().uuid(),
  runtimeEngine: z.enum(bantahElizaRuntimeEngineValues).nullable().optional(),
  runtimeStatus: z.enum(bantahElizaRuntimeStatusValues).nullable().optional(),
  health: z.enum(["healthy", "starting", "stopped", "error", "external"]),
  isManagedRuntimeLive: z.boolean(),
  startedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
  chainId: z.number().int().positive().nullable(),
  chainName: z.string().nullable(),
  wallet: z.object({
    address: evmAddressSchema,
    provider: z.string().nullable(),
    networkId: z.string().nullable(),
    balance: z.string().nullable(),
    currency: z.string().nullable(),
    status: z.enum(["ready", "external", "error", "unavailable"]),
    message: z.string().nullable(),
    explorerUrl: z.string().url().nullable().optional(),
    supportedTokens: z.array(z.enum(["USDC", "USDT", "ETH", "BNB"])).default([]),
  }),
  controls: z.object({
    canPause: z.boolean(),
    canResume: z.boolean(),
    canRestart: z.boolean(),
  }),
});

export const agentWalletSendRequestSchema = z.object({
  recipientAddress: evmAddressSchema,
  tokenSymbol: z.enum(["USDC", "USDT", "ETH", "BNB"]),
  amount: z
    .string()
    .min(1)
    .max(32)
    .refine((value) => /^\d+(\.\d+)?$/.test(value.trim()), {
      message: "Amount must be a valid positive number",
    })
    .refine((value) => Number.parseFloat(value) > 0, {
      message: "Amount must be greater than zero",
    }),
});

export const agentWalletSendResponseSchema = z.object({
  agentId: z.string().uuid(),
  walletAddress: evmAddressSchema,
  recipientAddress: evmAddressSchema,
  tokenSymbol: z.enum(["USDC", "USDT", "ETH", "BNB"]),
  amount: z.string().min(1),
  walletNetworkId: z.string().min(1).max(64),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  explorerUrl: z.string().url().nullable(),
});

export const agentWalletProvisionResponseSchema = z.object({
  agent: agentRegistryProfileSchema,
  provisioned: z.object({
    walletAddress: evmAddressSchema,
    walletNetworkId: z.string().min(1).max(64),
    walletProvider: z.string().min(1).max(64),
  }),
});

export const agentOfferingTypeValues = ["forecast", "research"] as const;
export const agentOfferingStatusValues = ["draft", "unavailable"] as const;

export const agentOfferingSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(agentOfferingTypeValues),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(280),
  paymentRail: z.literal("x402"),
  priceUsd: z.string().min(1).max(16),
  settlementCurrency: z.literal("USDC"),
  settlementNetworkId: z.string().min(1).max(64),
  audience: z.enum(["user", "agent", "both"]),
  estimatedDelivery: z.string().min(1).max(64),
  status: z.enum(agentOfferingStatusValues),
  availabilityReason: z.string().nullable(),
});

export const agentOfferingsResponseSchema = z.object({
  agentId: z.string().uuid(),
  sellerMode: z.enum(["managed", "external"]),
  x402Phase: z.literal("catalog"),
  canSellWithX402: z.boolean(),
  items: z.array(agentOfferingSchema),
});

export const agentLeaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  agentId: z.string().uuid(),
  agentName: z.string().min(2).max(80),
  avatarUrl: z.string().nullable().optional(),
  specialty: z.enum(bantahAgentSpecialtyValues),
  points: z.number().int().nonnegative(),
  winCount: z.number().int().nonnegative(),
  lossCount: z.number().int().nonnegative(),
  marketCount: z.number().int().nonnegative(),
  followerCount: z.number().int().nonnegative(),
  lastSkillCheckStatus: z.enum(["passed", "failed"]).nullable(),
  owner: agentOwnerSummarySchema,
});

export const agentLeaderboardResponseSchema = z.object({
  items: z.array(agentLeaderboardEntrySchema),
  totalAgents: z.number().int().nonnegative(),
});

export const agentRankResponseSchema = z.object({
  agentId: z.string().uuid(),
  rank: z.number().int().positive().nullable(),
  totalAgents: z.number().int().nonnegative(),
  followerCount: z.number().int().nonnegative(),
});

export type AgentImportRequest = z.infer<typeof agentImportRequestSchema>;
export type AgentSkillCheckRequest = z.infer<typeof agentSkillCheckRequestSchema>;
export type AgentCreateRequest = z.infer<typeof agentCreateRequestSchema>;
export type AgentListQuery = z.infer<typeof agentListQuerySchema>;
export type AgentOwnerSummary = z.infer<typeof agentOwnerSummarySchema>;
export type AgentRegistryProfile = z.infer<typeof agentRegistryProfileSchema>;
export type AgentSkillCheckActionResult = z.infer<
  typeof agentSkillCheckActionResultSchema
>;
export type AgentSkillCheckResult = z.infer<typeof agentSkillCheckResultSchema>;
export type AgentImportResponse = z.infer<typeof agentImportResponseSchema>;
export type AgentCreateResponse = z.infer<typeof agentCreateResponseSchema>;
export type AgentListResponse = z.infer<typeof agentListResponseSchema>;
export type AgentActivityItem = z.infer<typeof agentActivityItemSchema>;
export type AgentActivityResponse = z.infer<typeof agentActivityResponseSchema>;
export type AgentFollowStateResponse = z.infer<typeof agentFollowStateResponseSchema>;
export type AgentRuntimeStateResponse = z.infer<typeof agentRuntimeStateResponseSchema>;
export type AgentWalletSendRequest = z.infer<typeof agentWalletSendRequestSchema>;
export type AgentWalletSendResponse = z.infer<typeof agentWalletSendResponseSchema>;
export type AgentWalletProvisionResponse = z.infer<typeof agentWalletProvisionResponseSchema>;
export type AgentOffering = z.infer<typeof agentOfferingSchema>;
export type AgentOfferingsResponse = z.infer<typeof agentOfferingsResponseSchema>;
export type AgentLeaderboardEntry = z.infer<typeof agentLeaderboardEntrySchema>;
export type AgentLeaderboardResponse = z.infer<typeof agentLeaderboardResponseSchema>;
export type AgentRankResponse = z.infer<typeof agentRankResponseSchema>;
