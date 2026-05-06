'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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

function sourceEmoji(source: LeaderboardEntry['source']) {
  return source === 'bantahbro' ? '🤖' : '◎';
}

function scoreLabel(entry: LeaderboardEntry) {
  return entry.coins > 0 ? `${entry.score} coins` : `${entry.score} pts`;
}

export default function LeaderboardPage() {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'onchain' | 'bantahbro'>('all');
  const [sortMode, setSortMode] = useState<'score' | 'wins' | 'balance'>('score');
  const { data, isLoading } = useQuery<LeaderboardResponse>({
    queryKey: ['/api/bantahbro/leaderboard/live', { limit: '30' }],
  });

  const filtered = (data?.entries || [])
    .filter((entry) => sourceFilter === 'all' || entry.source === sourceFilter)
    .sort((left, right) => {
      if (sortMode === 'wins') return right.wins - left.wins || right.score - left.score;
      if (sortMode === 'balance') return right.balance - left.balance || right.score - left.score;
      return right.score - left.score || right.wins - left.wins;
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      badge: index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : null,
    }));

  const podiumEntries =
    filtered.length >= 3
      ? [filtered[1], filtered[0], filtered[2]].filter(Boolean)
      : filtered.slice(0, 3);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="flex-1 flex flex-col bg-card border border-border rounded overflow-hidden">
        <div className="border-b border-border bg-background px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={18} className="text-primary" />
            <span className="font-bold text-foreground">Leaderboard</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-muted rounded overflow-hidden text-xs font-bold">
              {([
                ['all', '🌐 All Feeds'],
                ['onchain', '◎ Onchain'],
                ['bantahbro', '🤖 BantahBro'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setSourceFilter(value)}
                  className={`px-3 py-1.5 transition ${sourceFilter === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex bg-muted rounded overflow-hidden text-xs font-bold ml-auto">
              {([
                ['score', 'Top Score'],
                ['wins', 'Most Wins'],
                ['balance', 'Top Balance'],
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
          {!isLoading && (
            <div className="mt-2 text-xs text-muted-foreground">
              {data?.sources.onchain.count || 0} onchain entries and {data?.sources.bantahbro.count || 0} BantahBro entries merged into one board.
            </div>
          )}
        </div>

        {!isLoading && sourceFilter === 'all' && podiumEntries.length >= 3 && (
          <div className="border-b border-border bg-background/50 px-4 py-4">
            <div className="flex items-end justify-center gap-4">
              {podiumEntries.map((entry, index) => {
                const heights = ['h-20', 'h-28', 'h-16'];
                const positions = ['2nd', '1st', '3rd'];

                return (
                  <div key={entry.id} className="flex flex-col items-center gap-1">
                    <div className="text-2xl">{sourceEmoji(entry.source)}</div>
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

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-12 px-4 py-2 text-xs font-bold text-muted-foreground bg-background border-b border-border">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Trader</div>
            <div className="col-span-2 text-center hidden sm:block">Source</div>
            <div className="col-span-2 text-center hidden sm:block">Wins</div>
            <div className="col-span-3 text-right">{sortMode === 'balance' ? 'Balance' : 'Score'}</div>
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
              {filtered.map((entry) => (
                <div
                  key={entry.id}
                  className={`grid grid-cols-12 items-center px-4 py-3 hover:bg-muted/30 transition cursor-pointer ${entry.rank <= 3 ? 'bg-primary/5' : 'bg-background'}`}
                >
                  <div className="col-span-1">
                    {entry.badge ? (
                      <span className="text-base">{entry.badge}</span>
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">{entry.rank}</span>
                    )}
                  </div>
                  <div className="col-span-5 sm:col-span-4 flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-lg shrink-0">
                      {sourceEmoji(entry.source)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-foreground truncate">{entry.name}</span>
                        <span className="text-xs bg-primary/20 text-primary px-1 py-0.5 rounded font-bold shrink-0">
                          {entry.source === 'bantahbro' ? 'BB' : 'ON'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{entry.handle || entry.sourceLabel}</div>
                    </div>
                  </div>
                  <div className="col-span-2 text-center hidden sm:block">
                    <span className="text-sm font-mono font-bold text-secondary">{entry.sourceLabel}</span>
                  </div>
                  <div className="col-span-2 text-center hidden sm:block">
                    <span className="text-sm font-mono text-muted-foreground">{entry.wins}</span>
                  </div>
                  <div className="col-span-6 sm:col-span-3 text-right">
                    <div className="text-sm font-mono font-bold text-secondary">
                      {sortMode === 'balance' ? entry.balanceDisplay : scoreLabel(entry)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {entry.challengesWon} challenges • {entry.eventsWon} events
                    </div>
                  </div>
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  No leaderboard entries are available for this feed yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
