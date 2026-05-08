import type { AgentBattle, AgentBattleEvent, AgentBattleSide } from '@/types/agentBattle';

const DEFAULT_BATTLE_DURATION_SECONDS = 5 * 60;

export type ArenaGuiAccent = 'green' | 'red';

export type ArenaGuiCueKind =
  | 'confidence'
  | 'momentum'
  | 'volume'
  | 'liquidity'
  | 'pressure'
  | 'trade-flow'
  | 'event';

export type ArenaGuiCueSeverity = 'info' | 'hot' | 'danger';

export type ArenaGuiSideState = {
  id: string;
  index: 0 | 1;
  accent: ArenaGuiAccent;
  label: string;
  agentName: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  logoUrl: string | null;
  chainId: string | null;
  chainLabel: string | null;
  pairUrl: string | null;
  priceUsd: number | null;
  priceDisplay: string;
  priceChangeM5: number;
  priceChangeH1: number;
  priceChangeH24: number;
  volumeM5: number;
  volumeH1: number;
  volumeH24: number;
  liquidityUsd: number;
  marketCap: number;
  buysM5: number;
  sellsM5: number;
  buysH24: number;
  sellsH24: number;
  buyPressureM5Usd: number;
  sellPressureM5Usd: number;
  buyPressureShareM5: number;
  liveTradesM5: number;
  score: number;
  confidence: number;
  health: number;
  status: AgentBattleSide['status'];
  isLeading: boolean;
};

export type ArenaGuiEventState = {
  id: string;
  time: string;
  type: AgentBattleEvent['type'];
  severity: AgentBattleEvent['severity'];
  sideId: string | null;
  agentName: string;
  message: string;
  metricLabel: string | null;
  metricValue: string | null;
};

export type ArenaGuiState = {
  battleId: string;
  title: string;
  status: AgentBattle['status'];
  winnerLogic: string;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
  spectators: number;
  durationSeconds: number;
  elapsedSeconds: number;
  timeRemainingSeconds: number;
  confidenceSpread: number;
  leadingSideId: string;
  left: ArenaGuiSideState;
  right: ArenaGuiSideState;
  scoreBar: {
    leftPercent: number;
    rightPercent: number;
  };
  events: ArenaGuiEventState[];
};

export type ArenaGuiCue = {
  kind: ArenaGuiCueKind;
  severity: ArenaGuiCueSeverity;
  attackerSideId: string;
  defenderSideId: string;
  delta: number;
  source: 'battle-delta' | 'battle-event';
  message: string;
};

type SideDelta = {
  side: AgentBattleSide;
  confidence: number;
  score: number;
  priceChangeM5: number;
  priceChangeH24: number;
  volumeM5: number;
  liquidityUsd: number;
  buysM5: number;
  sellsM5: number;
  pressure: number;
};

function safeNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sideTokenLabel(side: AgentBattleSide) {
  return side.tokenSymbol || side.label.replace(/^\$/, '') || side.agentName;
}

function estimateBuyPressureUsd(side: AgentBattleSide) {
  const volume = safeNumber(side.volumeM5);
  const totalTrades = side.buysM5 + side.sellsM5;
  if (volume <= 0 || totalTrades <= 0) return 0;
  return volume * (side.buysM5 / totalTrades);
}

function estimateSellPressureUsd(side: AgentBattleSide) {
  const volume = safeNumber(side.volumeM5);
  const totalTrades = side.buysM5 + side.sellsM5;
  if (volume <= 0 || totalTrades <= 0) return 0;
  return volume * (side.sellsM5 / totalTrades);
}

function estimatePressureShare(side: AgentBattleSide, opponent: AgentBattleSide) {
  const own = estimateBuyPressureUsd(side);
  const other = estimateBuyPressureUsd(opponent);
  const total = own + other;
  if (total <= 0) return clamp(side.confidence, 0, 100);
  return Math.round((own / total) * 100);
}

function battleDurationSeconds(battle: AgentBattle) {
  const startsAt = new Date(battle.startsAt).getTime();
  const endsAt = new Date(battle.endsAt).getTime();
  const fromTimestamps = Math.round((endsAt - startsAt) / 1000);
  if (Number.isFinite(fromTimestamps) && fromTimestamps > 0) return fromTimestamps;
  return Math.max(DEFAULT_BATTLE_DURATION_SECONDS, battle.timeRemainingSeconds);
}

function mapSideState(
  side: AgentBattleSide,
  opponent: AgentBattleSide,
  index: 0 | 1,
  leadingSideId: string,
): ArenaGuiSideState {
  const confidence = clamp(Math.round(side.confidence), 0, 100);
  return {
    id: side.id,
    index,
    accent: index === 0 ? 'green' : 'red',
    label: side.label,
    agentName: side.agentName,
    tokenSymbol: side.tokenSymbol,
    tokenName: side.tokenName,
    logoUrl: side.logoUrl,
    chainId: side.chainId,
    chainLabel: side.chainLabel,
    pairUrl: side.pairUrl,
    priceUsd: side.priceUsd,
    priceDisplay: side.priceDisplay,
    priceChangeM5: safeNumber(side.priceChangeM5),
    priceChangeH1: safeNumber(side.priceChangeH1),
    priceChangeH24: safeNumber(side.priceChangeH24),
    volumeM5: safeNumber(side.volumeM5),
    volumeH1: safeNumber(side.volumeH1),
    volumeH24: safeNumber(side.volumeH24),
    liquidityUsd: safeNumber(side.liquidityUsd),
    marketCap: safeNumber(side.marketCap),
    buysM5: safeNumber(side.buysM5),
    sellsM5: safeNumber(side.sellsM5),
    buysH24: safeNumber(side.buysH24),
    sellsH24: safeNumber(side.sellsH24),
    buyPressureM5Usd: estimateBuyPressureUsd(side),
    sellPressureM5Usd: estimateSellPressureUsd(side),
    buyPressureShareM5: estimatePressureShare(side, opponent),
    liveTradesM5: side.buysM5 + side.sellsM5,
    score: safeNumber(side.score),
    confidence,
    health: confidence,
    status: side.status,
    isLeading: side.id === leadingSideId,
  };
}

function mapEventState(event: AgentBattleEvent): ArenaGuiEventState {
  return {
    id: event.id,
    time: event.time,
    type: event.type,
    severity: event.severity,
    sideId: event.sideId,
    agentName: event.agentName,
    message: event.message,
    metricLabel: event.metricLabel,
    metricValue: event.metricValue,
  };
}

export function mapBattleToArenaGuiState(battle: AgentBattle): ArenaGuiState {
  const [leftInput, rightInput] = battle.sides;
  const durationSeconds = battleDurationSeconds(battle);
  const remainingSeconds = clamp(Math.round(battle.timeRemainingSeconds), 0, durationSeconds);
  const left = mapSideState(leftInput, rightInput, 0, battle.leadingSideId);
  const right = mapSideState(rightInput, leftInput, 1, battle.leadingSideId);

  return {
    battleId: battle.id,
    title: battle.title,
    status: battle.status,
    winnerLogic: battle.winnerLogic,
    startsAt: battle.startsAt,
    endsAt: battle.endsAt,
    updatedAt: battle.updatedAt,
    spectators: battle.spectators,
    durationSeconds,
    elapsedSeconds: durationSeconds - remainingSeconds,
    timeRemainingSeconds: remainingSeconds,
    confidenceSpread: battle.confidenceSpread,
    leadingSideId: battle.leadingSideId,
    left,
    right,
    scoreBar: {
      leftPercent: left.confidence,
      rightPercent: right.confidence,
    },
    events: battle.events.map(mapEventState),
  };
}

function getComparableSides(previous: AgentBattle, current: AgentBattle) {
  return current.sides
    .map((side) => {
      const previousSide = previous.sides.find((candidate) => candidate.id === side.id);
      return previousSide ? { previousSide, side } : null;
    })
    .filter((entry): entry is { previousSide: AgentBattleSide; side: AgentBattleSide } => Boolean(entry));
}

function calculateSideDelta(previousSide: AgentBattleSide, side: AgentBattleSide): SideDelta {
  return {
    side,
    confidence: safeNumber(side.confidence) - safeNumber(previousSide.confidence),
    score: safeNumber(side.score) - safeNumber(previousSide.score),
    priceChangeM5: safeNumber(side.priceChangeM5) - safeNumber(previousSide.priceChangeM5),
    priceChangeH24: safeNumber(side.priceChangeH24) - safeNumber(previousSide.priceChangeH24),
    volumeM5: safeNumber(side.volumeM5) - safeNumber(previousSide.volumeM5),
    liquidityUsd: safeNumber(side.liquidityUsd) - safeNumber(previousSide.liquidityUsd),
    buysM5: safeNumber(side.buysM5) - safeNumber(previousSide.buysM5),
    sellsM5: safeNumber(side.sellsM5) - safeNumber(previousSide.sellsM5),
    pressure: estimateBuyPressureUsd(side) - estimateBuyPressureUsd(previousSide),
  };
}

function chooseCueKind(delta: SideDelta): ArenaGuiCueKind {
  if (Math.abs(delta.confidence) >= 1) return 'confidence';
  if (Math.abs(delta.priceChangeM5) >= 0.25 || Math.abs(delta.priceChangeH24) >= 0.5) return 'momentum';
  if (Math.abs(delta.volumeM5) >= 5_000) return 'volume';
  if (Math.abs(delta.pressure) >= 1_000) return 'pressure';
  if (Math.abs(delta.buysM5) + Math.abs(delta.sellsM5) > 0) return 'trade-flow';
  return 'liquidity';
}

function deltaStrength(delta: SideDelta) {
  return (
    delta.confidence * 2 +
    delta.score * 0.35 +
    delta.priceChangeM5 +
    delta.priceChangeH24 * 0.25 +
    delta.volumeM5 / 25_000 +
    delta.pressure / 10_000 +
    delta.liquidityUsd / 100_000 +
    delta.buysM5 * 0.15 -
    delta.sellsM5 * 0.15
  );
}

function cueMagnitude(delta: SideDelta) {
  return Math.max(
    Math.abs(delta.confidence),
    Math.abs(delta.score) / 5,
    Math.abs(delta.priceChangeM5),
    Math.abs(delta.priceChangeH24) / 2,
    Math.abs(delta.volumeM5) / 10_000,
    Math.abs(delta.pressure) / 5_000,
    Math.abs(delta.liquidityUsd) / 50_000,
    Math.abs(delta.buysM5) + Math.abs(delta.sellsM5),
  );
}

export function deriveArenaGuiCue(previous: AgentBattle | null | undefined, current: AgentBattle): ArenaGuiCue | null {
  if (!previous || previous.id !== current.id) return deriveArenaGuiEventCue(current);

  const comparableSides = getComparableSides(previous, current);
  if (comparableSides.length < 2) return deriveArenaGuiEventCue(current);

  const deltas = comparableSides.map(({ previousSide, side }) => calculateSideDelta(previousSide, side));
  const ranked = [...deltas].sort((a, b) => Math.abs(deltaStrength(b)) - Math.abs(deltaStrength(a)));
  const leadingDelta = ranked[0];
  if (!leadingDelta || cueMagnitude(leadingDelta) < 0.5) return deriveArenaGuiEventCue(current);

  const otherSide = current.sides.find((side) => side.id !== leadingDelta.side.id);
  if (!otherSide) return null;

  const strength = deltaStrength(leadingDelta);
  const gainedGround = strength >= 0;
  const attackerSideId = gainedGround ? leadingDelta.side.id : otherSide.id;
  const defenderSideId = gainedGround ? otherSide.id : leadingDelta.side.id;
  const attacker = current.sides.find((side) => side.id === attackerSideId);
  const defender = current.sides.find((side) => side.id === defenderSideId);

  if (!attacker || !defender) return null;

  return {
    kind: chooseCueKind(leadingDelta),
    severity: gainedGround ? 'hot' : 'danger',
    attackerSideId,
    defenderSideId,
    delta: strength,
    source: 'battle-delta',
    message: `${sideTokenLabel(attacker)} gained live battle pressure against ${sideTokenLabel(defender)}.`,
  };
}

export function deriveArenaGuiEventCue(battle: AgentBattle): ArenaGuiCue | null {
  const latestEvent = battle.events[0];
  if (!latestEvent?.sideId) return null;

  const attacker = battle.sides.find((side) => side.id === latestEvent.sideId);
  const defender = battle.sides.find((side) => side.id !== latestEvent.sideId);
  if (!attacker || !defender) return null;

  return {
    kind: 'event',
    severity: latestEvent.severity,
    attackerSideId: attacker.id,
    defenderSideId: defender.id,
    delta: 0,
    source: 'battle-event',
    message: latestEvent.message,
  };
}
