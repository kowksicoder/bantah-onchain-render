import { z } from "zod";
import { botaArenaBattleSimulationSchema } from "./botaArena";

export const botaArenaBattleRecordStatusValues = [
  "resolved",
  "draw",
  "invalid",
] as const;

export const botaArenaBattleRecordSchema = z.object({
  id: z.string().trim().min(1).max(80),
  recordKey: z.string().trim().min(1).max(360),
  battleId: z.string().trim().min(1).max(255),
  sourceBattleId: z.string().trim().max(255).nullable().default(null),
  title: z.string().trim().min(1).max(255),
  arenaId: z.string().trim().max(120).nullable().default(null),
  status: z.enum(botaArenaBattleRecordStatusValues),
  winnerAgentId: z.string().trim().max(180).nullable().default(null),
  winnerSideId: z.string().trim().max(180).nullable().default(null),
  loserAgentId: z.string().trim().max(180).nullable().default(null),
  loserSideId: z.string().trim().max(180).nullable().default(null),
  provider: z.enum(["mock-game", "game-sdk"]),
  adapterVersion: z.string().trim().min(1).max(40),
  engineVersion: z.string().trim().min(1).max(40),
  seed: z.string().trim().min(1).max(255),
  rounds: z.number().int().min(0).max(20),
  spectators: z.number().int().min(0).default(0),
  fighters: z.array(z.record(z.string(), z.unknown())).default([]),
  roundLog: z.array(z.record(z.string(), z.unknown())).default([]),
  simulation: botaArenaBattleSimulationSchema,
  battleSnapshot: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
  startedAt: z.string().datetime().nullable().default(null),
  endedAt: z.string().datetime().nullable().default(null),
  resolvedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime().nullable().default(null),
  updatedAt: z.string().datetime().nullable().default(null),
});

export type BotaArenaBattleRecordStatus =
  (typeof botaArenaBattleRecordStatusValues)[number];
export type BotaArenaBattleRecord = z.infer<typeof botaArenaBattleRecordSchema>;
