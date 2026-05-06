'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface LiveMarketEntry {
  id: string;
  source: 'onchain' | 'telegram' | 'twitter' | 'agent';
  sourceLabel: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  createdAt: string;
  dueDate: string | null;
  tokenSymbol: string | null;
  chainId: string | number | null;
  chainKey: 'base' | 'arbitrum' | 'bsc' | null;
  chainLabel: string | null;
  chainLogoUrl: string | null;
  escrowLocked: boolean;
  escrowLockedDisplay: 'YES' | 'NO';
  escrowTxHash: string | null;
  poolAmount: number | null;
  poolDisplay: string;
  yesPercent: number;
  noPercent: number;
  yesDisplay: string;
  noDisplay: string;
  participantCount: number;
  commentCount: number;
  marketUrl: string | null;
  coverImageUrl: string | null;
  creatorName: string | null;
  isAgentMarket: boolean;
}

interface MarketsResponse {
  entries: LiveMarketEntry[];
  updatedAt: string;
  sources: {
    onchain: {
      available: boolean;
      active: boolean;
      count: number;
      url: string;
      message?: string;
    };
    telegram: {
      available: boolean;
      active: boolean;
      count: number;
      message?: string;
    };
    twitter: {
      available: boolean;
      active: boolean;
      count: number;
      message?: string;
    };
  };
}

const SIGNALS = [
  { id: '1', icon: '🎲', platform: 'Polymarket', traders: '2.1K traders', question: 'Will SOL hit $200 in May?', yes: 63, yesVol: '$780K', no: 37, noVol: '$460K', vol: '$1.2M' },
  { id: '2', icon: '🔮', platform: 'predict.fun', traders: '1.4K traders', question: 'Will Trump win the next election cycle?', yes: 55, yesVol: '$473K', no: 45, noVol: '$387K', vol: '$860K' },
  { id: '3', icon: '♾', platform: 'LIMITLESS', traders: '987 traders', question: 'Will AI agents outperform BTC this year?', yes: 61, yesVol: '$256K', no: 39, noVol: '$164K', vol: '$420K' },
];

function formatTimeRemaining(dueDate: string | null) {
  if (!dueDate) return 'No deadline';

  const delta = new Date(dueDate).getTime() - Date.now();
  if (Number.isNaN(delta)) return 'No deadline';
  if (delta <= 0) return 'Closing';

  const hours = Math.floor(delta / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days}d ${hours % 24}h`;

  const minutes = Math.floor((delta % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function marketEmoji(market: LiveMarketEntry) {
  const category = String(market.category || '').toLowerCase();
  if (market.source === 'telegram') return '✈';
  if (market.source === 'twitter') return '𝕏';
  if (market.isAgentMarket) return '🤖';
  if (category.includes('sport')) return '🏟';
  if (category.includes('politic')) return '🏛';
  if (category.includes('gaming')) return '🎮';
  if (category.includes('crypto')) return '◆';
  if (category.includes('trading')) return '📈';
  return '◎';
}

function marketLabel(market: LiveMarketEntry) {
  if (market.tokenSymbol) return market.tokenSymbol;
  if (market.category) return market.category.toUpperCase();
  return market.sourceLabel.toUpperCase();
}

function marketTags(market: LiveMarketEntry) {
  const tags = [market.sourceLabel];
  if (market.category) tags.push(market.category);
  return tags.slice(0, 3);
}

function sparklineData(market: LiveMarketEntry) {
  return Array.from({ length: 10 }, (_, index) => {
    const drift = index < 5 ? -1 : 1;
    return Math.max(3, Math.min(97, market.yesPercent + drift));
  });
}

function MiniSparkline({ data, bullish }: { data: number[]; bullish: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 28;
  const points = data
    .map((value, index) => `${(index / (data.length - 1)) * width},${height - ((value - min) / range) * height}`)
    .join(' ');
  const color = bullish ? '#22c55e' : '#ef4444';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function MarketsTable({ onSelectToken }: { onSelectToken: (token: string) => void }) {
  const [sortMode, setSortMode] = useState<'hot' | 'new' | 'volume'>('hot');
  const { data, isLoading } = useQuery<MarketsResponse>({
    queryKey: ['/api/bantahbro/markets', { limit: '36' }],
  });

  const markets = [...(data?.entries || [])].sort((left, right) => {
    if (sortMode === 'new') {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }

    if (sortMode === 'volume') {
      return (right.poolAmount || 0) - (left.poolAmount || 0);
    }

    const leftHot = (left.participantCount * 12) + (left.commentCount * 6) + (left.poolAmount || 0) + (left.isAgentMarket ? 40 : 0);
    const rightHot = (right.participantCount * 12) + (right.commentCount * 6) + (right.poolAmount || 0) + (right.isAgentMarket ? 40 : 0);
    return rightHot - leftHot;
  });

  const twitterNotice =
    data?.sources.twitter.count === 0 && data?.sources.twitter.message
      ? data.sources.twitter.message
      : null;
  const agentCount = markets.filter((market) => market.source === 'agent').length;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">🔥</span>
          <span className="text-sm font-bold text-foreground">BANTAH Onchain P2P Predictions</span>
        </div>
        <select
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as 'hot' | 'new' | 'volume')}
          className="bg-muted border border-border rounded px-2 py-1 text-xs text-foreground cursor-pointer"
        >
          <option value="hot">Sort: Hot</option>
          <option value="new">Sort: New</option>
          <option value="volume">Sort: Volume</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!isLoading && markets.length > 0 && (
          <div className="hidden md:flex items-center gap-2 lg:gap-3 px-3 py-1.5 border-b border-border bg-muted/30 text-xs font-bold text-muted-foreground uppercase tracking-wide">
            <span className="w-4 shrink-0 text-center">#</span>
            <span className="w-9 shrink-0">Art</span>
            <span className="flex-1 min-w-0">Market</span>
            <span className="min-w-[104px] shrink-0">Chains</span>
            <span className="hidden lg:block min-w-[96px] shrink-0 text-right">Pool</span>
            <span className="hidden lg:block min-w-[104px] shrink-0 text-center">Escrow locked</span>
            <span className="min-w-[60px] shrink-0 text-center">YES</span>
            <span className="min-w-[60px] shrink-0 text-center">NO</span>
            <span className="hidden lg:block w-[60px] shrink-0 text-center">Trend</span>
            <span className="w-[14px] shrink-0" />
          </div>
        )}

        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-3 py-2.5 border-b border-border">
                <Skeleton className="w-5 h-4 shrink-0" />
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Skeleton className="h-4 w-56" />
                  <div className="flex gap-1">
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-4 w-20 rounded" />
                  </div>
                </div>
                <div className="hidden md:flex gap-2 shrink-0">
                  <Skeleton className="h-10 w-20 rounded" />
                  <Skeleton className="h-10 w-20 rounded" />
                </div>
              </div>
            ))
          : markets.map((market, index) => (
              <div
                key={market.id}
                onClick={() => onSelectToken(market.tokenSymbol || marketLabel(market))}
                className="flex items-center gap-2 lg:gap-3 px-3 py-2 border-b border-border hover:bg-muted/40 cursor-pointer transition group"
              >
                <span className="text-xs font-bold text-muted-foreground w-4 shrink-0 text-center">{index + 1}</span>

                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xl shrink-0 border border-border overflow-hidden">
                  {market.coverImageUrl ? (
                    <img
                      src={market.coverImageUrl}
                      alt={`${market.title} cover art`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    marketEmoji(market)
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm sm:text-[15px] font-bold text-foreground leading-tight truncate">
                    {market.title}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 min-w-0 overflow-hidden">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-primary/90 shrink-0">
                      {marketLabel(market)}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                    <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                      {marketTags(market).map((tag) => (
                        <span
                          key={`${market.id}-${tag}`}
                          className="hidden sm:inline-block max-w-[5.5rem] truncate rounded border border-border bg-muted/50 px-1.5 py-0 text-[10px] leading-4 font-medium text-muted-foreground"
                          title={tag}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-1.5 min-w-[104px] shrink-0 text-xs text-muted-foreground">
                  {market.chainLogoUrl && (
                    <img
                      src={market.chainLogoUrl}
                      alt={market.chainLabel ? `${market.chainLabel} logo` : 'Chain logo'}
                      className="h-5 w-5 rounded-full object-contain"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <span className="truncate">{market.chainLabel || '-'}</span>
                </div>

                <div className="hidden lg:flex flex-col items-end shrink-0 text-xs font-mono">
                  <span className="text-foreground font-bold">{market.poolDisplay}</span>
                  <span className="text-muted-foreground">Ends {formatTimeRemaining(market.dueDate)}</span>
                </div>

                <div
                  className="hidden lg:flex flex-col items-center justify-center shrink-0 min-w-[104px] text-xs"
                  title={market.escrowTxHash ? `Escrow transaction: ${market.escrowTxHash}` : undefined}
                >
                  <span className={market.escrowLocked ? 'font-bold text-secondary' : 'font-bold text-destructive'}>
                    {market.escrowLockedDisplay}
                  </span>
                  <span className="text-muted-foreground">P2P escrow</span>
                </div>

                <div className="flex flex-col items-center bg-secondary/10 border border-secondary/30 rounded px-2 py-1.5 shrink-0 hover:bg-secondary/20 transition min-w-[60px]">
                  <span className="text-xs font-bold text-secondary">YES {market.yesPercent}%</span>
                  <span className="text-xs text-muted-foreground font-mono hidden sm:block">{market.yesDisplay}</span>
                </div>

                <div className="flex flex-col items-center bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5 shrink-0 hover:bg-destructive/20 transition min-w-[60px]">
                  <span className="text-xs font-bold text-destructive">NO {market.noPercent}%</span>
                  <span className="text-xs text-muted-foreground font-mono hidden sm:block">{market.noDisplay}</span>
                </div>

                <div className="hidden lg:block shrink-0">
                  <MiniSparkline data={sparklineData(market)} bullish={market.yesPercent >= market.noPercent} />
                </div>

                <ChevronRight size={14} className="text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition" />
              </div>
            ))}

        {!isLoading && markets.length === 0 && (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No live markets are available yet.
          </div>
        )}

        {!isLoading && (
          <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground">
            Source mix: {data?.sources.onchain.count || 0} onchain, {agentCount} BantahBro agent, {data?.sources.telegram.count || 0} Telegram, {data?.sources.twitter.count || 0} Twitter
          </div>
        )}

        {twitterNotice && (
          <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground">
            {twitterNotice}
          </div>
        )}

        {false && !isLoading && (
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center justify-between mb-1">
              <button className="text-xs text-primary hover:underline font-bold whitespace-nowrap ml-2">View all signals →</button>
            </div>

          </div>
        )}

        {!isLoading && (
          <div className="mx-3 my-3 bg-primary/10 border border-primary/30 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-sm font-bold text-foreground">Create. Bet. Win.</div>
                <div className="text-xs text-muted-foreground">Now pulling from onchain.bantah.fun and BantahBro social markets.</div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-foreground font-bold">Onchain</span>
                  <span>Production feed</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-foreground font-bold">Telegram</span>
                  <span>Agent-created</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-foreground font-bold">Twitter</span>
                  <span>Ready when live</span>
                </div>
              </div>
              <button className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded hover:opacity-90 transition whitespace-nowrap">
                Learn more →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
