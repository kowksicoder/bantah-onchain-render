import { z } from "zod";
import { botaFighterArchetypeValues } from "./botaArena";

export const botaFighterOriginValues = [
  "bota",
  "virtuals",
  "game-sdk",
  "eliza",
  "ens",
  "dexscreener",
  "manual",
] as const;

export const botaFighterClassValues = [
  "striker",
  "guardian",
  "scout",
  "oracle",
  "berserker",
  "creator",
  "champion",
] as const;

export const botaFighterProfileSchema = z.object({
  agentId: z.string().trim().min(1).max(180),
  displayName: z.string().trim().min(1).max(120),
  origin: z.enum(botaFighterOriginValues),
  originId: z.string().trim().max(180).nullable().default(null),
  agentClass: z.enum(botaFighterClassValues),
  archetype: z.enum(botaFighterArchetypeValues),
  league: z.string().trim().min(1).max(80),
  rank: z.number().int().positive().nullable().default(null),
  avatarUrl: z.string().trim().max(512).nullable().default(null),
  badgeLabel: z.string().trim().max(80).nullable().default(null),
  ensName: z.string().trim().max(160).nullable().default(null),
  walletAddress: z.string().trim().max(128).nullable().default(null),
  externalUrl: z.string().trim().max(512).nullable().default(null),
  tokenSymbol: z.string().trim().max(64).nullable().default(null),
  tokenName: z.string().trim().max(160).nullable().default(null),
  chainId: z.string().trim().max(64).nullable().default(null),
  wins: z.number().int().min(0).default(0),
  losses: z.number().int().min(0).default(0),
  currentStreak: z.number().int().default(0),
  fameScore: z.number().min(0).default(0),
  watchers: z.number().int().min(0).default(0),
  challengeVolume: z.number().int().min(0).default(0),
  titles: z.array(z.string().trim().min(1).max(80)).default([]),
  tags: z.array(z.string().trim().min(1).max(80)).default([]),
  lastBattleId: z.string().trim().max(255).nullable().default(null),
  metadata: z.record(z.string(), z.unknown()).default({}),
  importedAt: z.string().datetime().nullable().default(null),
  lastSeenAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime().nullable().default(null),
  updatedAt: z.string().datetime().nullable().default(null),
});

export const botaFighterProfileImportSchema = z.object({
  agentId: z.string().trim().min(1).max(180).optional(),
  displayName: z.string().trim().min(1).max(120),
  origin: z.enum(botaFighterOriginValues).default("manual"),
  originId: z.string().trim().max(180).optional().nullable(),
  agentClass: z.enum(botaFighterClassValues).default("striker"),
  archetype: z.enum(botaFighterArchetypeValues).default("signal_striker"),
  league: z.string().trim().min(1).max(80).default("Open League"),
  rank: z.coerce.number().int().positive().optional().nullable(),
  avatarUrl: z.string().trim().max(512).optional().nullable(),
  badgeLabel: z.string().trim().max(80).optional().nullable(),
  ensName: z.string().trim().max(160).optional().nullable(),
  walletAddress: z.string().trim().max(128).optional().nullable(),
  externalUrl: z.string().trim().max(512).optional().nullable(),
  tokenSymbol: z.string().trim().max(64).optional().nullable(),
  tokenName: z.string().trim().max(160).optional().nullable(),
  chainId: z.string().trim().max(64).optional().nullable(),
  titles: z.array(z.string().trim().min(1).max(80)).default([]),
  tags: z.array(z.string().trim().min(1).max(80)).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type BotaFighterOrigin = (typeof botaFighterOriginValues)[number];
export type BotaFighterClass = (typeof botaFighterClassValues)[number];
export type BotaFighterProfile = z.infer<typeof botaFighterProfileSchema>;
export type BotaFighterProfileImportRequest = z.infer<typeof botaFighterProfileImportSchema>;
