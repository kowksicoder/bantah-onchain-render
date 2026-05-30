'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { arenaAgentAvatar } from '@/lib/arenaAgentAvatars';

interface LeaderboardEntry {
  id: string;
  source: 'onchain' | 'bantahbro';
  sourceLabel: string;
  rank: number;
  name: string;
  handle: string | null;
  score: number;
  wins: number;
  balance: number;
  balanceDisplay: string;
  points: number;
  coins: number;
  challengesWon: number;
  eventsWon: number;
  battleJoins?: number;
  liveBattles?: number;
  totalStake?: number;
  stakeDisplay?: string;
  currentBattleTitle?: string | null;
  activeSideLabel?: string | null;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  updatedAt: string;
  sources: {
    onchain: {
      available: boolean;
      active: boolean;
      count: number;
      url: string;
      message?: string;
    };
    bantahbro: {
      available: boolean;
      active: boolean;
      count: number;
      message?: string;
    };
  };
}

function avatarUrl(entry: LeaderboardEntry) {
  return arenaAgentAvatar(`${entry.name}:${entry.handle || entry.id}`);
}

function scoreLabel(entry: LeaderboardEntry) {
  return entry.coins > 0 ? `${entry.score} coins` : `${entry.score} pts`;
}

export default function LeaderboardPage() {
  const [sortMode, setSortMode] = useState<'score' | 'wins' | 'balance'>('score');
  const { data, isLoading } = useQuery<LeaderboardResponse>({
    queryKey: ['/api/bantahbro/leaderboard/live', { limit: '30' }],
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const ranked = [...(data?.entries || [])]
    .sort((left, right) => {
      if (sortMode === 'wins') return right.wins - left.wins || right.score - left.score;
      if (sortMode === 'balance') return right.balance - left.balance || right.score - left.score;
      return right.score - left.score || right.wins - left.wins;
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      badge: index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : null,
    }));

  const podiumEntries =
    ranked.length >= 3
      ? [ranked[1], ranked[0], ranked[2]].filter(Boolean)
      : ranked.slice(0, 3);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="flex-1 flex flex-col bg-card border border-border rounded overflow-hidden">
        <div className="border-b border-border bg-background px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={18} className="text-primary" />
            <span className="font-bold text-foreground">Leaderboard</span>
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase text-primary">
              Arena only
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-muted rounded overflow-hidden text-xs font-bold ml-auto">
              {([
                ['score', 'Top Score'],
                ['wins', 'Most Wins'],
                ['balance', 'Top Stake'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setSortMode(value)}
                  className={`px-3 py-1.5 transition ${sortMode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!isLoading && podiumEntries.length >= 3 && (
            <div className="border-b border-border bg-background/50 px-4 py-4">
              <div className="flex items-end justify-center gap-4">
                {podiumEntries.map((entry, index) => {
                  const heights = ['h-20', 'h-28', 'h-16'];
                  const positions = ['2nd', '1st', '3rd'];

                  return (
                    <div key={entry.id} className="flex flex-col items-center gap-1">
                      <img
                        src={avatarUrl(entry)}
                        alt={`${entry.name} avatar`}
                        className="h-10 w-10 rounded-full border border-primary/30 object-cover"
                        loading="lazy"
                      />
                      <div className="text-xs font-bold text-foreground">{entry.name}</div>
                      <div className="text-xs text-secondary font-mono">{scoreLabel(entry)}</div>
                      <div className={`${heights[index]} w-16 bg-primary/20 border border-primary/30 rounded-t flex items-center justify-center`}>
                        <span className="text-sm font-bold text-primary">{positions[index]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-12 px-4 py-2 text-xs font-bold text-muted-foreground bg-background border-b border-border">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Trader</div>
            <div className="col-span-2 text-center hidden sm:block">Battle</div>
            <div className="col-span-2 text-center hidden sm:block">Wins</div>
            <div className="col-span-3 text-right">{sortMode === 'balance' ? 'Stake' : 'Score'}</div>
          </div>

          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 p-2">
                  <Skeleton className="w-6 h-6 rounded" />
                  <Skeleton className="w-9 h-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ranked.map((entry) => (
                <div
                  key={entry.id}
                  className={`grid grid-cols-12 items-center px-4 py-3 hover:bg-muted/30 transition cursor-pointer ${entry.rank <= 3 ? 'bg-primary/5' : 'bg-background'}`}
                >
                  <div className="col-span-1">
                    {entry.badge ? (
                      <span className="text-xs font-black text-primary">{entry.badge}</span>
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">{entry.rank}</span>
                    )}
                  </div>
                  <div className="col-span-5 sm:col-span-4 flex items-center gap-2 min-w-0">
                    <img
                      src={avatarUrl(entry)}
                      alt={`${entry.name} avatar`}
                      className="w-9 h-9 rounded-full border border-border bg-muted object-cover shrink-0"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-foreground truncate">{entry.name}</span>
                        <span className="text-xs bg-primary/20 text-primary px-1 py-0.5 rounded font-bold shrink-0">
                          ARENA
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.handle || entry.activeSideLabel || entry.sourceLabel}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 text-center hidden sm:block">
                    <span className="text-xs font-bold text-secondary line-clamp-2">
                      {entry.currentBattleTitle || entry.sourceLabel}
                    </span>
                  </div>
                  <div className="col-span-2 text-center hidden sm:block">
                    <span className="text-sm font-mono text-muted-foreground">{entry.wins}</span>
                  </div>
                  <div className="col-span-6 sm:col-span-3 text-right">
                    <div className="text-sm font-mono font-bold text-secondary">
                      {sortMode === 'balance' ? (entry.stakeDisplay || entry.balanceDisplay) : scoreLabel(entry)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {entry.battleJoins ?? 0} battle joins - {entry.liveBattles ?? 0} live
                    </div>
                  </div>
                </div>
              ))}

              {ranked.length === 0 && (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  No Arena leaderboard entries yet. Join or stake in a current battle to appear here.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
