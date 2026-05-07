'use client';

import { ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import type { AgentBattleFeed, AgentBattleSide } from '@/types/agentBattle';

function formatTime(value?: string) {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function sideTone(side: AgentBattleSide, index: number) {
  if (side.status === 'staggered') {
    return {
      border: 'border-destructive',
      bg: 'bg-destructive/10',
      text: 'text-destructive',
      bar: 'bg-destructive',
    };
  }

  if (side.status === 'attacking') {
    return {
      border: 'border-secondary',
      bg: 'bg-secondary/10',
      text: 'text-secondary',
      bar: 'bg-secondary',
    };
  }

  return index === 0
    ? {
        border: 'border-primary',
        bg: 'bg-primary/10',
        text: 'text-primary',
        bar: 'bg-primary',
      }
    : {
        border: 'border-accent',
        bg: 'bg-accent/10',
        text: 'text-accent',
        bar: 'bg-accent',
      };
}

function BattleSideMini({ side, index }: { side: AgentBattleSide; index: number }) {
  const tone = sideTone(side, index);

  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <div className={`w-11 h-11 rounded-full ${tone.bg} border-2 ${tone.border} flex items-center justify-center text-2xl mb-1`}>
        {side.emoji}
      </div>
      <span className="text-xs font-bold text-foreground truncate max-w-full">{side.label}</span>
      <span className={`text-lg font-mono font-bold ${tone.text}`}>{side.confidence}%</span>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
        <div className={`h-full ${tone.bar} transition-all duration-700`} style={{ width: `${side.confidence}%` }} />
      </div>
      <span className="mt-1 text-[10px] text-muted-foreground font-mono">{side.change}</span>
    </div>
  );
}

export default function AgentBattle({ onViewBattle }: { onViewBattle?: () => void }) {
  const { data, isLoading, isError } = useQuery<AgentBattleFeed>({
    queryKey: ['/api/bantahbro/agent-battles/live', { limit: '1' }],
    staleTime: 3_000,
    refetchInterval: 5_000,
  });

  const battle = data?.battles?.[0];

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="border-b border-border bg-background px-3 py-2 flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="px-3 py-3 flex items-center justify-around">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-6 w-10" />
          </div>
          <Skeleton className="w-6 h-6 rounded" />
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-6 w-10" />
          </div>
        </div>
        <div className="px-3 pb-2 space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-3 w-full" />)}
        </div>
      </div>
    );
  }

  if (isError || !battle) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="border-b border-border bg-background px-3 py-2 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-foreground tracking-wider">AGENT BATTLE</span>
          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-bold">WAITING</span>
        </div>
        <div className="flex-1 grid place-items-center px-3 text-center">
          <div>
            <div className="text-sm font-bold text-foreground mb-1">No live battle feed yet</div>
            <div className="text-xs text-muted-foreground">
              Waiting for enough live Dexscreener tokens to pair into an Agent Battle.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [left, right] = battle.sides;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b border-border bg-background px-3 py-2 flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-foreground tracking-wider">AGENT BATTLE</span>
        <span className="text-xs bg-destructive text-white px-1.5 py-0.5 rounded font-bold animate-pulse">LIVE</span>
      </div>

      <div className="px-3 py-2.5 border-b border-border bg-background shrink-0">
        <div className="text-xs font-bold text-center text-foreground mb-2 truncate">{battle.title}</div>
        <div className="flex items-center justify-between gap-2">
          <BattleSideMini side={left} index={0} />
          <div className="flex flex-col items-center shrink-0">
            <div className="text-base font-black text-primary">VS</div>
            <div className="text-[10px] font-bold text-muted-foreground">{battle.timeRemainingSeconds}s</div>
          </div>
          <BattleSideMini side={right} index={1} />
        </div>

        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden flex">
          <div className="bg-secondary transition-all duration-700" style={{ width: `${left.confidence}%` }} />
          <div className="bg-destructive transition-all duration-700" style={{ width: `${right.confidence}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
          <span className="text-secondary font-bold">{left.label}</span>
          <span>Live score</span>
          <span className="text-destructive font-bold">{right.label}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-3 py-2 space-y-1.5">
        {battle.events.slice(0, 3).map((item) => (
          <div key={item.id} className="flex gap-1.5 text-xs">
            <span className={item.severity === 'danger' ? 'text-destructive font-bold shrink-0' : item.severity === 'hot' ? 'text-secondary font-bold shrink-0' : 'text-primary font-bold shrink-0'}>
              {item.agentName}
            </span>
            <span className="text-muted-foreground flex-1 leading-snug">{item.message}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-border bg-background px-3 py-2 shrink-0">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span>{battle.spectators.toLocaleString()} watching</span>
          <span>Updated {formatTime(battle.updatedAt)}</span>
        </div>
        <button
          onClick={onViewBattle}
          className="w-full text-xs font-bold text-primary hover:text-primary/80 transition flex items-center justify-center gap-1"
        >
          View full battle <ExternalLink size={10} />
        </button>
      </div>
    </div>
  );
}
