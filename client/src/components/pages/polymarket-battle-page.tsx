'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';
import BattlesPage from '@/components/pages/battles-page';
import type { AgentBattleFeed, AgentBattleSide } from '@/types/agentBattle';
import type {
  PredictionVisualizationBattle,
  PredictionVisualizationEvent,
  PredictionVisualizationFeed,
  PredictionVisualizationSide,
} from '@shared/predictionVisualization';

function currentFiveMinuteRoundSeconds() {
  const elapsed = Math.floor(Date.now() / 1000) % 300;
  return Math.max(1, 300 - elapsed);
}

function confidenceEdge(side: PredictionVisualizationSide) {
  return Number((side.impliedProbability - 50).toFixed(2));
}

function formatPriceDisplay(side: PredictionVisualizationSide) {
  return side.priceDisplay || `${Math.round(side.price * 100)}¢`;
}

function mapPredictionSideToBattleSide(
  battle: PredictionVisualizationBattle,
  side: PredictionVisualizationSide,
  index: 0 | 1,
): AgentBattleSide {
  const confidence = Math.max(1, Math.min(99, side.confidence));
  const sourceShare = confidence / 100;
  const volumeShare = battle.volume > 0 ? battle.volume * sourceShare : 0;
  const liquidityShare = battle.liquidity > 0 ? battle.liquidity * sourceShare : 0;
  const edge = confidenceEdge(side);

  return {
    id: side.id,
    label: side.outcome === 'YES' ? 'YES' : 'NO',
    agentName: `${side.factionName} Agent`,
    tokenSymbol: side.outcome,
    tokenName: side.factionName,
    emoji: side.emoji || (index === 0 ? '🟢' : '🔴'),
    logoUrl: null,
    chainId: 'polymarket',
    chainLabel: 'Polymarket',
    tokenAddress: side.sourceTokenId,
    pairAddress: battle.sourceMarketId,
    pairUrl: battle.sourceMarketUrl,
    dexId: 'polymarket',
    priceUsd: side.price,
    priceDisplay: formatPriceDisplay(side),
    priceChangeM5: edge,
    priceChangeH1: edge,
    priceChangeH24: edge,
    change: `${edge > 0 ? '+' : ''}${edge.toFixed(Math.abs(edge) >= 10 ? 1 : 2)}%`,
    direction: edge > 0 ? 'up' : edge < 0 ? 'down' : 'flat',
    volumeM5: 0,
    volumeH1: 0,
    volumeH24: volumeShare,
    liquidityUsd: liquidityShare,
    marketCap: battle.volume,
    buysM5: 0,
    sellsM5: 0,
    buysH1: 0,
    sellsH1: 0,
    buysH24: 0,
    sellsH24: 0,
    pairAgeMinutes: null,
    dataSource: 'polymarket' as AgentBattleSide['dataSource'],
    dataUpdatedAt: battle.updatedAt,
    score: confidence,
    confidence,
    status: battle.leadingSideId === side.id ? 'attacking' : 'defending',
  };
}

function mapPredictionEvent(event: PredictionVisualizationEvent): AgentBattleFeed['battles'][number]['events'][number] {
  return {
    id: event.id,
    time: event.time,
    type: event.type === 'odds' ? 'momentum' : event.type,
    severity: event.type === 'odds' ? 'hot' : event.type === 'system' ? 'info' : 'info',
    sideId: event.sideId,
    agentName: event.agentName,
    message: event.message,
    metricLabel: event.metricLabel,
    metricValue: event.metricValue,
  };
}

function mapPredictionBattleToAgentBattle(battle: PredictionVisualizationBattle): AgentBattleFeed['battles'][number] {
  const left = mapPredictionSideToBattleSide(battle, battle.sides[0], 0);
  const right = mapPredictionSideToBattleSide(battle, battle.sides[1], 1);
  const now = new Date();
  const roundSeconds = currentFiveMinuteRoundSeconds();

  return {
    id: battle.id,
    title: battle.title,
    battleType: 'agent-battle',
    status: 'live',
    winnerLogic: battle.winnerLogic,
    startsAt: now.toISOString(),
    endsAt: new Date(now.getTime() + roundSeconds * 1000).toISOString(),
    timeRemainingSeconds: roundSeconds,
    spectators: 0,
    sides: [left, right],
    leadingSideId: battle.leadingSideId,
    confidenceSpread: battle.confidenceSpread,
    events: battle.events.map(mapPredictionEvent),
    updatedAt: battle.updatedAt,
  };
}

export default function PolymarketBattlePage({ battleId }: { battleId: string }) {
  const [, setLocation] = useLocation();
  const decodedBattleId = useMemo(() => {
    try {
      return decodeURIComponent(battleId);
    } catch (_) {
      return battleId;
    }
  }, [battleId]);

  const { data, isLoading, isError } = useQuery<PredictionVisualizationFeed>({
    queryKey: ['/api/bantahbro/prediction-battles/live', { limit: '30' }],
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: 1_500,
    placeholderData: (previousData) => previousData,
  });

  const sourceBattle = data?.battles.find((item) => item.id === decodedBattleId) || null;
  const battle = sourceBattle ? mapPredictionBattleToAgentBattle(sourceBattle) : null;

  if (isLoading && !battle) {
    return (
      <div className="flex-1 flex gap-0.5 overflow-hidden">
        <div className="flex flex-1 flex-col gap-2 p-3">
          <Skeleton className="h-24 w-full rounded" />
          <Skeleton className="h-64 rounded" />
          <Skeleton className="h-48 rounded" />
        </div>
      </div>
    );
  }

  if (isError || !sourceBattle || !battle) {
    return (
      <div className="flex-1 grid place-items-center bg-card border border-border rounded">
        <div className="max-w-md px-4 text-center">
          <div className="mb-2 text-sm font-bold text-foreground">Polymarket battle is not in the live feed</div>
          <div className="text-xs leading-relaxed text-muted-foreground">
            No fallback or mock market is shown. Go back to the Polymarket tab and open one of the live rows.
          </div>
          <button
            type="button"
            onClick={() => setLocation('/bantahbro/polymarket')}
            className="bb-tap mt-4 inline-flex items-center gap-1 rounded bg-primary px-3 py-2 text-xs font-black text-primary-foreground"
          >
            <ArrowLeft size={13} />
            Back to Polymarket
          </button>
        </div>
      </div>
    );
  }

  return (
    <BattlesPage
      externalBattle={battle}
      externalExecutionUrl={sourceBattle.sourceMarketUrl}
      externalSourceLabel="Polymarket Battle"
      onExternalBack={() => setLocation('/bantahbro/polymarket')}
    />
  );
}
