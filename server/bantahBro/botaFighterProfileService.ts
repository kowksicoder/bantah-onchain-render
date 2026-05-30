import { asc, desc, eq, sql } from "drizzle-orm";
import {
  botaFighterProfiles,
  type BotaFighterProfileRecord,
} from "@shared/schema";
import {
  botaFighterProfileImportSchema,
  botaFighterProfileSchema,
  type BotaFighterClass,
  type BotaFighterOrigin,
  type BotaFighterProfile,
  type BotaFighterProfileImportRequest,
} from "@shared/botaFighterProfile";
import type { BotaArenaFighter } from "@shared/botaArena";
import { db } from "../db";
import {
  getLiveBantahBroAgentBattles,
  type BantahBroAgentBattle,
  type BantahBroAgentBattleSide,
} from "./agentBattleService";

const SERVER_ARENA_AGENT_AVATARS = [
  "/arena-agents/agent-1.jpg",
  "/arena-agents/agent-2.jpg",
  "/arena-agents/agent-3.jpg",
  "/arena-agents/agent-4.jpg",
] as const;

let ensureProfilesTablePromise: Promise<void> | null = null;

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function stableIndex(seed: string, length: number) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % length;
}

function arenaAgentAvatar(seed: string) {
  return SERVER_ARENA_AGENT_AVATARS[stableIndex(seed, SERVER_ARENA_AGENT_AVATARS.length)];
}

function normalizeAgentId(value: string) {
  return String(value || "bota-agent")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 180) || "bota-agent";
}

function symbolForSide(side: BantahBroAgentBattleSide) {
  return (side.tokenSymbol || side.label || "BOTA").replace(/^\$/, "").trim() || "BOTA";
}

function originForSide(side: BantahBroAgentBattleSide): BotaFighterOrigin {
  const haystack = [side.chainLabel, side.chainId, side.label, side.tokenName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (haystack.includes("ens")) return "ens";
  return "dexscreener";
}

function archetypeForSide(side: BantahBroAgentBattleSide): BotaArenaFighter["archetype"] {
  if (side.liquidityUsd && side.liquidityUsd > 750_000) return "liquidity_guardian";
  if (Math.abs(side.priceChangeH24 || 0) >= 100) return "chaos_berserker";
  if ((side.buysH24 || 0) + (side.sellsH24 || 0) > 5_000) return "momentum_scout";
  if (originForSide(side) === "ens") return "oracle_duelist";
  return "signal_striker";
}

function classForArchetype(archetype: BotaArenaFighter["archetype"]): BotaFighterClass {
  if (archetype === "liquidity_guardian") return "guardian";
  if (archetype === "momentum_scout") return "scout";
  if (archetype === "oracle_duelist") return "oracle";
  if (archetype === "chaos_berserker") return "berserker";
  return "striker";
}

function leagueForScore(score: number) {
  if (score >= 90) return "Elite League";
  if (score >= 75) return "Pro League";
  if (score >= 55) return "Open League";
  return "Qualifier League";
}

function titleForSide(side: BantahBroAgentBattleSide, battle: BantahBroAgentBattle) {
  if (battle.leadingSideId === side.id) return "Current Leader";
  if (side.confidence >= 60) return "Crowd Favorite";
  if (side.priceChangeH24 >= 100) return "Momentum Breaker";
  if ((side.liquidityUsd || 0) >= 750_000) return "Liquidity Wall";
  return "Arena Contender";
}

function fameScoreForSide(side: BantahBroAgentBattleSide, battle: BantahBroAgentBattle) {
  const confidence = clamp(side.confidence || 50, 0, 100);
  const score = clamp(side.score || 0, 0, 150);
  const volume = Math.log10(Math.max(1, side.volumeH24 || 0)) * 9;
  const liquidity = Math.log10(Math.max(1, side.liquidityUsd || 0)) * 5;
  const spectators = Math.log10(Math.max(1, battle.spectators || 0)) * 6;
  const leaderBonus = battle.leadingSideId === side.id ? 8 : 0;
  return clamp(confidence * 0.32 + score * 0.28 + volume + liquidity + spectators + leaderBonus, 1, 100);
}

function profileFromBattleSide(
  battle: BantahBroAgentBattle,
  side: BantahBroAgentBattleSide,
) {
  const origin = originForSide(side);
  const symbol = symbolForSide(side);
  const archetype = archetypeForSide(side);
  const fameScore = fameScoreForSide(side, battle);
  const rank = Math.max(1, Math.round(101 - clamp(side.score || fameScore, 1, 100)));
  const title = titleForSide(side, battle);

  return {
    agentId: normalizeAgentId(`${origin}:${side.id}`),
    displayName: side.agentName || `${symbol} Agent`,
    origin,
    originId: side.id,
    agentClass: classForArchetype(archetype),
    archetype,
    league: leagueForScore(side.score || fameScore),
    rank,
    avatarUrl: arenaAgentAvatar(`${side.agentName}:${side.id}`),
    badgeLabel: side.chainLabel ? `${side.chainLabel} League` : "BOTA League",
    ensName: origin === "ens" ? side.tokenName || null : null,
    walletAddress: side.tokenAddress,
    externalUrl: side.pairUrl,
    tokenSymbol: side.tokenSymbol || symbol,
    tokenName: side.tokenName,
    chainId: side.chainId,
    fameScore: fameScore.toFixed(2),
    watchers: Math.max(0, Math.round(battle.spectators || 0)),
    challengeVolume: Math.max(0, Math.round((side.buysH24 || 0) + (side.sellsH24 || 0))),
    titles: [title],
    tags: [
      origin,
      classForArchetype(archetype),
      side.chainLabel || side.chainId || "arena",
    ].filter(Boolean).slice(0, 6),
    lastBattleId: battle.id,
    metadata: {
      liveBattle: {
        id: battle.id,
        title: battle.title,
        status: battle.status,
        leadingSideId: battle.leadingSideId,
        confidenceSpread: battle.confidenceSpread,
      },
      market: {
        confidence: side.confidence,
        score: side.score,
        priceChangeM5: side.priceChangeM5,
        priceChangeH1: side.priceChangeH1,
        priceChangeH24: side.priceChangeH24,
        volumeH24: side.volumeH24,
        liquidityUsd: side.liquidityUsd,
      },
    },
  };
}

function normalizeProfileRecord(row: BotaFighterProfileRecord): BotaFighterProfile {
  return botaFighterProfileSchema.parse({
    agentId: row.agentId,
    displayName: row.displayName,
    origin: row.origin,
    originId: row.originId,
    agentClass: row.agentClass,
    archetype: row.archetype,
    league: row.league,
    rank: row.rank,
    avatarUrl: row.avatarUrl,
    badgeLabel: row.badgeLabel,
    ensName: row.ensName,
    walletAddress: row.walletAddress,
    externalUrl: row.externalUrl,
    tokenSymbol: row.tokenSymbol,
    tokenName: row.tokenName,
    chainId: row.chainId,
    wins: row.wins,
    losses: row.losses,
    currentStreak: row.currentStreak,
    fameScore: toNumber(row.fameScore),
    watchers: row.watchers,
    challengeVolume: row.challengeVolume,
    titles: Array.isArray(row.titles) ? row.titles : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    lastBattleId: row.lastBattleId,
    metadata: row.metadata || {},
    importedAt: toIso(row.importedAt),
    lastSeenAt: toIso(row.lastSeenAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  });
}

export async function ensureBotaFighterProfilesTable() {
  if (!ensureProfilesTablePromise) {
    ensureProfilesTablePromise = db.execute(sql`
      CREATE TABLE IF NOT EXISTS "bota_fighter_profiles" (
        "agent_id" varchar(180) PRIMARY KEY NOT NULL,
        "display_name" varchar(120) NOT NULL,
        "origin" varchar(32) NOT NULL DEFAULT 'bota',
        "origin_id" varchar(180),
        "agent_class" varchar(40) NOT NULL DEFAULT 'striker',
        "archetype" varchar(40) NOT NULL DEFAULT 'signal_striker',
        "league" varchar(80) NOT NULL DEFAULT 'Open League',
        "rank" integer,
        "avatar_url" text,
        "badge_label" varchar(80),
        "ens_name" varchar(160),
        "wallet_address" varchar(128),
        "external_url" text,
        "token_symbol" varchar(64),
        "token_name" varchar(160),
        "chain_id" varchar(64),
        "wins" integer NOT NULL DEFAULT 0,
        "losses" integer NOT NULL DEFAULT 0,
        "current_streak" integer NOT NULL DEFAULT 0,
        "fame_score" numeric(12, 2) NOT NULL DEFAULT 0,
        "watchers" integer NOT NULL DEFAULT 0,
        "challenge_volume" integer NOT NULL DEFAULT 0,
        "titles" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "last_battle_id" varchar(255),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "imported_at" timestamp DEFAULT now(),
        "last_seen_at" timestamp DEFAULT now(),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_bota_fighter_profiles_origin"
        ON "bota_fighter_profiles" ("origin");
      CREATE INDEX IF NOT EXISTS "idx_bota_fighter_profiles_rank"
        ON "bota_fighter_profiles" ("rank");
      CREATE INDEX IF NOT EXISTS "idx_bota_fighter_profiles_fame_score"
        ON "bota_fighter_profiles" ("fame_score");
      CREATE INDEX IF NOT EXISTS "idx_bota_fighter_profiles_last_seen_at"
        ON "bota_fighter_profiles" ("last_seen_at");
    `).then(() => undefined);
  }
  return ensureProfilesTablePromise;
}

async function upsertProfileSeed(profile: ReturnType<typeof profileFromBattleSide>) {
  const now = new Date();
  await db
    .insert(botaFighterProfiles)
    .values({
      ...profile,
      lastSeenAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: botaFighterProfiles.agentId,
      set: {
        displayName: profile.displayName,
        origin: profile.origin,
        originId: profile.originId,
        agentClass: profile.agentClass,
        archetype: profile.archetype,
        league: profile.league,
        rank: profile.rank,
        avatarUrl: profile.avatarUrl,
        badgeLabel: profile.badgeLabel,
        ensName: profile.ensName,
        walletAddress: profile.walletAddress,
        externalUrl: profile.externalUrl,
        tokenSymbol: profile.tokenSymbol,
        tokenName: profile.tokenName,
        chainId: profile.chainId,
        fameScore: profile.fameScore,
        watchers: profile.watchers,
        challengeVolume: profile.challengeVolume,
        titles: profile.titles,
        tags: profile.tags,
        lastBattleId: profile.lastBattleId,
        metadata: profile.metadata,
        lastSeenAt: now,
        updatedAt: now,
      },
    });
}

export async function syncBotaFighterProfilesFromLiveBattles(limit = 40) {
  await ensureBotaFighterProfilesTable();
  const feed = await getLiveBantahBroAgentBattles(Math.max(1, Math.min(Math.round(limit || 40), 40)));
  const profileSeeds = feed.battles.flatMap((battle) =>
    battle.sides.map((side) => profileFromBattleSide(battle, side)),
  );
  const seen = new Set<string>();
  const uniqueSeeds = profileSeeds.filter((seed) => {
    if (seen.has(seed.agentId)) return false;
    seen.add(seed.agentId);
    return true;
  });

  for (const profile of uniqueSeeds) {
    await upsertProfileSeed(profile);
  }

  return {
    synced: uniqueSeeds.length,
    battleCount: feed.battles.length,
    updatedAt: new Date().toISOString(),
  };
}

export async function listBotaFighterProfiles(input: {
  limit?: number;
  refreshLive?: boolean;
  origin?: BotaFighterOrigin | null;
} = {}) {
  await ensureBotaFighterProfilesTable();
  if (input.refreshLive !== false) {
    await syncBotaFighterProfilesFromLiveBattles(Math.max(10, input.limit || 40));
  }

  const requestedLimit = Math.max(1, Math.min(Math.round(input.limit || 40), 100));
  const rows = input.origin
    ? await db
        .select()
        .from(botaFighterProfiles)
        .where(eq(botaFighterProfiles.origin, input.origin))
        .orderBy(desc(botaFighterProfiles.fameScore), asc(botaFighterProfiles.rank))
        .limit(requestedLimit)
    : await db
        .select()
        .from(botaFighterProfiles)
        .orderBy(desc(botaFighterProfiles.fameScore), asc(botaFighterProfiles.rank))
        .limit(requestedLimit);

  return {
    profiles: rows.map(normalizeProfileRecord),
    updatedAt: new Date().toISOString(),
  };
}

export async function getBotaFighterProfile(agentId: string, refreshLive = true) {
  await ensureBotaFighterProfilesTable();
  const normalizedAgentId = normalizeAgentId(agentId);
  let [row] = await db
    .select()
    .from(botaFighterProfiles)
    .where(eq(botaFighterProfiles.agentId, normalizedAgentId))
    .limit(1);

  if (!row && refreshLive) {
    await syncBotaFighterProfilesFromLiveBattles(40);
    [row] = await db
      .select()
      .from(botaFighterProfiles)
      .where(eq(botaFighterProfiles.agentId, normalizedAgentId))
      .limit(1);
  }

  return row ? normalizeProfileRecord(row) : null;
}

export async function importBotaFighterProfile(input: BotaFighterProfileImportRequest) {
  await ensureBotaFighterProfilesTable();
  const parsed = botaFighterProfileImportSchema.parse(input);
  const now = new Date();
  const agentId = normalizeAgentId(
    parsed.agentId ||
      `${parsed.origin}:${parsed.originId || parsed.ensName || parsed.walletAddress || parsed.displayName}`,
  );

  const values = {
    agentId,
    displayName: parsed.displayName,
    origin: parsed.origin,
    originId: parsed.originId || null,
    agentClass: parsed.agentClass,
    archetype: parsed.archetype,
    league: parsed.league,
    rank: parsed.rank || null,
    avatarUrl: parsed.avatarUrl || arenaAgentAvatar(`${parsed.origin}:${parsed.displayName}`),
    badgeLabel: parsed.badgeLabel || `${parsed.origin.toUpperCase()} Agent`,
    ensName: parsed.ensName || null,
    walletAddress: parsed.walletAddress || null,
    externalUrl: parsed.externalUrl || null,
    tokenSymbol: parsed.tokenSymbol || null,
    tokenName: parsed.tokenName || null,
    chainId: parsed.chainId || null,
    titles: parsed.titles,
    tags: parsed.tags.length ? parsed.tags : [parsed.origin, parsed.agentClass],
    metadata: parsed.metadata,
    lastSeenAt: now,
    updatedAt: now,
  };

  const [row] = await db
    .insert(botaFighterProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: botaFighterProfiles.agentId,
      set: {
        ...values,
        importedAt: now,
      },
    })
    .returning();

  return normalizeProfileRecord(row);
}
