'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  Flame,
  Swords,
  Timer,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { arenaAgentAvatar } from '@/lib/arenaAgentAvatars';
import { getBattleTimeRemainingSeconds } from '@/lib/bantahbro/battleTiming';
import type { AppSection } from '@/app/page';
import type { AgentBattle, AgentBattleFeed, AgentBattleSide } from '@/types/agentBattle';

type ChallengeTab = 'open' | 'live' | 'callouts' | 'friends' | 'mine';
type ChallengeFilter = 'all' | 'agent-battles' | 'callouts' | 'high-stakes' | 'ending-soon' | 'live';

interface ChallengePageProps {
  onNavigate?: (section: AppSection) => void;
  onOpenBattle?: (battleId: string) => void;
}

type BantCreditStatsResponse = {
  token: 'BantCredit';
  lifetimeEarned: number;
  currentAggregate: number;
  currentUserPoints: number;
  currentAgentPoints: number;
  earnedFromTransactions: number;
  userCount: number;
  agentCount: number;
  rewardTransactionCount: number;
  basis: string;
  updatedAt: string;
};

const tabs: Array<{ id: ChallengeTab; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'live', label: 'Live' },
  { id: 'callouts', label: 'Call-Outs' },
  { id: 'friends', label: 'Friends' },
  { id: 'mine', label: 'My Challenges' },
];

const filters: Array<{ id: ChallengeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'agent-battles', label: 'Agent Battles' },
  { id: 'callouts', label: 'Call-Outs' },
  { id: 'high-stakes', label: 'High Stakes' },
  { id: 'ending-soon', label: 'Ending Soon' },
  { id: 'live', label: 'Live' },
];

function formatCompactNumber(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return '0';
  return new Intl.NumberFormat('en', {
    notation: Number(value) >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: Number(value) >= 10000 ? 1 : 0,
  }).format(Number(value));
}

function formatUsd(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN) || Number(value) <= 0) return '$0';
  return `$${new Intl.NumberFormat('en', {
    notation: Number(value) >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: Number(value) >= 10000 ? 1 : 0,
  }).format(Number(value))}`;
}

function formatSignedPercent(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return '0%';
  const numeric = Number(value);
  return `${numeric > 0 ? '+' : ''}${numeric.toLocaleString(undefined, { maximumFractionDigits: Math.abs(numeric) >= 10 ? 0 : 1 })}%`;
}

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function battleTimeRemaining(battle: AgentBattle) {
  return getBattleTimeRemainingSeconds(battle.endsAt, battle.timeRemainingSeconds);
}

function battleVolume(battle: AgentBattle) {
  return battle.sides.reduce((total, side) => total + Number(side.volumeH24 || 0), 0);
}

function battleLiquidity(battle: AgentBattle) {
  return battle.sides.reduce((total, side) => total + Number(side.liquidityUsd || 0), 0);
}

function leadingSide(battle: AgentBattle) {
  return battle.sides.find((side) => side.id === battle.leadingSideId) || battle.sides[0];
}

function trailingSide(battle: AgentBattle) {
  const leader = leadingSide(battle);
  return battle.sides.find((side) => side.id !== leader.id) || battle.sides[1] || leader;
}

function sideImage(side: AgentBattleSide, className: string) {
  return (
    <img
      src={arenaAgentAvatar(`${side.agentName}:${side.id}`)}
      alt={`${side.agentName || side.label} avatar`}
      className={className}
      loading="lazy"
    />
  );
}

function challengeQuestion(battle: AgentBattle) {
  const leader = leadingSide(battle);
  return `Will ${leader.agentName} hold the lead?`;
}

function matchesFilter(battle: AgentBattle, filter: ChallengeFilter) {
  if (filter === 'all' || filter === 'agent-battles') return true;
  if (filter === 'live') return battle.status === 'live';
  if (filter === 'ending-soon') return battleTimeRemaining(battle) <= 120;
  if (filter === 'high-stakes') return battleVolume(battle) >= 500000;
  return false;
}

function EmptyState({ tab }: { tab: ChallengeTab }) {
  const copy =
    tab === 'callouts'
      ? 'No direct call-outs are loaded yet.'
      : tab === 'friends'
        ? 'Friend challenges will appear here.'
        : tab === 'mine'
          ? 'Your challenge slips will appear here after you join.'
          : 'No live challenge cards are available right now.';

  return (
    <div className="rounded border border-dashed border-border bg-card p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded bg-primary/10 text-primary">
        <Swords size={18} />
      </div>
      <div className="text-sm font-black text-foreground">No cards yet</div>
      <div className="mt-1 text-xs text-muted-foreground">{copy}</div>
    </div>
  );
}

function FeaturedChallenge({
  battle,
  onOpenBattle,
}: {
  battle: AgentBattle | null;
  onOpenBattle?: (battleId: string) => void;
}) {
  if (!battle) {
    return (
      <div className="rounded border border-border bg-card p-4">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const left = battle.sides[0];
  const right = battle.sides[1];
  const leader = leadingSide(battle);

  return (
    <section className="overflow-hidden rounded border border-primary/30 bg-card">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_15rem]">
        <button
          type="button"
          onClick={() => onOpenBattle?.(battle.id)}
          className="group min-w-0 p-2 text-left transition hover:bg-primary/5 sm:p-3"
        >
          <div className="mb-1.5 flex items-center gap-2 sm:mb-2">
            <span className="inline-flex items-center gap-1 rounded bg-destructive px-1.5 py-0.5 text-[9px] font-black uppercase text-white sm:px-2 sm:py-1 sm:text-[10px]">
              <Flame size={10} className="sm:h-3 sm:w-3" /> Trending Challenge
            </span>
            <span className="text-[10px] font-bold text-muted-foreground sm:text-xs">{formatCountdown(battleTimeRemaining(battle))} left</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-2">
            <AgentPosterLite side={left} align="left" />
            <div className="rounded border border-border bg-background px-2 py-1 text-xs font-black text-primary sm:px-3 sm:text-sm">VS</div>
            <AgentPosterLite side={right} align="right" />
          </div>
          <div className="mt-1 truncate text-[11px] font-black text-foreground sm:mt-2 sm:text-sm">{challengeQuestion(battle)}</div>
          <div className="mt-0.5 hidden text-[11px] text-muted-foreground sm:line-clamp-1 sm:text-xs">
            {leader.agentName} leads {leader.confidence}% with {formatUsd(battleVolume(battle))} in live volume.
          </div>
        </button>
        <div className="border-t border-border bg-muted/20 p-1 sm:p-2 lg:border-l lg:border-t-0 lg:p-3">
          <div className="flex items-center gap-1.5 sm:block">
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 text-[9px] font-black text-foreground sm:hidden">
              <span className="truncate rounded border border-border bg-background px-1.5 py-1">{formatUsd(battleVolume(battle))}</span>
              <span className="truncate rounded border border-border bg-background px-1.5 py-1">{formatCompactNumber(battle.spectators)}</span>
              <span className="truncate rounded border border-border bg-background px-1.5 py-1">{battle.confidenceSpread}% gap</span>
            </div>
            <div className="hidden grid-cols-4 gap-1 text-xs sm:grid lg:grid-cols-2 lg:gap-2">
              <MiniMetric label="Volume" value={formatUsd(battleVolume(battle))} compact />
              <MiniMetric label="Participants" value={formatCompactNumber(battle.spectators)} compact />
              <MiniMetric label="Liquidity" value={formatUsd(battleLiquidity(battle))} compact />
              <MiniMetric label="Gap" value={`${battle.confidenceSpread}%`} compact />
            </div>
            <button
              type="button"
              onClick={() => onOpenBattle?.(battle.id)}
              className="flex shrink-0 items-center justify-center gap-1 rounded bg-primary px-2 py-1 text-[9px] font-black text-primary-foreground transition hover:opacity-90 sm:mt-2 sm:w-full sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs"
            >
              <span className="sm:hidden">View</span>
              <span className="hidden sm:inline">View Challenge</span>
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function AgentPosterLite({ side, align }: { side: AgentBattleSide; align: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 items-center gap-1.5 sm:block ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <div className={`flex shrink-0 ${align === 'right' ? 'justify-end' : 'justify-start'} sm:mb-1.5`}>
        {sideImage(side, 'h-6 w-6 rounded border border-border bg-muted object-cover sm:h-12 sm:w-12 lg:h-14 lg:w-14')}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-black text-foreground sm:text-sm">{side.agentName}</div>
        <div className="hidden truncate text-[10px] font-bold text-primary sm:block sm:text-xs">{side.label}</div>
        <div className="mt-0.5 hidden truncate text-[9px] text-muted-foreground sm:block sm:text-[10px]">
          Rank #{Math.max(1, Math.round(100 - side.score / 2))} | {formatSignedPercent(side.priceChangeH24)}
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded border border-border bg-background ${compact ? 'p-1.5' : 'p-2'}`}>
      <div className={`${compact ? 'text-[8px]' : 'text-[10px]'} truncate font-bold uppercase tracking-wide text-muted-foreground`}>{label}</div>
      <div className={`${compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-sm'} truncate font-black text-foreground`}>{value}</div>
    </div>
  );
}

function ChallengeCard({
  battle,
  onOpenBattle,
}: {
  battle: AgentBattle;
  onOpenBattle?: (battleId: string) => void;
}) {
  const left = battle.sides[0];
  const right = battle.sides[1];
  const leader = leadingSide(battle);
  const trailer = trailingSide(battle);
  const seconds = battleTimeRemaining(battle);

  return (
    <article className="overflow-hidden rounded border border-border bg-card transition hover:border-primary/50">
      <button type="button" onClick={() => onOpenBattle?.(battle.id)} className="block w-full p-1.5 text-left sm:p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded bg-destructive/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-destructive sm:text-[10px]">
            <Swords size={10} /> LIVE
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground sm:text-[10px]">
            <Timer size={10} /> {formatCountdown(seconds)}
          </span>
        </div>

        <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
          <FighterFace side={left} />
          <div className="rounded border border-border bg-background px-1.5 py-0.5 text-center text-[10px] font-black text-primary">VS</div>
          <FighterFace side={right} align="right" />
        </div>

        <div className="hidden truncate text-[11px] font-black text-foreground sm:mt-1.5 sm:block sm:text-xs">
          {challengeQuestion(battle)}
        </div>

        <div className="mt-1.5 flex h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-emerald-500" style={{ width: `${Math.max(4, Math.min(96, leader.confidence))}%` }} />
          <div className="h-full flex-1 bg-rose-500" />
        </div>

        <div className="mt-1.5 grid grid-cols-[auto_auto_1fr_1fr] items-center gap-1 text-[9px] font-black sm:text-[10px]">
          <span className="rounded bg-emerald-500 px-1.5 py-1 text-center text-white">YES {leader.confidence}%</span>
          <span className="rounded bg-rose-500 px-1.5 py-1 text-center text-white">NO {trailer.confidence}%</span>
          <span className="truncate rounded bg-background px-1.5 py-1 text-center text-muted-foreground">{formatCompactNumber(battle.spectators)}</span>
          <span className="truncate rounded bg-background px-1.5 py-1 text-center text-muted-foreground">{formatUsd(battleVolume(battle))}</span>
        </div>
      </button>
    </article>
  );
}

function LiveAgentCell({ side }: { side: AgentBattleSide }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {sideImage(side, 'h-8 w-8 shrink-0 rounded border border-border bg-muted object-cover')}
      <div className="min-w-0">
        <div className="truncate text-xs font-black text-foreground">{side.agentName}</div>
        <div className="truncate text-[10px] font-bold text-muted-foreground">{side.label}</div>
      </div>
    </div>
  );
}

function ConfidenceCell({ side, tone }: { side: AgentBattleSide; tone: 'left' | 'right' }) {
  const barClass = tone === 'left' ? 'bg-emerald-500' : 'bg-rose-500';

  return (
    <div className="min-w-[7rem]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-bold text-muted-foreground">{side.label}</span>
        <span className="text-xs font-black text-foreground">{side.confidence}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.max(4, Math.min(100, side.confidence))}%` }} />
      </div>
    </div>
  );
}

function LiveBattleTable({
  battles,
  onOpenBattle,
}: {
  battles: AgentBattle[];
  onOpenBattle?: (battleId: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded border border-border bg-card">
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[860px] border-collapse text-left text-xs">
          <thead className="border-b border-border bg-muted/30 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-3">#</th>
              <th className="px-3 py-3">Live Battle</th>
              <th className="px-3 py-3">Timer</th>
              <th className="px-3 py-3">Volume</th>
              <th className="px-3 py-3">Watching</th>
              <th className="px-3 py-3">Leader</th>
              <th className="px-3 py-3">Left</th>
              <th className="px-3 py-3">Right</th>
              <th className="px-3 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {battles.map((battle, index) => {
              const left = battle.sides[0];
              const right = battle.sides[1];
              const leader = leadingSide(battle);
              const seconds = battleTimeRemaining(battle);

              return (
                <tr key={battle.id} className="border-b border-border/70 transition last:border-b-0 hover:bg-primary/5">
                  <td className="px-3 py-3 align-middle text-sm font-black text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-3 align-middle">
                    <div className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <LiveAgentCell side={left} />
                      <span className="rounded bg-background px-2 py-1 text-[10px] font-black text-primary">VS</span>
                      <LiveAgentCell side={right} />
                    </div>
                    <div className="mt-1 truncate text-[10px] font-bold text-muted-foreground">{challengeQuestion(battle)}</div>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <span className="inline-flex items-center gap-1 rounded bg-background px-2 py-1 font-black text-foreground">
                      <Timer size={11} /> {formatCountdown(seconds)}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-middle font-black text-foreground">{formatUsd(battleVolume(battle))}</td>
                  <td className="px-3 py-3 align-middle font-black text-foreground">{formatCompactNumber(battle.spectators)}</td>
                  <td className="px-3 py-3 align-middle">
                    <div className="truncate font-black text-foreground">{leader.agentName}</div>
                    <div className="text-[10px] font-bold text-primary">{leader.confidence}% confidence</div>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <ConfidenceCell side={left} tone="left" />
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <ConfidenceCell side={right} tone="right" />
                  </td>
                  <td className="px-3 py-3 text-right align-middle">
                    <button
                      type="button"
                      onClick={() => onOpenBattle?.(battle.id)}
                      className="rounded bg-primary px-3 py-2 text-[10px] font-black text-primary-foreground transition hover:opacity-90"
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FighterFace({ side, align = 'left' }: { side: AgentBattleSide; align?: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <div className="shrink-0">
        {sideImage(side, 'h-6 w-6 rounded border border-border bg-muted object-cover sm:h-7 sm:w-7')}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[10px] font-black text-foreground sm:text-[11px]">{side.agentName}</div>
        <div className="hidden truncate text-[10px] font-bold text-primary sm:block">{side.label}</div>
      </div>
    </div>
  );
}

function MyChallengesPanel({
  battles,
  bantCreditStats,
  isLoading = false,
  isBantCreditLoading = false,
}: {
  battles: AgentBattle[];
  bantCreditStats?: BantCreditStatsResponse | null;
  isLoading?: boolean;
  isBantCreditLoading?: boolean;
}) {
  const liveCount = battles.filter((battle) => battle.status === 'live').length;
  const watched = battles.reduce((total, battle) => total + battle.spectators, 0);
  const stats = [
    ['Open', '0'],
    ['Live', String(liveCount)],
    ['Won', '0'],
    ['Lost', '0'],
    ['BantCredit', isBantCreditLoading ? '...' : formatCompactNumber(bantCreditStats?.currentAggregate || 0)],
    ['Watching', formatCompactNumber(watched)],
  ];

  return (
    <section className="shrink-0 rounded border border-border bg-card p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-foreground">
        <Trophy size={15} className="text-primary" /> My Challenges
      </div>
      <div className="space-y-2 text-xs">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-8 w-full" />)
          : stats.map(([label, value]) => <MyStat key={label} label={label} value={value} />)}
      </div>
    </section>
  );
}

function MyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded bg-background px-2 py-2">
      <span className="font-bold text-muted-foreground">{label}</span>
      <span className="font-black text-foreground">{value}</span>
    </div>
  );
}

function ChallengeStatsPanel({ battles, isLoading = false }: { battles: AgentBattle[]; isLoading?: boolean }) {
  const liveBattles = battles.filter((battle) => battle.status === 'live');
  const totalVolume = battles.reduce((total, battle) => total + battleVolume(battle), 0);
  const totalSpectators = battles.reduce((total, battle) => total + battle.spectators, 0);
  const stats: Array<{ icon: typeof Swords; label: string; value: string }> = [
    { icon: Swords, label: 'Open Challenges', value: formatCompactNumber(battles.length) },
    { icon: Wallet, label: 'Battle Volume', value: formatUsd(totalVolume) },
    { icon: Flame, label: 'Live Battles', value: formatCompactNumber(liveBattles.length) },
    { icon: Users, label: 'Active Challengers', value: formatCompactNumber(totalSpectators) },
  ];

  return (
    <section className="shrink-0 rounded border border-border bg-card p-3">
      <div className="mb-3 text-sm font-black text-foreground">Challenge Stats</div>
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)
          : stats.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded bg-background px-2 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-primary/10 text-primary">
                    <Icon size={14} />
                  </span>
                  <span className="truncate text-xs font-bold text-muted-foreground">{label}</span>
                </span>
                <span className="shrink-0 text-sm font-black text-foreground">{value}</span>
              </div>
            ))}
      </div>
    </section>
  );
}

function ChallengeSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded border border-border bg-card p-4">
          <Skeleton className="mb-4 h-5 w-32" />
          <div className="grid grid-cols-3 items-center gap-2">
            <Skeleton className="h-20 rounded" />
            <Skeleton className="h-8 rounded" />
            <Skeleton className="h-20 rounded" />
          </div>
          <Skeleton className="mt-4 h-16 rounded" />
          <Skeleton className="mt-3 h-20 rounded" />
        </div>
      ))}
    </div>
  );
}

function LiveBattleTableSkeleton() {
  return (
    <div className="overflow-hidden rounded border border-border bg-card">
      <div className="space-y-0">
        <div className="grid grid-cols-[3rem_1.8fr_0.7fr_0.8fr_0.8fr_1fr] gap-3 border-b border-border bg-muted/30 px-3 py-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-3 w-full" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[3rem_1.8fr_0.7fr_0.8fr_0.8fr_1fr] gap-3 border-b border-border/70 px-3 py-3 last:border-b-0">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChallengePage({ onOpenBattle }: ChallengePageProps) {
  const [activeTab, setActiveTab] = useState<ChallengeTab>('open');
  const [activeFilter, setActiveFilter] = useState<ChallengeFilter>('all');
  const { data: battleFeed, isLoading, isError } = useQuery<AgentBattleFeed>({
    queryKey: ['/api/bantahbro/agent-battles/live', { limit: '18' }],
    staleTime: 3_000,
    refetchInterval: 15_000,
    retry: 2,
    placeholderData: (previousData) => previousData,
  });

  const battles = battleFeed?.battles || [];
  const liveBattles = battles.filter((battle) => battle.status === 'live');
  const featured = useMemo(
    () =>
      [...liveBattles].sort(
        (left, right) =>
          right.spectators + battleVolume(right) / 10000 + right.confidenceSpread -
          (left.spectators + battleVolume(left) / 10000 + left.confidenceSpread),
      )[0] || null,
    [liveBattles],
  );

  const visibleBattles = useMemo(() => {
    if (activeTab === 'callouts' || activeTab === 'friends' || activeTab === 'mine') return [];
    const tabBattles = activeTab === 'live' ? liveBattles : battles;
    return tabBattles.filter((battle) => matchesFilter(battle, activeFilter));
  }, [activeFilter, activeTab, battles, liveBattles]);

  const handleTabClick = (tab: ChallengeTab) => {
    setActiveTab(tab);
    if (tab === 'live') {
      setActiveFilter('live');
    } else if (tab === 'open' && activeFilter === 'live') {
      setActiveFilter('all');
    }
  };

  return (
    <main className="flex-1 overflow-hidden bg-background">
      <div className="flex h-full min-h-0 overflow-hidden p-2 sm:p-3">
        <div className="min-w-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="space-y-2 sm:space-y-3">
            <div className="rounded border border-border bg-card p-1.5">
              <div className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabClick(tab.id)}
                    className={`shrink-0 rounded px-2 py-1 text-[10px] font-black transition sm:px-2.5 sm:py-1.5 sm:text-xs ${
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-1">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold transition sm:px-2 sm:py-1 sm:text-[11px] ${
                    activeFilter === filter.id
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {activeTab !== 'live' && <FeaturedChallenge battle={featured} onOpenBattle={onOpenBattle} />}

            {isLoading ? (
              activeTab === 'live' ? <LiveBattleTableSkeleton /> : <ChallengeSkeletonGrid />
            ) : isError ? (
              <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                Challenge feed could not load.
              </div>
            ) : visibleBattles.length ? (
              activeTab === 'live' ? (
                <LiveBattleTable battles={visibleBattles} onOpenBattle={onOpenBattle} />
              ) : (
                <section className="grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-3">
                  {visibleBattles.map((battle) => (
                    <ChallengeCard key={battle.id} battle={battle} onOpenBattle={onOpenBattle} />
                  ))}
                </section>
              )
            ) : (
              <EmptyState tab={activeTab} />
            )}

          </div>
        </div>
      </div>
    </main>
  );
}

export function ChallengeRightSidebar() {
  const { data: battleFeed, isLoading } = useQuery<AgentBattleFeed>({
    queryKey: ['/api/bantahbro/agent-battles/live', { limit: '18' }],
    staleTime: 3_000,
    refetchInterval: 15_000,
    retry: 2,
    placeholderData: (previousData) => previousData,
  });
  const { data: bantCreditStats, isLoading: isBantCreditLoading } = useQuery<BantCreditStatsResponse>({
    queryKey: ['/api/bantahbro/stats/bantcredit'],
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 2,
    placeholderData: (previousData) => previousData,
  });
  const battles = battleFeed?.battles || [];

  return (
    <div className="flex w-full shrink-0 flex-col gap-2 overflow-hidden lg:w-72">
      <MyChallengesPanel
        battles={battles}
        bantCreditStats={bantCreditStats}
        isLoading={isLoading}
        isBantCreditLoading={isBantCreditLoading}
      />
      <ChallengeStatsPanel battles={battles} isLoading={isLoading} />
    </div>
  );
}
