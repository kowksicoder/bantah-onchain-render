'use client';

import { ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { arenaAgentAvatar } from '@/lib/arenaAgentAvatars';
import { getBattleTimeRemainingSeconds, useBattleClock } from '@/lib/bantahbro/battleTiming';
import type { AgentBattleFeed } from '@/types/agentBattle';

type SidebarArenaSide = {
  label: string;
  tag: string;
  avatar: string;
  tone: 'blue' | 'purple';
};

type SidebarArenaBattle = {
  sourceBattleId?: string;
  title: string;
  arena: string;
  meta: string;
  statusLabel: string;
  left: SidebarArenaSide;
  right: SidebarArenaSide;
  spectators: number;
  updatedAt?: string;
  events: Array<{
    id: string;
    agentName: string;
    message: string;
    tone: 'primary' | 'secondary' | 'muted';
  }>;
};

function formatTime(value?: string) {
  if (!value) return 'now';
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
}

function currentLiveBattle(feed: AgentBattleFeed | undefined) {
  return (feed?.battles || []).find(
    (entry) => getBattleTimeRemainingSeconds(entry.endsAt, entry.timeRemainingSeconds) > 0,
  );
}

function sidebarSideName(side: AgentBattleFeed['battles'][number]['sides'][number] | undefined, fallback: string) {
  return side?.agentName || side?.tokenName || side?.label || fallback;
}

function sidebarSideTag(side: AgentBattleFeed['battles'][number]['sides'][number] | undefined, fallback: string) {
  return side?.label || side?.tokenSymbol || side?.chainLabel || fallback;
}

function sidebarSideAvatar(side: AgentBattleFeed['battles'][number]['sides'][number] | undefined, fallbackSeed: string) {
  return arenaAgentAvatar(side ? `${side.agentName}:${side.id}` : fallbackSeed);
}

function buildSidebarArenaBattle(
  feed: AgentBattleFeed | undefined,
  timeRemainingSeconds: number,
): SidebarArenaBattle {
  const liveBattle = currentLiveBattle(feed);
  const leftSide = liveBattle?.sides?.[0];
  const rightSide = liveBattle?.sides?.[1];
  const leftLabel = sidebarSideName(leftSide, 'BOTA Agent Alpha');
  const rightLabel = sidebarSideName(rightSide, 'BOTA Agent Beta');

  return {
    sourceBattleId: liveBattle?.id,
    title: `${leftLabel} vs ${rightLabel}`,
    arena: 'Main Arena',
    meta: liveBattle ? formatCountdown(timeRemainingSeconds) : 'Open',
    statusLabel: liveBattle ? 'LIVE' : 'ARENA',
    left: {
      label: leftLabel,
      tag: sidebarSideTag(leftSide, 'Alpha'),
      avatar: sidebarSideAvatar(leftSide, 'sidebar-arena:left'),
      tone: 'blue',
    },
    right: {
      label: rightLabel,
      tag: sidebarSideTag(rightSide, 'Beta'),
      avatar: sidebarSideAvatar(rightSide, 'sidebar-arena:right'),
      tone: 'purple',
    },
    spectators: liveBattle?.spectators || 1208,
    updatedAt: liveBattle?.updatedAt,
    events: [
      {
        id: 'arena-live',
        agentName: 'Arena',
        message: `${leftLabel} and ${rightLabel} are active in the main arena.`,
        tone: 'primary',
      },
      {
        id: 'arena-queue',
        agentName: 'Queue',
        message: 'Frostline and Glacier Ring are warming up next.',
        tone: 'secondary',
      },
      {
        id: 'arena-stake',
        agentName: 'BXBT',
        message: 'Battle stakes open from the Arena page.',
        tone: 'muted',
      },
    ],
  };
}

function sideTone(side: SidebarArenaSide) {
  return side.tone === 'blue'
    ? {
        border: 'border-sky-300/70',
        bg: 'bg-sky-400/10',
        text: 'text-sky-200',
        badge: 'bg-sky-400/15 border-sky-300/35 text-sky-100',
      }
    : {
        border: 'border-violet-300/70',
        bg: 'bg-violet-400/10',
        text: 'text-violet-200',
        badge: 'bg-violet-400/15 border-violet-300/35 text-violet-100',
      };
}

function ArenaSideMini({ side }: { side: SidebarArenaSide }) {
  const tone = sideTone(side);

  return (
    <div className="flex flex-1 min-w-0 flex-col items-center">
      <div className={`mb-1 flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border-2 ${tone.border} ${tone.bg} p-0.5`}>
        <img
          src={side.avatar}
          alt={`${side.label} fighter`}
          className="h-full w-full rounded object-cover"
          loading="lazy"
        />
      </div>
      <span className="max-w-full truncate text-xs font-black text-foreground">{side.label}</span>
      <span className={`mt-1 rounded border px-1.5 py-0.5 text-[10px] font-black uppercase ${tone.badge}`}>
        {side.tag}
      </span>
    </div>
  );
}

export default function AgentBattle({ onViewBattle }: { onViewBattle?: (battleId: string) => void }) {
  const { data } = useQuery<AgentBattleFeed>({
    queryKey: ['/api/bantahbro/agent-battles/live', { limit: '3' }],
    staleTime: 3_000,
    refetchInterval: 15_000,
    retry: 3,
    retryDelay: 1_500,
    placeholderData: (previousData) => previousData,
  });

  const liveBattle = currentLiveBattle(data);
  const { timeRemainingSeconds, isExpired } = useBattleClock({
    startsAt: liveBattle?.startsAt,
    endsAt: liveBattle?.endsAt,
    fallbackSeconds: liveBattle?.timeRemainingSeconds,
  });
  const battle = buildSidebarArenaBattle(data, timeRemainingSeconds);
  const canOpenArena = !battle.sourceBattleId || !isExpired;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-3 py-2">
        <span className="text-xs font-bold tracking-wider text-foreground">ARENA BATTLE</span>
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-bold ${
            isExpired && battle.sourceBattleId
              ? 'bg-muted text-muted-foreground'
              : 'bg-destructive text-white animate-pulse'
          }`}
        >
          {isExpired && battle.sourceBattleId ? 'QUEUE' : battle.statusLabel}
        </span>
      </div>

      <div className="shrink-0 border-b border-border bg-background px-3 py-2.5">
        <div className="mb-2 truncate text-center text-xs font-bold text-foreground">{battle.title}</div>
        <div className="flex items-center justify-between gap-2">
          <ArenaSideMini side={battle.left} />
          <div className="flex shrink-0 flex-col items-center">
            <div className="text-base font-black text-primary">VS</div>
            <div className="text-[10px] font-bold text-muted-foreground">{battle.meta}</div>
          </div>
          <ArenaSideMini side={battle.right} />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
          <div className="truncate rounded border border-border bg-card px-2 py-1 text-center">{battle.arena}</div>
          <div className="truncate rounded border border-border bg-card px-2 py-1 text-center">Agent Match</div>
        </div>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {battle.events.map((item) => (
          <div key={item.id} className="flex gap-1.5 text-xs">
            <span
              className={
                item.tone === 'secondary'
                  ? 'shrink-0 font-bold text-secondary'
                  : item.tone === 'muted'
                    ? 'shrink-0 font-bold text-muted-foreground'
                    : 'shrink-0 font-bold text-primary'
              }
            >
              {item.agentName}
            </span>
            <span className="flex-1 leading-snug text-muted-foreground">{item.message}</span>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-border bg-background px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{battle.spectators.toLocaleString()} watching</span>
          <span>Updated {formatTime(battle.updatedAt)}</span>
        </div>
        <button
          onClick={() => {
            if (!canOpenArena) return;
            onViewBattle?.(battle.sourceBattleId || '');
          }}
          disabled={!canOpenArena}
          className={`flex w-full items-center justify-center gap-1 text-xs font-bold transition ${
            canOpenArena
              ? 'text-primary hover:text-primary/80'
              : 'cursor-not-allowed text-muted-foreground'
          }`}
        >
          Open arena <ExternalLink size={10} />
        </button>
      </div>
    </div>
  );
}
