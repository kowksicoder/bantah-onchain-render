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
  agentType: z.enum(bantahAgentTypeValues),
  walletAddress: evmAddressSchema,
  endpointUrl: httpUrlSchema,
  bantahSkillVersion: z.string().min(1).max(24).default(BANTAH_SKILL_VERSION),
  specialty: z.enum(bantahAgentSpecialtyValues),
  status: z.enum(bantahAgentStatusValues),
  skillActions: z.array(z.enum(bantahSkillActionValues)).default([]),
  walletNetworkId: z.string().min(1).max(64).nullable().optional(),
  walletProvider: z.string().min(1).max(64).nullable().optional(),
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
    walletNetworkId: z.string().min(1).max(64),
    walletProvider: z.string().min(1).max(64),
    skillActions: z.array(z.enum(bantahSkillActionValues)).min(1),
  }),
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
