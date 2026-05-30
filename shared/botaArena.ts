import { z } from "zod";

export const botaAgentIntentActionValues = [
  "attack",
  "defend",
  "focus",
  "special",
  "counter",
] as const;

export const botaArenaActionTypeValues = [
  "basic_attack",
  "guard",
  "focus",
  "special_attack",
  "counter",
] as const;

export const botaArenaBattleStatusValues = [
  "pending",
  "running",
  "resolved",
  "draw",
  "invalid",
] as const;

export const botaFighterArchetypeValues = [
  "signal_striker",
  "liquidity_guardian",
  "momentum_scout",
  "oracle_duelist",
  "chaos_berserker",
] as const;

export const botaAgentIntentSchema = z.object({
  agentId: z.string().trim().min(1).max(180),
  source: z.enum(["game-sdk", "mock-game", "manual", "system"]).default("mock-game"),
  action: z.enum(botaAgentIntentActionValues),
  skill: z.string().trim().min(1).max(80),
  target: z.enum(["enemy", "self"]).default("enemy"),
  confidence: z.number().min(0).max(1).default(0.5),
  rationale: z.string().trim().max(300).optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

export const botaArenaActionSchema = z.object({
  actorId: z.string().trim().min(1).max(180),
  targetId: z.string().trim().min(1).max(180),
  type: z.enum(botaArenaActionTypeValues),
  skill: z.string().trim().min(1).max(80),
  power: z.number().min(0).max(80),
  accuracy: z.number().min(0).max(1),
  energyCost: z.number().min(0).max(100),
  cooldownKey: z.string().trim().min(1).max(80),
  cooldownRounds: z.number().int().min(0).max(5),
  defenseBoost: z.number().min(0).max(1).default(0),
  intent: botaAgentIntentSchema,
});

export const botaArenaAdapterIssueSchema = z.object({
  code: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(240),
  severity: z.enum(["info", "warning", "error"]).default("error"),
});

export const botaArenaAdapterResultSchema = z.object({
  accepted: z.boolean(),
  action: botaArenaActionSchema.nullable(),
  fallbackAction: botaArenaActionSchema.nullable(),
  issues: z.array(botaArenaAdapterIssueSchema),
});

export const botaArenaFighterSchema = z.object({
  id: z.string().trim().min(1).max(180),
  name: z.string().trim().min(1).max(120),
  teamLabel: z.string().trim().min(1).max(80),
  sourceAgentId: z.string().trim().max(180).nullable().default(null),
  archetype: z.enum(botaFighterArchetypeValues),
  rank: z.number().int().positive().nullable().default(null),
  maxHealth: z.number().min(1).max(500),
  health: z.number().min(0).max(500),
  maxEnergy: z.number().min(1).max(200),
  energy: z.number().min(0).max(200),
  attack: z.number().min(1).max(100),
  defense: z.number().min(1).max(100),
  speed: z.number().min(1).max(100),
  accuracy: z.number().min(0).max(1),
  critChance: z.number().min(0).max(1),
  confidence: z.number().min(0).max(100),
  score: z.number().min(0).max(100),
  cooldowns: z.record(z.number().int().min(0).max(10)).default({}),
  statusEffects: z.array(z.string().trim().min(1).max(80)).default([]),
});

export const botaArenaRoundEventSchema = z.object({
  id: z.string().trim().min(1).max(220),
  round: z.number().int().positive(),
  actorId: z.string().trim().min(1).max(180),
  targetId: z.string().trim().min(1).max(180),
  actionType: z.enum(botaArenaActionTypeValues),
  skill: z.string().trim().min(1).max(80),
  hit: z.boolean(),
  critical: z.boolean(),
  damage: z.number().min(0).max(500),
  energyDelta: z.number().min(-200).max(200),
  targetHealthAfter: z.number().min(0).max(500),
  message: z.string().trim().min(1).max(260),
});

export const botaArenaBattleStateSchema = z.object({
  battleId: z.string().trim().min(1).max(255),
  seed: z.string().trim().min(1).max(255),
  round: z.number().int().min(0).max(20),
  maxRounds: z.number().int().positive().max(20),
  status: z.enum(botaArenaBattleStatusValues),
  fighters: z.tuple([botaArenaFighterSchema, botaArenaFighterSchema]),
  winnerId: z.string().trim().min(1).max(180).nullable(),
  resolutionReason: z.string().trim().max(160).nullable(),
  log: z.array(botaArenaRoundEventSchema),
});

export const botaArenaBattleSimulationSchema = z.object({
  provider: z.enum(["mock-game", "game-sdk"]),
  adapterVersion: z.string().trim().min(1).max(40),
  engineVersion: z.string().trim().min(1).max(40),
  generatedAt: z.string().datetime(),
  initialState: botaArenaBattleStateSchema,
  finalState: botaArenaBattleStateSchema,
  adapterResults: z.array(botaArenaAdapterResultSchema),
});

export type BotaAgentIntent = z.infer<typeof botaAgentIntentSchema>;
export type BotaArenaAction = z.infer<typeof botaArenaActionSchema>;
export type BotaArenaAdapterIssue = z.infer<typeof botaArenaAdapterIssueSchema>;
export type BotaArenaAdapterResult = z.infer<typeof botaArenaAdapterResultSchema>;
export type BotaArenaFighter = z.infer<typeof botaArenaFighterSchema>;
export type BotaArenaRoundEvent = z.infer<typeof botaArenaRoundEventSchema>;
export type BotaArenaBattleState = z.infer<typeof botaArenaBattleStateSchema>;
export type BotaArenaBattleSimulation = z.infer<typeof botaArenaBattleSimulationSchema>;
export type BotaAgentIntentAction = (typeof botaAgentIntentActionValues)[number];
export type BotaArenaActionType = (typeof botaArenaActionTypeValues)[number];
