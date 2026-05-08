import {
  getBantahBroBattleEngineFeed,
  type BantahBroBattleCandidate,
  type BantahBroBattleDiscoveryTokenProfile,
} from "./battleDiscoveryEngine";
import { listBantahBroListedBattleCandidates } from "./battleListingsService";
import {
  choosePrimaryPair,
  fetchDexScreenerTokenPairs,
  normalizePair,
} from "./tokenIntelligence";

const AGENT_BATTLE_CACHE_TTL_MS = 5_000;
const BATTLE_WINDOW_MS = 5 * 60 * 1000;
const LISTED_BATTLES_TIMEOUT_MS = Number(process.env.BANTAHBRO_LISTED_BATTLES_TIMEOUT_MS || 3_500);
const LISTED_BATTLE_REFRESH_TIMEOUT_MS = Number(process.env.BANTAHBRO_LISTED_BATTLE_REFRESH_TIMEOUT_MS || 5_000);
const BATTLE_ENGINE_TIMEOUT_MS = Number(process.env.BANTAHBRO_BATTLE_ENGINE_TIMEOUT_MS || 7_500);

export interface BantahBroAgentBattleSide {
  id: string;
  label: string;
  agentName: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  emoji: string;
  logoUrl: string | null;
  chainId: string | null;
  chainLabel: string | null;
  tokenAddress: string | null;
  pairAddress: string | null;
  pairUrl: string | null;
  dexId: string | null;
  priceUsd: number | null;
  priceDisplay: string;
  priceChangeM5: number;
  priceChangeH1: number;
  priceChangeH24: number;
  change: string;
  direction: "up" | "down" | "flat";
  volumeM5: number;
  volumeH1: number;
  volumeH24: number | null;
  liquidityUsd: number | null;
  marketCap: number | null;
  buysM5: number;
  sellsM5: number;
  buysH1: number;
  sellsH1: number;
  buysH24: number;
  sellsH24: number;
  pairAgeMinutes: number | null;
  dataSource: "dexscreener";
  dataUpdatedAt: string;
  score: number;
  confidence: number;
  status: "attacking" | "defending" | "staggered" | "holding";
}

export interface BantahBroAgentBattleEvent {
  id: string;
  time: string;
  type: "momentum" | "volume" | "liquidity" | "system";
  severity: "info" | "hot" | "danger";
  sideId: string | null;
  agentName: string;
  message: string;
  metricLabel: string | null;
  metricValue: string | null;
}

export interface BantahBroAgentBattle {
  id: string;
  title: string;
  battleType: "agent-battle";
  status: "live";
  winnerLogic: string;
  startsAt: string;
  endsAt: string;
  timeRemainingSeconds: number;
  spectators: number;
  sides: [BantahBroAgentBattleSide, BantahBroAgentBattleSide];
  leadingSideId: string;
  confidenceSpread: number;
  events: BantahBroAgentBattleEvent[];
  updatedAt: string;
}

export interface BantahBroAgentBattlesFeed {
  battles: BantahBroAgentBattle[];
  updatedAt: string;
  sources: {
    marketData: "dexscreener";
    note: string;
  };
}

let cachedFeed: BantahBroAgentBattlesFeed | null = null;
let cachedAt = 0;
let cachedLimit = 0;
let inflightFeedPromise: Promise<BantahBroAgentBattlesFeed> | null = null;
let inflightLimit = 0;
let lockedRoundKey = "";
let lockedRoundBattleIds: string[] = [];
let lockedRoundCandidateSnapshots: BantahBroBattleCandidate[] = [];

type BattleTokenEntry = Pick<
  BantahBroBattleDiscoveryTokenProfile,
  | "id"
  | "emoji"
  | "logoUrl"
  | "displaySymbol"
  | "actualSymbol"
  | "tokenName"
  | "change"
  | "direction"
  | "priceChangeH24"
  | "priceUsd"
  | "priceDisplay"
  | "chainId"
  | "chainLabel"
  | "marketCap"
  | "liquidityUsd"
  | "volumeH24"
  | "volumeM5"
  | "volumeH1"
  | "priceChangeM5"
  | "priceChangeH1"
  | "buysM5"
  | "sellsM5"
  | "buysH1"
  | "sellsH1"
  | "buysH24"
  | "sellsH24"
  | "tokenAddress"
  | "pairAddress"
  | "pairUrl"
  | "dexId"
  | "pairAgeMinutes"
>;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function normalizeSymbol(entry: BattleTokenEntry) {
  const symbol = entry.actualSymbol || entry.displaySymbol || "LIVE";
  return symbol.replace(/^\$/, "").trim() || "LIVE";
}

function formatUsd(value: number | null | undefined) {
  const resolved = safeNumber(value);
  if (resolved <= 0) return "n/a";
  if (resolved >= 1_000_000_000) return `$${(resolved / 1_000_000_000).toFixed(2)}B`;
  if (resolved >= 1_000_000) return `$${(resolved / 1_000_000).toFixed(2)}M`;
  if (resolved >= 1_000) return `$${(resolved / 1_000).toFixed(1)}K`;
  return `$${resolved.toFixed(2)}`;
}

function formatInteger(value: number | null | undefined) {
  return Math.round(safeNumber(value)).toLocaleString("en-US");
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.00%";
  const absolute = Math.abs(value);
  const precision = absolute >= 100 ? 0 : absolute >= 10 ? 1 : 2;
  return `${value > 0 ? "+" : ""}${value.toFixed(precision)}%`;
}

function formatPrice(value: number | null | undefined) {
  const resolved = safeNumber(value);
  if (resolved <= 0) return "n/a";
  if (resolved >= 1) return `$${resolved.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
  return `$${resolved.toFixed(8).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function scoreEntry(entry: BattleTokenEntry) {
  const change =
    safeNumber(entry.priceChangeM5) * 1.5 +
    safeNumber(entry.priceChangeH1) * 0.85 +
    safeNumber(entry.priceChangeH24) * 0.35;
  const volume = safeNumber(entry.volumeM5) * 18 + safeNumber(entry.volumeH1) * 4 + safeNumber(entry.volumeH24);
  const liquidity = safeNumber(entry.liquidityUsd);
  const shortTrades = safeNumber(entry.buysM5) + safeNumber(entry.sellsM5);
  const h1Trades = safeNumber(entry.buysH1) + safeNumber(entry.sellsH1);
  const buyRatio =
    shortTrades > 0
      ? safeNumber(entry.buysM5) / shortTrades
      : h1Trades > 0
        ? safeNumber(entry.buysH1) / h1Trades
        : 0.5;
  const momentumScore = clamp(50 + change * 1.15, 0, 110);
  const volumeScore = clamp(Math.log10(volume + 1) * 6, 0, 42);
  const liquidityScore = clamp(Math.log10(liquidity + 1) * 4, 0, 28);
  const buyPressureScore = clamp((buyRatio - 0.5) * 38 + Math.log10(shortTrades + h1Trades + 1) * 3, -18, 24);
  const trendBonus = entry.direction === "up" ? 8 : entry.direction === "down" ? -8 : 0;

  return Math.max(1, Math.round(momentumScore + volumeScore + liquidityScore + buyPressureScore + trendBonus));
}

function buildSide(
  entry: BattleTokenEntry,
  confidence: number,
  score: number,
): BantahBroAgentBattleSide {
  const symbol = normalizeSymbol(entry);
  const status =
    confidence >= 58
      ? "attacking"
      : confidence <= 42
        ? "staggered"
        : entry.direction === "up"
          ? "defending"
          : "holding";

  return {
    id: `${String(entry.chainId || "unknown").toLowerCase()}:${String(entry.tokenAddress || entry.id).toLowerCase()}`,
    label: entry.displaySymbol || `$${symbol}`,
    agentName: `${symbol} Agent`,
    tokenSymbol: entry.actualSymbol,
    tokenName: entry.tokenName,
    emoji: entry.emoji,
    logoUrl: entry.logoUrl,
    chainId: entry.chainId,
    chainLabel: entry.chainLabel,
    tokenAddress: entry.tokenAddress,
    pairAddress: entry.pairAddress,
    pairUrl: entry.pairUrl,
    dexId: entry.dexId,
    priceUsd: entry.priceUsd,
    priceDisplay: entry.priceDisplay,
    priceChangeM5: entry.priceChangeM5,
    priceChangeH1: entry.priceChangeH1,
    priceChangeH24: entry.priceChangeH24,
    change: entry.change,
    direction: entry.direction,
    volumeM5: entry.volumeM5,
    volumeH1: entry.volumeH1,
    volumeH24: entry.volumeH24,
    liquidityUsd: entry.liquidityUsd,
    marketCap: entry.marketCap,
    buysM5: entry.buysM5,
    sellsM5: entry.sellsM5,
    buysH1: entry.buysH1,
    sellsH1: entry.sellsH1,
    buysH24: entry.buysH24,
    sellsH24: entry.sellsH24,
    pairAgeMinutes: entry.pairAgeMinutes,
    dataSource: "dexscreener",
    dataUpdatedAt: new Date().toISOString(),
    score,
    confidence,
    status,
  };
}

async function refreshTokenEntry(entry: BattleTokenEntry): Promise<BattleTokenEntry> {
  if (!entry.chainId || !entry.tokenAddress) {
    throw new Error(`Cannot refresh ${entry.displaySymbol}: missing Dexscreener token reference`);
  }

  const rawPairs = await fetchDexScreenerTokenPairs({
    chainId: entry.chainId,
    tokenAddress: entry.tokenAddress,
  });
  const pairs = rawPairs
    .map(normalizePair)
    .filter((pair) => pair.chainId && pair.pairAddress);
  const pair = choosePrimaryPair(pairs);

  if (!pair) {
    throw new Error(`Cannot refresh ${entry.displaySymbol}: no live Dexscreener pair found`);
  }

  const priceChangeH24 = pair.priceChange.h24;
  const direction =
    priceChangeH24 > 0 ? ("up" as const) : priceChangeH24 < 0 ? ("down" as const) : ("flat" as const);
  const actualSymbol = pair.baseToken.symbol || entry.actualSymbol;
  const displaySymbol = actualSymbol ? `$${normalizeSymbol({ ...entry, actualSymbol })}` : entry.displaySymbol;

  return {
    ...entry,
    id: `${String(pair.chainId || entry.chainId).toLowerCase()}:${String(pair.baseToken.address || entry.tokenAddress).toLowerCase()}`,
    logoUrl: pair.imageUrl || entry.logoUrl,
    displaySymbol,
    actualSymbol,
    tokenName: pair.baseToken.name || entry.tokenName,
    chainId: pair.chainId || entry.chainId,
    chainLabel: entry.chainLabel,
    tokenAddress: pair.baseToken.address || entry.tokenAddress,
    pairAddress: pair.pairAddress || entry.pairAddress,
    pairUrl: pair.url || entry.pairUrl,
    dexId: pair.dexId || entry.dexId,
    priceUsd: pair.priceUsd,
    priceDisplay: formatPrice(pair.priceUsd),
    priceChangeM5: pair.priceChange.m5,
    priceChangeH1: pair.priceChange.h1,
    priceChangeH24,
    change: formatPercent(priceChangeH24),
    direction,
    volumeM5: pair.volume.m5,
    volumeH1: pair.volume.h1,
    volumeH24: pair.volume.h24,
    liquidityUsd: pair.liquidityUsd,
    marketCap: pair.marketCap,
    buysM5: pair.txns.m5.buys,
    sellsM5: pair.txns.m5.sells,
    buysH1: pair.txns.h1.buys,
    sellsH1: pair.txns.h1.sells,
    buysH24: pair.txns.h24.buys,
    sellsH24: pair.txns.h24.sells,
    pairAgeMinutes: pair.pairAgeMinutes,
  };
}

async function refreshListedCandidate(candidate: BantahBroBattleCandidate): Promise<BantahBroBattleCandidate> {
  const [left, right] = await Promise.all(candidate.sides.map((side) => refreshTokenEntry(side)));
  return {
    ...candidate,
    sides: [left, right] as [
      BantahBroBattleDiscoveryTokenProfile,
      BantahBroBattleDiscoveryTokenProfile,
    ],
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  return results;
}

function eventTime(now: Date, offsetSeconds: number) {
  return new Date(now.getTime() - offsetSeconds * 1000).toISOString();
}

function buildEvents(params: {
  battleId: string;
  now: Date;
  left: BantahBroAgentBattleSide;
  right: BantahBroAgentBattleSide;
}): BantahBroAgentBattleEvent[] {
  const { battleId, now, left, right } = params;
  const leader = left.confidence >= right.confidence ? left : right;
  const trailer = leader.id === left.id ? right : left;

  const events: BantahBroAgentBattleEvent[] = [
    {
      id: `${battleId}-lead`,
      time: eventTime(now, 12),
      type: "momentum",
      severity: leader.confidence >= 60 ? "hot" : "info",
      sideId: leader.id,
      agentName: leader.agentName,
      message: `${leader.label} is leading at ${leader.confidence}% confidence on live market strength.`,
      metricLabel: "24H move",
      metricValue: leader.change,
    },
    {
      id: `${battleId}-volume-a`,
      time: eventTime(now, 32),
      type: "volume",
      severity: safeNumber(left.volumeH24) >= safeNumber(right.volumeH24) ? "hot" : "info",
      sideId: left.id,
      agentName: left.agentName,
      message: `${left.label} brings ${formatUsd(left.volumeH24)} in 24H volume into the arena.`,
      metricLabel: "24H volume",
      metricValue: formatUsd(left.volumeH24),
    },
    {
      id: `${battleId}-volume-b`,
      time: eventTime(now, 49),
      type: "volume",
      severity: safeNumber(right.volumeH24) > safeNumber(left.volumeH24) ? "hot" : "info",
      sideId: right.id,
      agentName: right.agentName,
      message: `${right.label} is fighting back with ${formatUsd(right.volumeH24)} in 24H volume.`,
      metricLabel: "24H volume",
      metricValue: formatUsd(right.volumeH24),
    },
    {
      id: `${battleId}-pressure`,
      time: eventTime(now, 68),
      type: "system",
      severity: trailer.direction === "down" ? "danger" : "info",
      sideId: trailer.id,
      agentName: "BantahBro Engine",
      message:
        trailer.direction === "down"
          ? `${trailer.label} is taking pressure with a ${trailer.change} 24H move.`
          : `${trailer.label} is still in range. One live volume burst can flip this battle.`,
      metricLabel: "confidence gap",
      metricValue: `${Math.abs(left.confidence - right.confidence)}%`,
    },
    {
      id: `${battleId}-trades-a`,
      time: eventTime(now, 86),
      type: "momentum",
      severity: left.buysH24 >= left.sellsH24 ? "hot" : "info",
      sideId: left.id,
      agentName: left.agentName,
      message: `${left.label} has ${formatInteger(left.buysH24)} buys vs ${formatInteger(left.sellsH24)} sells in 24H.`,
      metricLabel: "24H buys",
      metricValue: formatInteger(left.buysH24),
    },
    {
      id: `${battleId}-liquidity-b`,
      time: eventTime(now, 104),
      type: "liquidity",
      severity: safeNumber(right.liquidityUsd) >= safeNumber(left.liquidityUsd) ? "hot" : "info",
      sideId: right.id,
      agentName: right.agentName,
      message: `${right.label} is holding ${formatUsd(right.liquidityUsd)} liquidity for the next push.`,
      metricLabel: "liquidity",
      metricValue: formatUsd(right.liquidityUsd),
    },
  ];

  return events;
}

function winnerLogicForCandidate(candidate?: BantahBroBattleCandidate) {
  if (!candidate) {
    return "Hybrid live score: live 5M/1H/24H price movement, volume, buy pressure, and liquidity strength.";
  }

  if (candidate.winnerRule === "highest_price_gain") {
    return "Highest percentage price gain from live market snapshots wins.";
  }
  if (candidate.winnerRule === "buy_pressure") {
    return "Strongest live buy pressure and buy/sell dominance wins.";
  }
  if (candidate.winnerRule === "volume_dominance") {
    return "Highest live volume dominance wins.";
  }
  return "Hybrid live score: live 5M/1H/24H price movement, buy pressure, volume, liquidity, and rivalry strength.";
}

function lockCandidatesForRound(
  candidates: BantahBroBattleCandidate[],
  requestedBattles: number,
  now: Date,
) {
  const roundKey = String(Math.floor(now.getTime() / BATTLE_WINDOW_MS));
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  if (candidates.length === 0) {
    return lockedRoundCandidateSnapshots.slice(0, requestedBattles);
  }

  if (lockedRoundKey !== roundKey) {
    lockedRoundKey = roundKey;
    lockedRoundCandidateSnapshots = candidates.slice(0, requestedBattles);
    lockedRoundBattleIds = lockedRoundCandidateSnapshots.map((candidate) => candidate.id);
  } else if (lockedRoundBattleIds.length < requestedBattles) {
    for (const candidate of candidates) {
      if (lockedRoundBattleIds.length >= requestedBattles) break;
      if (lockedRoundBattleIds.includes(candidate.id)) continue;
      lockedRoundBattleIds.push(candidate.id);
      lockedRoundCandidateSnapshots.push(candidate);
    }
  }

  lockedRoundCandidateSnapshots = lockedRoundBattleIds
    .map((id) => byId.get(id) || lockedRoundCandidateSnapshots.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is BantahBroBattleCandidate => Boolean(candidate));

  return lockedRoundCandidateSnapshots.slice(0, requestedBattles);
}

function buildBattle(
  leftEntry: BattleTokenEntry,
  rightEntry: BattleTokenEntry,
  index: number,
  now: Date,
  candidate?: BantahBroBattleCandidate,
): BantahBroAgentBattle {
  const leftScore = scoreEntry(leftEntry);
  const rightScore = scoreEntry(rightEntry);
  const totalScore = Math.max(1, leftScore + rightScore);
  const leftConfidence = clamp(Math.round((leftScore / totalScore) * 100), 5, 95);
  const rightConfidence = 100 - leftConfidence;
  const left = buildSide(leftEntry, leftConfidence, leftScore);
  const right = buildSide(rightEntry, rightConfidence, rightScore);
  const battleWindowMs = BATTLE_WINDOW_MS;
  const bucketStart = Math.floor(now.getTime() / battleWindowMs) * battleWindowMs;
  const startsAt = new Date(bucketStart);
  const endsAt = new Date(bucketStart + battleWindowMs);
  const leadingSideId = left.confidence >= right.confidence ? left.id : right.id;
  const volumeTotal = safeNumber(left.volumeH24) + safeNumber(right.volumeH24);
  const liquidityTotal = safeNumber(left.liquidityUsd) + safeNumber(right.liquidityUsd);
  const spectators = Math.round(clamp(Math.log10(volumeTotal + liquidityTotal + 1) * 180, 120, 2600));
  const battleId = candidate?.officialListing?.id
    ? candidate.officialListing.id
    : `agent-battle-${index + 1}-${startsAt.getTime()}-${left.id}-${right.id}`
        .replace(/[^a-zA-Z0-9:-]/g, "-")
        .slice(0, 180);

  return {
    id: battleId,
    title: `${left.label} vs ${right.label}`,
    battleType: "agent-battle",
    status: "live",
    winnerLogic: winnerLogicForCandidate(candidate),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    timeRemainingSeconds: Math.max(0, Math.round((endsAt.getTime() - now.getTime()) / 1000)),
    spectators,
    sides: [left, right],
    leadingSideId,
    confidenceSpread: Math.abs(left.confidence - right.confidence),
    events: buildEvents({ battleId, now, left, right }),
    updatedAt: now.toISOString(),
  };
}

async function buildFeed(limit: number): Promise<BantahBroAgentBattlesFeed> {
  const requestedBattles = clamp(Math.round(limit || 3), 1, 40);
  const now = new Date();
  const battles: BantahBroAgentBattle[] = [];
  const candidatePool: BantahBroBattleCandidate[] = [];
  const seenCandidateIds = new Set<string>();
  const addCandidates = (candidates: BantahBroBattleCandidate[]) => {
    for (const candidate of candidates) {
      if (seenCandidateIds.has(candidate.id)) continue;
      seenCandidateIds.add(candidate.id);
      candidatePool.push(candidate);
    }
  };

  try {
    addCandidates(
      await withTimeout(
        listBantahBroListedBattleCandidates(Math.max(requestedBattles, 40)),
        LISTED_BATTLES_TIMEOUT_MS,
        "Listed Agent Battles lookup",
      ),
    );
  } catch {
    // Listed battles are only one source. If they are temporarily unavailable, the
    // round lock can still hold the existing battle or use engine-selected pairs.
  }

  try {
    const engineFeed = await withTimeout(
      getBantahBroBattleEngineFeed({
        scanLimit: Math.min(40, requestedBattles * 8 + 12),
        candidateLimit: Math.max(40, requestedBattles * 16),
        selectedLimit: Math.max(requestedBattles, 8),
        featuredLimit: Math.max(3, requestedBattles),
      }),
      BATTLE_ENGINE_TIMEOUT_MS,
      "Agent Battle engine scan",
    );
    addCandidates(engineFeed.selectedBattles);
  } catch {
    // Keep the Agent Battles page alive with the older real Dexscreener ticker path if
    // the broader discovery scan is temporarily unavailable.
  }

  const roundCandidates = lockCandidatesForRound(candidatePool, requestedBattles, now);
  const refreshedRoundCandidates = await mapWithConcurrency(
    roundCandidates,
    5,
    async (candidate) => {
      try {
        return await withTimeout(
          refreshListedCandidate(candidate),
          LISTED_BATTLE_REFRESH_TIMEOUT_MS,
          `Agent Battle live refresh ${candidate.id}`,
        );
      } catch {
        return null;
      }
    },
  );

  for (const candidate of refreshedRoundCandidates) {
    if (battles.length >= requestedBattles) break;
    if (!candidate) continue;
    const [leftEntry, rightEntry] = candidate.sides;
    battles.push(buildBattle(leftEntry, rightEntry, battles.length, now, candidate));
  }

  return {
    battles,
    updatedAt: now.toISOString(),
    sources: {
      marketData: "dexscreener",
      note:
        "Agent Battle stats are refreshed from live Dexscreener market windows on request. Stored listings are never rendered as live data without a fresh market pull.",
    },
  };
}

export async function getLiveBantahBroAgentBattles(limit = 3) {
  const now = Date.now();
  const requestedLimit = clamp(Math.round(limit || 3), 1, 40);
  const trimFeed = (feed: BantahBroAgentBattlesFeed): BantahBroAgentBattlesFeed => ({
    ...feed,
    battles: feed.battles.slice(0, requestedLimit),
  });
  const refreshFeed = (limitToRefresh: number) => {
    inflightLimit = limitToRefresh;
    const currentPromise = buildFeed(limitToRefresh)
      .then((feed) => {
        cachedFeed = feed;
        cachedAt = Date.now();
        cachedLimit = limitToRefresh;
        return feed;
      })
      .catch((error) => {
        if (cachedFeed) return cachedFeed;
        throw error;
      })
      .finally(() => {
        if (inflightFeedPromise === currentPromise) {
          inflightFeedPromise = null;
          inflightLimit = 0;
        }
      });
    inflightFeedPromise = currentPromise;
    return currentPromise;
  };

  if (cachedFeed && cachedLimit >= requestedLimit && now - cachedAt < AGENT_BATTLE_CACHE_TTL_MS) {
    return trimFeed(cachedFeed);
  }

  if (cachedFeed && cachedLimit >= requestedLimit) {
    if (!inflightFeedPromise || inflightLimit < requestedLimit) {
      void refreshFeed(requestedLimit);
    }
    return trimFeed(cachedFeed);
  }

  if (!inflightFeedPromise || inflightLimit < requestedLimit) {
    refreshFeed(requestedLimit);
  }

  return inflightFeedPromise.then(trimFeed);
}
