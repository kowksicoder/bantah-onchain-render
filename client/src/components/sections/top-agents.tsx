'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface Agent {
  rank: number;
  emoji: string;
  name: string;
  winRate: string;
  winAmount: string;
}

const TOP_AGENTS: Agent[] = [
  { rank: 1, emoji: '🐮', name: 'BullBot', winRate: '68.4%', winAmount: '+215.4 BXBT' },
  { rank: 2, emoji: '😊', name: 'BantahBro', winRate: '64.7%', winAmount: '+189.7 BXBT' },
  { rank: 3, emoji: '🎭', name: 'ChaosBot', winRate: '59.2%', winAmount: '+143.3 BXBT' },
];

export default function TopAgents() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-background px-2 py-1.5">
        <div className="text-sm font-bold text-foreground">TOP AGENTS (7D)</div>
      </div>

      {/* Agents List */}
      <div className="flex-1 overflow-y-auto bg-background">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border-b border-border px-2 py-2 flex items-center gap-2.5">
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="space-y-1 text-right">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))
          : TOP_AGENTS.map((agent, idx) => (
              <div
                key={agent.rank}
                className={`border-b border-border px-2 py-1.5 hover:bg-muted/30 transition text-sm ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="font-bold text-muted-foreground w-5 text-center text-sm">{agent.rank}</div>
                  <div className="text-2xl">{agent.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground">{agent.name}</div>
                  </div>
                  <div className="text-right flex flex-col gap-0.5">
                    <div className="text-sm font-mono font-bold text-secondary">{agent.winRate}</div>
                    <div className="text-sm font-mono text-secondary">{agent.winAmount}</div>
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-background px-2 py-1.5">
        <button className="text-sm text-accent hover:text-accent/80 font-bold w-full text-left">
          View leaderboard →
        </button>
      </div>
    </div>
  );
}
