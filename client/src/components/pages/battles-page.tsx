'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, Eye, Send, Settings, Share2, Smile, Star, Trophy, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { AppSection } from '@/app/page';
import type { AgentBattleFeed, AgentBattleSide } from '@/types/agentBattle';
import FeedPage from '@/components/pages/feed-page';

interface BattlesPageProps {
  onNavigate?: (section: AppSection) => void;
}

type TrollboxMessage = {
  id: string;
  source: 'web' | 'telegram' | 'system';
  user: string;
  handle: string | null;
  message: string;
  createdAt: string;
};

type TrollboxFeed = {
  roomId: string;
  battleId: string | null;
  generatedAt: string;
  messages: TrollboxMessage[];
  counts: {
    web: number;
    telegram: number;
    system: number;
  };
};

type MobileBattlePanel = 'trade' | 'stats' | 'side' | 'feed';
type MobileDetailTab = 'overview' | 'charts' | 'trades' | 'holders';
type MobileSocialTab = 'trollbox' | 'events' | 'side' | 'quick' | 'charts' | 'stats' | 'top';
type DesktopSideTab = 'trollbox' | 'feed';

function formatUsd(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'n/a';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatClock(value?: string) {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatNumber(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString();
}

function formatCompactNumber(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en', {
    notation: value >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 100_000 ? 1 : 0,
  }).format(value);
}

function formatPriceAxis(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'n/a';
  if (value >= 1) return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
}

function formatEstimatedTokens(amount: string, side: AgentBattleSide) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !side.priceUsd) return '0';
  return `${formatCompactNumber(numericAmount / side.priceUsd)} ${side.tokenSymbol || side.label.replace(/^\$/, '')}`;
}

function battleSymbol(side: AgentBattleSide) {
  return (side.tokenSymbol || side.label || 'TOKEN').replace(/^\$/, '').trim() || 'TOKEN';
}

function battleArmyName(side: AgentBattleSide) {
  return `${battleSymbol(side)} Army`;
}

function battleMarketCap(left: AgentBattleSide, right: AgentBattleSide) {
  const leftMarketCap = typeof left.marketCap === 'number' && Number.isFinite(left.marketCap) ? left.marketCap : 0;
  const rightMarketCap = typeof right.marketCap === 'number' && Number.isFinite(right.marketCap) ? right.marketCap : 0;
  return leftMarketCap + rightMarketCap;
}

function formatAgo(value?: string) {
  if (!value) return 'now';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 45) return 'now';
  if (seconds < 90) return '1m ago';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

function buyPressureUsd(side: AgentBattleSide) {
  const volume = side.volumeH24 || 0;
  const totalTrades = side.buysH24 + side.sellsH24;
  const ratio = totalTrades > 0 ? side.buysH24 / totalTrades : side.confidence / 100;
  return volume * Math.min(0.9, Math.max(0.1, ratio || 0.5));
}

function sellPressureUsd(side: AgentBattleSide) {
  const volume = side.volumeH24 || 0;
  return Math.max(0, volume - buyPressureUsd(side));
}

function activeTrades(side: AgentBattleSide) {
  return (side.buysH24 || 0) + (side.sellsH24 || 0);
}

function buildPriceLevels(side: AgentBattleSide, direction: 'ask' | 'bid') {
  const price = side.priceUsd || 0;
  const baseVolume = Math.max(1, (side.volumeH24 || 0) / Math.max(price || 1, 1));
  return [0, 1, 2, 3, 4, 5].map((index) => {
    const spread = direction === 'ask' ? 1 + (index + 1) * 0.002 : 1 - (index + 1) * 0.002;
    return {
      price: price > 0 ? price * spread : 0,
      amount: baseVolume / (index + 3),
    };
  });
}

function sideIsPositive(side: AgentBattleSide, fallbackPositive: boolean) {
  if (side.direction === 'up') return true;
  if (side.direction === 'down') return false;
  return fallbackPositive;
}

function chartPath(side: AgentBattleSide, fallbackPositive: boolean) {
  const positive = sideIsPositive(side, fallbackPositive);
  return positive
    ? '4,50 8,46 12,49 16,43 20,47 24,39 28,42 32,34 36,24 40,29 44,26 48,36 52,39 56,31 60,27 64,19 68,23 72,17 76,13 80,19 84,12 88,15 92,8 96,4'
    : '4,10 8,17 12,12 16,24 20,28 24,23 28,31 32,25 36,35 40,33 44,41 48,36 52,39 56,47 60,43 64,51 68,46 72,53 76,49 80,58 84,55 88,61 92,57 96,64';
}

function whaleActivity(side: AgentBattleSide) {
  const volume = side.volumeH24 || 0;
  if (volume >= 5_000_000) return 3;
  if (volume >= 500_000) return 2;
  if (volume > 0) return 1;
  return 0;
}

function sideTone(side: AgentBattleSide, index: number) {
  if (side.status === 'attacking') {
    return {
      border: 'border-secondary',
      bg: 'bg-secondary/10',
      text: 'text-secondary',
      button: 'bg-secondary text-background',
      tag: 'ATTACKING',
    };
  }

  if (side.status === 'staggered') {
    return {
      border: 'border-destructive',
      bg: 'bg-destructive/10',
      text: 'text-destructive',
      button: 'bg-destructive text-background',
      tag: 'UNDER PRESSURE',
    };
  }

  return index === 0
    ? {
        border: 'border-primary',
        bg: 'bg-primary/10',
        text: 'text-primary',
        button: 'bg-primary text-primary-foreground',
        tag: side.status.toUpperCase(),
      }
    : {
        border: 'border-accent',
        bg: 'bg-accent/10',
        text: 'text-accent',
        button: 'bg-accent text-background',
        tag: side.status.toUpperCase(),
      };
}

function roleColor(role: string) {
  if (role === 'SPECTATOR') return 'bg-primary/20 text-primary';
  if (role === 'ENGINE') return 'bg-muted text-muted-foreground';
  return 'bg-secondary/20 text-secondary';
}

function sourceColor(source: TrollboxMessage['source']) {
  if (source === 'telegram') return 'bg-secondary/20 text-secondary';
  if (source === 'system') return 'bg-muted text-muted-foreground';
  return 'bg-primary/20 text-primary';
}

function sourceLabel(source: TrollboxMessage['source']) {
  if (source === 'telegram') return 'TG';
  if (source === 'system') return 'SYS';
  return 'WEB';
}

function BattleSideCard({ side, index, isLeading }: { side: AgentBattleSide; index: number; isLeading: boolean }) {
  const tone = sideTone(side, index);

  return (
    <div className={`p-3 sm:p-4 ${tone.bg} border ${tone.border} rounded-lg min-w-0`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-12 h-12 rounded-full ${tone.bg} border-2 ${tone.border} flex items-center justify-center text-3xl shrink-0`}>
            {side.emoji}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-foreground truncate">{side.label}</span>
              {isLeading && <span className="text-[10px] bg-yellow-400/20 text-yellow-400 px-1 py-0.5 rounded font-bold">LEAD</span>}
            </div>
            <div className="text-xs text-muted-foreground truncate">{side.agentName}</div>
            <div className="text-[10px] text-muted-foreground">
              {side.chainLabel || side.chainId || 'Unknown chain'}
            </div>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tone.bg} ${tone.text}`}>
          {tone.tag}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-background/60 border border-border rounded px-2 py-1.5">
          <div className="text-[10px] text-muted-foreground">Live price</div>
          <div className="text-sm font-mono font-bold text-foreground">{side.priceDisplay}</div>
        </div>
        <div className="bg-background/60 border border-border rounded px-2 py-1.5">
          <div className="text-[10px] text-muted-foreground">24H move</div>
          <div className={`text-sm font-mono font-bold ${side.direction === 'down' ? 'text-destructive' : side.direction === 'up' ? 'text-secondary' : 'text-muted-foreground'}`}>
            {side.change}
          </div>
        </div>
        <div className="bg-background/60 border border-border rounded px-2 py-1.5">
          <div className="text-[10px] text-muted-foreground">24H volume</div>
          <div className="text-sm font-mono font-bold text-foreground">{formatUsd(side.volumeH24)}</div>
        </div>
        <div className="bg-background/60 border border-border rounded px-2 py-1.5">
          <div className="text-[10px] text-muted-foreground">Liquidity</div>
          <div className="text-sm font-mono font-bold text-foreground">{formatUsd(side.liquidityUsd)}</div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Battle score</span>
          <span className={`font-mono font-bold ${tone.text}`}>{side.score}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className={tone.button} style={{ width: `${side.confidence}%`, height: '100%' }} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Confidence</span>
          <span className={`font-mono font-bold ${tone.text}`}>{side.confidence}%</span>
        </div>
      </div>

      <button className={`mt-3 w-full rounded py-2 text-xs font-bold ${tone.button} hover:opacity-90 transition`}>
        Join {side.label} side
      </button>
    </div>
  );
}

function BattleChartPanel({ side, index }: { side: AgentBattleSide; index: number }) {
  const positive = sideIsPositive(side, index === 0);
  const tone = positive
    ? {
        title: 'text-green-300',
        line: '#74f044',
        fill: 'rgba(116, 240, 68, 0.32)',
        glow: 'drop-shadow(0 0 10px rgba(116,240,68,.72))',
      }
    : {
        title: 'text-red-400',
        line: '#ef4444',
        fill: 'rgba(239, 68, 68, 0.32)',
        glow: 'drop-shadow(0 0 10px rgba(239,68,68,.72))',
      };
  const gradientId = `battle-chart-${side.id.replace(/[^a-zA-Z0-9]/g, '') || index}`;
  const currentPrice = side.priceUsd || 0;
  const highAxis = currentPrice ? currentPrice * 1.08 : null;
  const lowAxis = currentPrice ? currentPrice * 0.92 : null;

  return (
    <div className="min-h-[14.5rem] rounded-md border border-border bg-card/95 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-black uppercase tracking-wide text-foreground">
          LIVE CHART - <span className={tone.title}>{side.label}</span>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">{side.priceDisplay}</div>
      </div>

      <div className="mt-2 flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
        {['1M', '5M', '15M', '1H', '4H', '1D'].map((item) => (
          <span
            key={item}
            className={item === '15M' ? 'rounded bg-primary px-2 py-1 text-primary-foreground shadow-[0_0_14px_rgba(124,58,237,.45)]' : ''}
          >
            {item}
          </span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <svg viewBox="0 0 100 68" className="h-32 w-full overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={tone.fill} />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </linearGradient>
          </defs>
          {[10, 22, 34, 46, 58].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(148,163,184,.1)" strokeWidth="0.45" />
          ))}
          {[16, 32, 48, 64, 80].map((x) => (
            <line key={x} x1={x} x2={x} y1="6" y2="64" stroke="rgba(148,163,184,.07)" strokeWidth="0.45" />
          ))}
          <path d={`M ${chartPath(side, index === 0)} L 96,68 L 4,68 Z`} fill={`url(#${gradientId})`} />
          <polyline
            points={chartPath(side, index === 0)}
            fill="none"
            stroke={tone.line}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: tone.glow }}
          />
        </svg>

        <div className="flex h-32 flex-col justify-between py-1 text-right text-[10px] font-mono text-muted-foreground">
          <span>{formatPriceAxis(highAxis)}</span>
          <span>{formatPriceAxis(currentPrice)}</span>
          <span>{formatPriceAxis(lowAxis)}</span>
        </div>
      </div>

      <div className="mt-1 grid grid-cols-5 text-[10px] font-mono text-muted-foreground">
        <span>09:00</span>
        <span>12:00</span>
        <span>15:00</span>
        <span>18:00</span>
        <span className="text-right">21:00</span>
      </div>
    </div>
  );
}

function BattleStatsPanel({ left, right }: { left: AgentBattleSide; right: AgentBattleSide }) {
  const renderWhales = (side: AgentBattleSide, positive: boolean) => {
    const active = whaleActivity(side);
    return (
      <div className="flex items-center justify-end gap-1">
        {[0, 1, 2].map((item) => (
          <span
            key={item}
            className={`h-2.5 w-5 rounded-full border ${
              item < active
                ? positive
                  ? 'border-green-500/60 bg-green-500'
                  : 'border-red-500/60 bg-red-500'
                : 'border-border bg-muted/40'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-[14.5rem] rounded-md border border-border bg-card/95 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="text-xs font-black uppercase tracking-wide text-foreground">BATTLE STATS</div>
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className={left.direction === 'down' ? 'text-red-400 font-mono font-black' : 'text-green-400 font-mono font-black'}>
            {left.change}
          </span>
          <span className="text-[9px] font-bold uppercase text-muted-foreground">Price Change (24H)</span>
          <span className={right.direction === 'down' ? 'text-red-400 font-mono font-black' : 'text-green-400 font-mono font-black'}>
            {right.change}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="font-mono text-[13px] font-black text-foreground">{formatUsd(left.volumeH24)}</span>
          <span className="text-[9px] font-bold uppercase text-muted-foreground">Volume (24H)</span>
          <span className="font-mono text-[13px] font-black text-foreground">{formatUsd(right.volumeH24)}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="font-mono text-[13px] font-black text-foreground">{formatNumber(left.buysH24)}</span>
          <span className="text-[9px] font-bold uppercase text-muted-foreground">Buyers</span>
          <span className="font-mono text-[13px] font-black text-foreground">{formatNumber(right.buysH24)}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="font-mono text-[13px] font-black text-foreground">{formatNumber(left.sellsH24)}</span>
          <span className="text-[9px] font-bold uppercase text-muted-foreground">Sellers</span>
          <span className="font-mono text-[13px] font-black text-foreground">{formatNumber(right.sellsH24)}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {renderWhales(left, true)}
          <span className="text-[9px] font-bold uppercase text-muted-foreground">Whale Activity</span>
          {renderWhales(right, false)}
        </div>
      </div>
      <button className="mt-3 rounded-md border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/20">
        View Detailed Stats
      </button>
    </div>
  );
}

function ChooseSidePanel({ left, right, leading }: { left: AgentBattleSide; right: AgentBattleSide; leading: AgentBattleSide }) {
  return (
    <div className="flex h-full min-h-[13.75rem] flex-col rounded-md border border-border bg-card/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="text-xs font-black uppercase tracking-wide text-foreground">CHOOSE YOUR SIDE</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="rounded-md border border-green-500/35 bg-green-500/15 p-2.5 text-center transition hover:bg-green-500/25">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15 text-4xl">{left.emoji}</div>
          <div className="mt-1.5 text-base font-black text-foreground">JOIN</div>
          <div className="text-xs font-black uppercase text-green-300">{left.label.replace(/^\$/, '')} Army</div>
        </button>
        <button className="rounded-md border border-red-500/35 bg-red-500/15 p-2.5 text-center transition hover:bg-red-500/25">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-4xl">{right.emoji}</div>
          <div className="mt-1.5 text-base font-black text-foreground">JOIN</div>
          <div className="text-xs font-black uppercase text-red-300">{right.label.replace(/^\$/, '')} Army</div>
        </button>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="min-w-0 text-xs text-muted-foreground">
          Your Side:{' '}
          <span className="font-black uppercase text-green-300">
            {leading.emoji} {leading.label.replace(/^\$/, '')} Army
          </span>
        </div>
        <button className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90">
          Manage Position
        </button>
      </div>
    </div>
  );
}

function BattleFeedPanel({ events, left, right }: { events: AgentBattleFeed['battles'][number]['events']; left: AgentBattleSide; right: AgentBattleSide }) {
  const visibleEvents = events.slice(0, 6);

  return (
    <div className="h-full min-h-[13.75rem] overflow-hidden rounded-md border border-border bg-card/95 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-black uppercase tracking-wide text-foreground">LIVE BATTLE FEED</div>
        <button className="flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
          Filter <ChevronDown size={12} />
        </button>
      </div>
      <div className="space-y-2">
        {visibleEvents.map((item) => {
          const side = item.sideId === left.id ? left : item.sideId === right.id ? right : null;
          return (
            <div key={item.id} className="grid grid-cols-[3.05rem_4.7rem_1fr] items-center gap-2 text-[11px]">
              <span className="font-mono text-[10px] text-muted-foreground">{formatClock(item.time).replace(/\s/g, '')}</span>
              <span className={`truncate font-black ${item.severity === 'danger' ? 'text-red-400' : item.severity === 'hot' ? 'text-green-400' : 'text-primary'}`}>
                {side?.emoji} {item.agentName}
              </span>
              <span className="truncate text-muted-foreground">
                {item.message}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickTradePanel({
  left,
  right,
  selectedIndex,
  amount,
  onSelect,
  onAmountChange,
}: {
  left: AgentBattleSide;
  right: AgentBattleSide;
  selectedIndex: 0 | 1;
  amount: string;
  onSelect: (index: 0 | 1) => void;
  onAmountChange: (value: string) => void;
}) {
  const selected = selectedIndex === 0 ? left : right;

  return (
    <div className="flex h-full min-h-[13.75rem] flex-col rounded-md border border-border bg-card/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="text-xs font-black uppercase tracking-wide text-foreground">QUICK TRADE</div>
      <div className="mt-1 text-[10px] text-muted-foreground">Support your side</div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          onClick={() => onSelect(0)}
          className={`rounded-md px-3 py-1.5 text-xs font-black transition ${
            selectedIndex === 0 ? 'bg-green-600 text-white' : 'bg-green-500/15 text-green-300 hover:bg-green-500/25'
          }`}
        >
          Buy {left.label}
        </button>
        <button
          onClick={() => onSelect(1)}
          className={`rounded-md px-3 py-1.5 text-xs font-black transition ${
            selectedIndex === 1 ? 'bg-red-600 text-white' : 'bg-red-500/15 text-red-300 hover:bg-red-500/25'
          }`}
        >
          Buy {right.label}
        </button>
      </div>

      <label className="mt-3 block text-[10px] font-bold uppercase text-muted-foreground">Amount (BXBT)</label>
      <div className="mt-1 flex items-center rounded-md border border-border bg-background">
        <input
          value={amount}
          onChange={(event) => onAmountChange(event.target.value.replace(/[^\d.]/g, ''))}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm font-black text-foreground outline-none"
          inputMode="decimal"
        />
        <button onClick={() => onAmountChange('100')} className="m-1 rounded-md bg-primary px-3 py-1.5 text-xs font-black text-primary-foreground">
          MAX
        </button>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Est. Tokens</span>
        <span className="font-mono font-bold text-foreground">{formatEstimatedTokens(amount, selected)}</span>
      </div>

      <button className={selectedIndex === 0 ? 'mt-3 w-full rounded-md bg-green-600 py-2.5 text-sm font-black text-white hover:bg-green-500' : 'mt-3 w-full rounded-md bg-red-600 py-2.5 text-sm font-black text-white hover:bg-red-500'}>
        Buy {selected.label}
      </button>

      <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
        <span>Slippage: 0.5%</span>
        <button className="rounded p-1 hover:bg-muted">
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}

function MobileTradeDeskPanel({
  left,
  right,
  selectedIndex,
  amount,
  onSelect,
  onAmountChange,
}: {
  left: AgentBattleSide;
  right: AgentBattleSide;
  selectedIndex: 0 | 1;
  amount: string;
  onSelect: (index: 0 | 1) => void;
  onAmountChange: (value: string) => void;
}) {
  const { toast } = useToast();
  const selected = selectedIndex === 0 ? left : right;
  const asks = buildPriceLevels(right, 'ask');
  const bids = buildPriceLevels(left, 'bid');
  const balance = 1250;
  const [orderType, setOrderType] = useState<'Limit' | 'Market' | 'Stop Limit'>('Limit');
  const [orderTypeOpen, setOrderTypeOpen] = useState(false);
  const [confirmTradeOpen, setConfirmTradeOpen] = useState(false);
  const estimatedTokens = formatEstimatedTokens(amount, selected);

  const applyPercent = (percent: number) => {
    const nextAmount = balance * (percent / 100);
    onAmountChange(Number.isInteger(nextAmount) ? String(nextAmount) : nextAmount.toFixed(2));
    toast({
      title: `${percent}% stake selected`,
      description: `${formatCompactNumber(nextAmount)} BXBT loaded into the ${selected.label} ticket.`,
    });
  };

  const handleMax = () => {
    onAmountChange(String(balance));
    toast({
      title: 'Max balance applied',
      description: `${formatCompactNumber(balance)} BXBT loaded for ${selected.label}.`,
    });
  };

  const adjustAmount = (direction: 'down' | 'up') => {
    const current = Number(amount) || 0;
    const nextAmount = direction === 'up' ? current + 10 : Math.max(0, current - 10);
    onAmountChange(String(nextAmount));
  };

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border bg-card/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex items-center justify-between border-b border-border bg-background/80 px-2 py-1.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-foreground">
              {left.label}/{right.label}
            </div>
            <div className="text-[9px] font-bold uppercase text-muted-foreground">Live battle spot desk</div>
          </div>
          <div className={`shrink-0 font-mono text-[11px] font-black ${selected.direction === 'down' ? 'text-red-400' : 'text-green-400'}`}>
            {selected.change}
          </div>
        </div>

        <div className="grid grid-cols-[0.44fr_0.56fr] gap-1.5 p-1.5">
          <div className="min-w-0">
            <div className="grid grid-cols-2 pb-1 text-[9px] font-bold text-muted-foreground">
              <span>Price</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="space-y-0.5">
              {asks.slice(0, 5).map((level, index) => (
                <div key={`ask-${index}`} className="grid grid-cols-2 rounded bg-red-500/[0.04] px-1 py-0.5 text-[10px] leading-4">
                  <span className="truncate font-mono text-red-400">{formatPriceAxis(level.price)}</span>
                  <span className="truncate text-right font-mono text-foreground">{formatCompactNumber(level.amount)}</span>
                </div>
              ))}
            </div>

            <div className="my-1.5 text-center">
              <div className={`font-mono text-base font-black ${selectedIndex === 0 ? 'text-green-300' : 'text-red-400'}`}>
                {formatPriceAxis(selected.priceUsd)}
              </div>
              <div className="truncate text-[9px] text-muted-foreground">{selected.priceDisplay}</div>
            </div>

            <div className="space-y-0.5">
              {bids.slice(0, 5).map((level, index) => (
                <div key={`bid-${index}`} className="grid grid-cols-2 rounded bg-green-500/[0.04] px-1 py-0.5 text-[10px] leading-4">
                  <span className="truncate font-mono text-green-400">{formatPriceAxis(level.price)}</span>
                  <span className="truncate text-right font-mono text-foreground">{formatCompactNumber(level.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-md bg-background/80 p-1.5">
            <div className="grid grid-cols-2 overflow-hidden rounded-sm bg-muted/40 p-0.5">
              <button
                onClick={() => onSelect(0)}
                className={`py-1.5 text-xs font-black transition ${selectedIndex === 0 ? 'bg-green-500 text-white' : 'text-muted-foreground'}`}
              >
                Buy
              </button>
              <button
                onClick={() => onSelect(1)}
                className={`py-1.5 text-xs font-black transition ${selectedIndex === 1 ? 'bg-red-500 text-white' : 'text-muted-foreground'}`}
              >
                Sell
              </button>
            </div>

            <button
              onClick={() => setOrderTypeOpen(true)}
              className="mt-1.5 flex w-full items-center justify-between rounded-sm bg-muted/40 px-2 py-1.5 text-[11px] font-bold text-foreground active:scale-[0.99]"
            >
              {orderType} <ChevronDown size={12} className="text-muted-foreground" />
            </button>

            <div className="mt-1.5 flex items-center rounded-sm bg-muted/40">
              <button onClick={() => adjustAmount('down')} className="px-2 text-muted-foreground active:scale-95">-</button>
              <input
                value={amount}
                onChange={(event) => onAmountChange(event.target.value.replace(/[^\d.]/g, ''))}
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-center font-mono text-sm font-black text-foreground outline-none"
                inputMode="decimal"
              />
              <button onClick={() => adjustAmount('up')} className="px-2 text-primary active:scale-95">+</button>
            </div>

            <div className="mt-1.5 grid grid-cols-4 gap-1 text-[9px] text-muted-foreground">
              {[25, 50, 75, 100].map((percent) => (
                <button key={percent} onClick={() => applyPercent(percent)} className="rounded-sm bg-muted/35 py-1 active:scale-95">%{percent}</button>
              ))}
            </div>

            <div className="mt-1.5 rounded-sm bg-muted/40 px-2 py-2 text-center font-mono text-sm font-black text-foreground">
              {estimatedTokens}
            </div>

            <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
              <span>Avbl</span>
              <button onClick={handleMax} className="font-bold text-primary active:scale-95">BXBT MAX</button>
            </div>

            <button
              onClick={() => setConfirmTradeOpen(true)}
              className={`mt-1.5 w-full rounded-sm py-2 text-sm font-black text-white active:scale-[0.99] ${
                selectedIndex === 0 ? 'bg-green-500 hover:bg-green-400' : 'bg-red-500 hover:bg-red-400'
              }`}
            >
              {selectedIndex === 0 ? 'Buy' : 'Sell'} {selected.tokenSymbol || selected.label.replace(/^\$/, '')}
            </button>
          </div>
        </div>
      </div>
      <Dialog open={orderTypeOpen} onOpenChange={setOrderTypeOpen}>
        <DialogContent className="bottom-2 top-auto w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] translate-y-0 rounded-2xl border border-border bg-card p-3 text-foreground shadow-2xl sm:top-[50%] sm:max-w-sm sm:translate-y-[-50%]">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base">Order type</DialogTitle>
            <DialogDescription className="text-xs">Choose how this mobile trade ticket should behave.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {(['Limit', 'Market', 'Stop Limit'] as const).map((option) => (
              <button
                key={option}
                onClick={() => {
                  setOrderType(option);
                  setOrderTypeOpen(false);
                  toast({ title: `${option} selected`, description: 'Trade ticket updated.' });
                }}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-bold active:scale-[0.99] ${
                  orderType === option ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-background text-foreground'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmTradeOpen} onOpenChange={setConfirmTradeOpen}>
        <DialogContent className="bottom-2 top-auto w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] translate-y-0 rounded-2xl border border-border bg-card p-3 text-foreground shadow-2xl sm:top-[50%] sm:max-w-sm sm:translate-y-[-50%]">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base">{selectedIndex === 0 ? 'Confirm buy preview' : 'Confirm sell preview'}</DialogTitle>
            <DialogDescription className="text-xs">Review the mobile order ticket before the backend execution step is connected.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-background p-3 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Side</span>
              <span className={selectedIndex === 0 ? 'font-black text-green-400' : 'font-black text-red-400'}>{selectedIndex === 0 ? 'BUY' : 'SELL'} {selected.label}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Order</span>
              <span className="font-bold">{orderType}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Stake</span>
              <span className="font-mono font-bold">{amount || '0'} BXBT</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Estimate</span>
              <span className="font-mono font-bold">{estimatedTokens}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setConfirmTradeOpen(false);
              toast({
                title: 'Trade preview ready',
                description: `${selectedIndex === 0 ? 'Buy' : 'Sell'} ${selected.label} ticket prepared. Execution API will finalize this later.`,
              });
            }}
            className={`rounded-xl py-3 text-sm font-black text-white active:scale-[0.99] ${
              selectedIndex === 0 ? 'bg-green-500' : 'bg-red-500'
            }`}
          >
            Confirm Preview
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MobileBattlePanels({
  activePanel,
  onPanelChange,
  left,
  right,
  leading,
  events,
  quickTradeSideIndex,
  quickTradeAmount,
  onQuickTradeSideChange,
  onQuickTradeAmountChange,
}: {
  activePanel: MobileBattlePanel;
  onPanelChange: (panel: MobileBattlePanel) => void;
  left: AgentBattleSide;
  right: AgentBattleSide;
  leading: AgentBattleSide;
  events: AgentBattleFeed['battles'][number]['events'];
  quickTradeSideIndex: 0 | 1;
  quickTradeAmount: string;
  onQuickTradeSideChange: (index: 0 | 1) => void;
  onQuickTradeAmountChange: (value: string) => void;
}) {
  const tabs: Array<{ key: MobileBattlePanel; label: string }> = [
    { key: 'trade', label: 'Spot' },
    { key: 'stats', label: 'Stats' },
    { key: 'side', label: 'Side' },
    { key: 'feed', label: 'Feed' },
  ];

  const panel =
    activePanel === 'trade' ? (
      <MobileTradeDeskPanel
        left={left}
        right={right}
        selectedIndex={quickTradeSideIndex}
        amount={quickTradeAmount}
        onSelect={onQuickTradeSideChange}
        onAmountChange={onQuickTradeAmountChange}
      />
    ) : activePanel === 'stats' ? (
      <BattleStatsPanel left={left} right={right} />
    ) : activePanel === 'side' ? (
      <ChooseSidePanel left={left} right={right} leading={leading} />
    ) : (
      <BattleFeedPanel events={events} left={left} right={right} />
    );

  return (
    <div className="border-b border-border bg-background p-1 xl:hidden">
      <div className="grid grid-cols-4 rounded-sm border border-border bg-[#111820] p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onPanelChange(tab.key)}
            className={`rounded-sm px-2 py-1.5 text-[10px] font-black transition ${
              activePanel === tab.key
                ? 'bg-[#202838] text-white'
                : 'text-muted-foreground hover:bg-[#18212b] hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-0.5">
        {panel}
      </div>
    </div>
  );
}

function MobileBattleHeader({
  left,
  right,
  spectators,
  onBack,
}: {
  left: AgentBattleSide;
  right: AgentBattleSide;
  spectators: number;
  onBack?: () => void;
}) {
  const { toast } = useToast();
  const marketCap = battleMarketCap(left, right);

  return (
    <div className="shrink-0 border-b border-border bg-background/95 px-2.5 py-1.5 text-foreground backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="grid h-7 w-7 place-items-center rounded-full text-foreground transition hover:bg-muted active:scale-95"
          aria-label="Back to markets"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 text-center">
          <div className="flex max-w-[58vw] items-center justify-center gap-1.5">
            <span className="truncate text-sm font-black uppercase tracking-wide text-foreground">
              {battleSymbol(left)} VS {battleSymbol(right)}
            </span>
            {marketCap > 0 && (
              <span className="shrink-0 rounded-md border border-border bg-muted px-1 py-px font-mono text-[8px] font-black uppercase leading-none text-muted-foreground">
                MC {formatUsd(marketCap)}
              </span>
            )}
          </div>
          <div className="mt-[-2px] flex items-center justify-center gap-1 text-[8px] font-black uppercase leading-none text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,.85)]" />
            Live Arena
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toast({ title: 'Battle link ready', description: 'Share action prepared for this live arena.' })}
            className="grid h-7 w-7 place-items-center rounded-full text-foreground transition hover:bg-muted active:scale-95"
            aria-label="Share battle"
          >
            <Share2 size={17} />
          </button>
          <button
            onClick={() => toast({ title: 'Battle watched', description: `${formatCompactNumber(spectators)} degens are already watching.` })}
            className="grid h-7 w-7 place-items-center rounded-full text-foreground transition hover:bg-muted active:scale-95"
            aria-label="Watch battle"
          >
            <Star size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileScoreStrip({ battle, left, right }: { battle: AgentBattleFeed['battles'][number]; left: AgentBattleSide; right: AgentBattleSide }) {
  return (
    <div className="mx-2 mt-0.5 shrink-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="grid grid-cols-[1fr_3.45rem_1fr] items-center gap-1 px-2 py-1">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-mono text-xl font-black leading-none text-green-400">{left.confidence}%</span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-green-600 to-lime-300 shadow-[0_0_14px_rgba(132,255,78,.65)]" style={{ width: `${left.confidence}%` }} />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-primary/35 bg-muted px-1 py-px text-center font-mono text-base font-black leading-tight text-foreground">
          {formatDuration(battle.timeRemainingSeconds)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 shadow-[0_0_14px_rgba(239,68,68,.55)]" style={{ width: `${right.confidence}%` }} />
            </div>
            <span className="font-mono text-xl font-black leading-none text-red-400">{right.confidence}%</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-border bg-muted/35 px-2 py-0.5 text-[8px] font-black uppercase leading-none">
        <div className="truncate text-foreground/90">
          {formatUsd(buyPressureUsd(left))} <span className="text-green-400">Buy Pressure</span>
        </div>
        <div className="truncate text-right text-foreground/90">
          {formatUsd(buyPressureUsd(right))} <span className="text-red-400">Buy Pressure</span>
        </div>
      </div>
    </div>
  );
}

function MobileArenaStage({ battle, left, right }: { battle: AgentBattleFeed['battles'][number]; left: AgentBattleSide; right: AgentBattleSide }) {
  const crowd = ['🐸', '🐶', '🐱', '🐺', '🦊', '🐻', '🐼', '🐵', '🐹', '🐸', '🐶', '🐱'];

  return (
    <div className="mx-2 mt-1 shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative h-[34vh] min-h-[13rem] max-h-[16rem] overflow-hidden bg-[radial-gradient(circle_at_50%_38%,#4aa7ff_0%,#1f6fb5_38%,#09213b_72%,#04101d_100%)]">
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-1.5 p-2">
          <div className="rounded-xl border border-border bg-background/85 px-2 py-1 text-[9px] font-black uppercase text-foreground shadow-sm backdrop-blur-md">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" /> Live Arena
          </div>
          <div className="rounded-xl border border-border bg-background/85 px-2 py-1 text-[9px] font-bold text-foreground shadow-sm backdrop-blur-md">
            <Eye size={11} className="mr-1 inline inline-block" /> {formatCompactNumber(battle.spectators)}
          </div>
          <div className="rounded-xl border border-border bg-background/85 px-2 py-1 text-[9px] font-black uppercase text-foreground shadow-sm backdrop-blur-md">
            Speed <span className="text-green-300">1.5x</span>
          </div>
        </div>

        <div className="absolute left-[19%] top-[2.65rem] z-20 rounded-2xl border border-border bg-background/90 px-2 py-1.5 text-center text-[9px] font-black uppercase leading-tight text-foreground shadow-xl">
          Feels good<br />we lead! {left.emoji}
          <span className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-border bg-background/90" />
        </div>
        <div className="absolute right-[13%] top-[2.65rem] z-20 rounded-2xl border border-border bg-background/90 px-2 py-1.5 text-center text-[9px] font-black uppercase leading-tight text-foreground shadow-xl">
          Comeback<br />incoming ☠️
          <span className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-border bg-background/90" />
        </div>

        <div className="absolute inset-x-0 top-[5.35rem] z-10 flex justify-center gap-0.5 opacity-95">
          {crowd.map((item, index) => (
            <span key={`${item}-${index}`} className="text-base drop-shadow-[0_2px_2px_rgba(0,0,0,.45)]">
              {item}
            </span>
          ))}
        </div>

        <div className="absolute inset-x-[-12%] bottom-[-36%] h-[9.2rem] rounded-[50%] border-[8px] border-amber-800/25 bg-[radial-gradient(circle,#d9b56f_0%,#b98a45_44%,#68401f_78%)] shadow-[0_-16px_35px_rgba(0,0,0,.35)_inset]" />
        <div className="absolute bottom-5 left-[14%] z-20 text-center">
          <div className="text-[4.15rem] leading-none drop-shadow-[0_12px_18px_rgba(0,0,0,.55)]">{left.emoji}</div>
          <div className="mt-[-.35rem] rounded-xl border border-border bg-background/90 px-1.5 py-0.5 text-[8px] font-black uppercase text-foreground shadow">{battleSymbol(left)}!</div>
        </div>
        <div className="absolute bottom-5 right-[12%] z-20 text-center">
          <div className="text-[4.15rem] leading-none drop-shadow-[0_12px_18px_rgba(0,0,0,.55)]">{right.emoji}</div>
          <div className="mt-[-.35rem] rounded-xl border border-border bg-background/90 px-1.5 py-0.5 text-[8px] font-black uppercase text-foreground shadow">{battleSymbol(right)}!</div>
        </div>
      </div>
    </div>
  );
}

function MobileArenaMetricsRibbon({ left, right }: { left: AgentBattleSide; right: AgentBattleSide }) {
  return (
    <div className="grid grid-cols-4 divide-x divide-white/10 bg-black/75 px-1.5 py-1.5 text-center backdrop-blur">
      <div className="px-1">
        <div className="text-[8px] font-black uppercase text-white">Change</div>
        <div className="mt-0.5 grid grid-cols-2 gap-1 text-[9px]">
          <span className="truncate font-black text-green-400">{battleSymbol(left)}</span>
          <span className="truncate font-black text-red-400">{battleSymbol(right)}</span>
          <span className="font-mono text-green-400">{left.change}</span>
          <span className="font-mono text-red-400">{right.change}</span>
        </div>
      </div>
      <div className="px-1">
        <div className="text-[8px] font-black uppercase text-white">Pressure</div>
        <div className="mt-0.5 space-y-0.5 text-[9px]">
          <div className="flex items-center gap-1">
            <span className="w-10 truncate text-green-400">{battleSymbol(left)}</span>
            <span className="h-1.5 flex-1 rounded-full bg-white/10"><span className="block h-full rounded-full bg-green-400" style={{ width: `${left.confidence}%` }} /></span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-10 truncate text-red-400">{battleSymbol(right)}</span>
            <span className="h-1.5 flex-1 rounded-full bg-white/10"><span className="block h-full rounded-full bg-red-400" style={{ width: `${right.confidence}%` }} /></span>
          </div>
        </div>
      </div>
      <div className="px-1">
        <div className="text-[8px] font-black uppercase text-white">Volume</div>
        <div className="mt-0.5 space-y-0.5 text-[9px]">
          <div className="flex justify-between gap-1"><span className="truncate text-green-400">{battleSymbol(left)}</span><span className="font-mono text-white">{formatUsd(left.volumeH24)}</span></div>
          <div className="flex justify-between gap-1"><span className="truncate text-red-400">{battleSymbol(right)}</span><span className="font-mono text-white">{formatUsd(right.volumeH24)}</span></div>
        </div>
      </div>
      <div className="px-1">
        <div className="text-[8px] font-black uppercase text-white">Trades</div>
        <div className="mt-0.5 space-y-0.5 text-[9px]">
          <div className="flex justify-between gap-1"><span className="truncate text-green-400">{battleSymbol(left)}</span><span className="font-mono text-white">{formatCompactNumber(activeTrades(left))}</span></div>
          <div className="flex justify-between gap-1"><span className="truncate text-red-400">{battleSymbol(right)}</span><span className="font-mono text-white">{formatCompactNumber(activeTrades(right))}</span></div>
        </div>
      </div>
    </div>
  );
}

function MobileLiveRail({ battle, left, right }: { battle: AgentBattleFeed['battles'][number]; left: AgentBattleSide; right: AgentBattleSide }) {
  return (
    <div className="mx-2 mt-2 grid grid-cols-4 overflow-hidden rounded-2xl border border-white/10 bg-[#07111d] text-center">
      <div className="flex items-center justify-center gap-1 border-r border-white/10 px-2 py-2 text-[11px] font-black uppercase text-white">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,.85)]" /> Live
      </div>
      <div className="border-r border-white/10 px-2 py-1.5">
        <div className="text-[9px] font-black uppercase text-muted-foreground">Buy Pressure</div>
        <div className="font-mono text-base font-black text-green-400">{formatUsd(buyPressureUsd(left))}</div>
      </div>
      <div className="border-r border-white/10 px-2 py-1.5">
        <div className="text-[9px] font-black uppercase text-muted-foreground">Sell Pressure</div>
        <div className="font-mono text-base font-black text-red-400">{formatUsd(sellPressureUsd(right))}</div>
      </div>
      <div className="px-2 py-1.5">
        <div className="text-[9px] font-black uppercase text-muted-foreground">Trades</div>
        <div className="font-mono text-base font-black text-white">{formatCompactNumber(activeTrades(left) + activeTrades(right))}</div>
      </div>
    </div>
  );
}

function MobileDualLineChart({ left, right }: { left: AgentBattleSide; right: AgentBattleSide }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-sm font-black uppercase">
        <span className="flex items-center gap-1 text-white"><span className="h-3 w-3 rounded bg-green-400" /> {battleSymbol(left)} <span className="text-green-400">{left.change}</span></span>
        <span className="flex items-center gap-1 text-white"><span className="h-3 w-3 rounded bg-red-500" /> {battleSymbol(right)} <span className="text-red-400">{right.change}</span></span>
      </div>
      <svg viewBox="0 0 100 54" className="h-44 w-full overflow-visible">
        {[8, 18, 28, 38, 48].map((y) => (
          <line key={y} x1="4" x2="96" y1={y} y2={y} stroke="rgba(148,163,184,.12)" strokeWidth=".35" />
        ))}
        {[18, 34, 50, 66, 82].map((x) => (
          <line key={x} x1={x} x2={x} y1="5" y2="50" stroke="rgba(148,163,184,.08)" strokeWidth=".35" />
        ))}
        <polyline points="4,36 8,35 12,37 16,31 20,34 24,27 28,22 32,25 36,18 40,21 44,24 48,20 52,19 56,16 60,18 64,14 68,17 72,12 76,9 80,12 84,10 88,7 92,8 96,6" fill="none" stroke="#76f044" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="4,35 8,37 12,36 16,39 20,40 24,38 28,41 32,40 36,43 40,39 44,41 48,40 52,44 56,38 60,39 64,36 68,37 72,32 76,34 80,31 84,33 88,30 92,29 96,26" fill="none" stroke="#ff333d" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="grid grid-cols-5 text-[11px] font-bold text-muted-foreground">
        <span>5m ago</span><span>4m</span><span>3m</span><span>2m</span><span className="text-right">Now</span>
      </div>
    </div>
  );
}

function MobileMetricCard({ label, value, tone = 'text-foreground', emoji }: { label: string; value: string; tone?: string; emoji?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/35 p-3">
      <div className="text-[12px] font-black uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 flex items-end gap-2 font-mono text-2xl font-black ${tone}`}>
        {emoji && <span className="text-xl">{emoji}</span>}
        {value}
      </div>
    </div>
  );
}

function MobileDetailsDeck({
  activeTab,
  onTabChange,
  left,
  right,
  events,
  onJoin,
}: {
  activeTab: MobileDetailTab;
  onTabChange: (tab: MobileDetailTab) => void;
  left: AgentBattleSide;
  right: AgentBattleSide;
  events: AgentBattleFeed['battles'][number]['events'];
  onJoin: (side: AgentBattleSide) => void;
}) {
  const tabs: Array<{ id: MobileDetailTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'charts', label: 'Charts' },
    { id: 'trades', label: 'Trades' },
    { id: 'holders', label: 'Holders' },
  ];

  return (
    <div className="mx-2 mt-2 overflow-hidden rounded-3xl border border-white/10 bg-[#050c16]">
      <div className="grid grid-cols-4 border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative py-3 text-xs font-black uppercase tracking-wide ${activeTab === tab.id ? 'text-white' : 'text-muted-foreground'}`}
          >
            {tab.label}
            {activeTab === tab.id && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-green-400 shadow-[0_0_12px_rgba(116,240,68,.85)]" />}
          </button>
        ))}
      </div>

      <div className="p-3">
        {activeTab === 'overview' && (
          <div>
            <div className="text-base font-black uppercase text-white">Price Change (5m)</div>
            <div className="mt-2">
              <MobileDualLineChart left={left} right={right} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MobileMetricCard label="Buy Pressure (5m)" value={`${left.confidence}%`} tone="text-green-400" />
              <MobileMetricCard label="Volume (5m)" value={formatUsd(left.volumeH24)} tone="text-green-400" />
              <MobileMetricCard label="Large Buys" value={formatCompactNumber(left.buysH24)} emoji="🐋" />
              <MobileMetricCard label="Large Sells" value={formatCompactNumber(right.sellsH24)} emoji="🦈" />
            </div>
            <div className="mt-2">
              <MobileMetricCard label="Speed" value="1.5x" tone="text-green-400" emoji="🚦" />
            </div>
          </div>
        )}

        {activeTab === 'charts' && (
          <div className="space-y-2">
            <BattleChartPanel side={left} index={0} />
            <BattleChartPanel side={right} index={1} />
          </div>
        )}

        {activeTab === 'trades' && <MobileRecentEvents events={events} />}

        {activeTab === 'holders' && (
          <div className="grid grid-cols-2 gap-2">
            <MobileMetricCard label={`${battleSymbol(left)} Buyers`} value={formatCompactNumber(left.buysH24)} tone="text-green-400" />
            <MobileMetricCard label={`${battleSymbol(right)} Buyers`} value={formatCompactNumber(right.buysH24)} tone="text-red-400" />
            <MobileMetricCard label={`${battleSymbol(left)} Sellers`} value={formatCompactNumber(left.sellsH24)} />
            <MobileMetricCard label={`${battleSymbol(right)} Sellers`} value={formatCompactNumber(right.sellsH24)} />
            <div className="col-span-2">
              <MobileMetricCard label="Combined Liquidity" value={formatUsd((left.liquidityUsd || 0) + (right.liquidityUsd || 0))} tone="text-primary" />
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => onJoin(left)} className="flex items-center justify-center gap-2 rounded-2xl border border-green-400/30 bg-green-600/35 px-3 py-3 text-left shadow-[0_0_18px_rgba(34,197,94,.2)] active:scale-[0.99]">
            <span className="text-3xl">{left.emoji}</span>
            <span>
              <span className="block text-sm font-black uppercase text-white">Join {battleSymbol(left)} Army</span>
              <span className="block text-xs text-white/70">Predict {battleSymbol(left)}</span>
            </span>
          </button>
          <button onClick={() => onJoin(right)} className="flex items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-600/35 px-3 py-3 text-left shadow-[0_0_18px_rgba(239,68,68,.2)] active:scale-[0.99]">
            <span className="text-3xl">{right.emoji}</span>
            <span>
              <span className="block text-sm font-black uppercase text-white">Join {battleSymbol(right)} Army</span>
              <span className="block text-xs text-white/70">Predict {battleSymbol(right)}</span>
            </span>
          </button>
        </div>
        <button className="mt-2 flex w-full items-center justify-center gap-3 rounded-2xl border border-primary/40 bg-primary/70 px-4 py-3 text-center text-white shadow-[0_0_22px_rgba(124,58,237,.35)] active:scale-[0.99]">
          <Eye size={26} />
          <span>
            <span className="block text-base font-black uppercase">Spectate Battle</span>
            <span className="block text-sm text-white/75">Watch & Earn XP</span>
          </span>
        </button>
      </div>
    </div>
  );
}

function MobileRecentEvents({ events }: { events: AgentBattleFeed['battles'][number]['events'] }) {
  const visible = events.slice(0, 5);

  return (
    <div className="rounded-2xl border border-border bg-muted/25 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-base font-black uppercase text-foreground">Recent Events</div>
        <button className="text-xs font-bold text-muted-foreground">View all ›</button>
      </div>
      <div className="space-y-2">
        {visible.map((item) => (
          <div key={item.id} className="grid grid-cols-[1.8rem_1fr_auto] items-center gap-2 text-sm">
            <span className="text-xl">{item.severity === 'danger' ? '🦈' : item.severity === 'hot' ? '🔥' : item.type === 'system' ? '⚔️' : '🐋'}</span>
            <span className="min-w-0 truncate text-foreground">
              <span className={item.severity === 'danger' ? 'text-red-400' : item.severity === 'hot' ? 'text-green-400' : 'text-primary'}>{item.metricValue || item.agentName}</span>
              {' '}{item.message}
            </span>
            <span className="text-xs text-muted-foreground">{formatAgo(item.time)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileQuickTradeTab({
  left,
  right,
  selectedIndex,
  amount,
  onSelect,
  onAmountChange,
}: {
  left: AgentBattleSide;
  right: AgentBattleSide;
  selectedIndex: 0 | 1;
  amount: string;
  onSelect: (index: 0 | 1) => void;
  onAmountChange: (value: string) => void;
}) {
  const { toast } = useToast();
  const selected = selectedIndex === 0 ? left : right;

  const submitQuickTrade = () => {
    toast({
      title: `Buy ${selected.label} prepared`,
      description: `${amount || '0'} BXBT ticket is ready. Live execution will use the connected battle staking route.`,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-muted/25 p-2">
      <div className="flex items-start justify-between gap-1.5">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wide text-foreground">QUICK TRADE</div>
          <div className="mt-px text-[8px] font-bold text-muted-foreground">Support your side</div>
        </div>
        <button className="rounded-lg p-0.5 text-muted-foreground hover:bg-muted">
          <Settings size={12} />
        </button>
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1">
        <button
          onClick={() => onSelect(0)}
          className={`truncate rounded-lg px-2 py-1.5 text-[9px] font-black transition active:scale-[0.99] ${
            selectedIndex === 0
              ? 'bg-green-600 text-white shadow-sm'
              : 'border border-green-500/25 bg-green-500/10 text-green-500 hover:bg-green-500/15'
          }`}
        >
          Buy {left.label}
        </button>
        <button
          onClick={() => onSelect(1)}
          className={`truncate rounded-lg px-2 py-1.5 text-[9px] font-black transition active:scale-[0.99] ${
            selectedIndex === 1
              ? 'bg-red-600 text-white shadow-sm'
              : 'border border-red-500/25 bg-red-500/10 text-red-500 hover:bg-red-500/15'
          }`}
        >
          Buy {right.label}
        </button>
      </div>

      <label className="mt-1.5 block text-[8px] font-bold uppercase text-muted-foreground">Amount (BXBT)</label>
      <div className="mt-0.5 flex items-center rounded-lg border border-border bg-input">
        <input
          value={amount}
          onChange={(event) => onAmountChange(event.target.value.replace(/[^\d.]/g, ''))}
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 font-mono text-xs font-black text-foreground outline-none"
          inputMode="decimal"
        />
        <button
          onClick={() => onAmountChange('100')}
          className="m-0.5 rounded-md bg-primary px-2 py-1 text-[9px] font-black text-primary-foreground active:scale-[0.98]"
        >
          MAX
        </button>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] leading-none">
        <span className="text-muted-foreground">Est. Tokens</span>
        <span className="truncate font-mono font-bold text-foreground">{formatEstimatedTokens(amount, selected)}</span>
      </div>

      <button
        onClick={submitQuickTrade}
        className={`mt-2 w-full rounded-lg py-1.5 text-xs font-black text-white shadow-sm transition active:scale-[0.99] ${
          selectedIndex === 0 ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
        }`}
      >
        Buy {selected.label}
      </button>

      <div className="mt-1 text-[9px] leading-none text-muted-foreground">Slippage: 0.5%</div>
    </div>
  );
}

function MobileChooseSideTab({
  left,
  right,
  selectedSide,
  onJoin,
}: {
  left: AgentBattleSide;
  right: AgentBattleSide;
  selectedSide: AgentBattleSide;
  onJoin: (side: AgentBattleSide) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-muted/25 p-2">
      <div className="text-[10px] font-black uppercase tracking-wide text-foreground">CHOOSE YOUR SIDE</div>

      <div className="mt-1.5 grid min-h-0 flex-1 grid-cols-2 gap-1.5">
        <button
          onClick={() => onJoin(left)}
          className={`flex min-h-0 flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition active:scale-[0.99] ${
            selectedSide.id === left.id
              ? 'border-green-400/70 bg-green-500/25 shadow-[inset_0_0_20px_rgba(34,197,94,.18)]'
              : 'border-green-500/25 bg-green-500/10 hover:bg-green-500/15'
          }`}
        >
          <span className="text-2xl leading-none">{left.emoji}</span>
          <span className="mt-1 text-[11px] font-black uppercase leading-none text-foreground">JOIN</span>
          <span className="mt-1 line-clamp-2 text-[10px] font-black uppercase leading-tight text-green-400">{battleArmyName(left)}</span>
        </button>
        <button
          onClick={() => onJoin(right)}
          className={`flex min-h-0 flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition active:scale-[0.99] ${
            selectedSide.id === right.id
              ? 'border-red-400/70 bg-red-500/25 shadow-[inset_0_0_20px_rgba(239,68,68,.18)]'
              : 'border-red-500/25 bg-red-500/10 hover:bg-red-500/15'
          }`}
        >
          <span className="text-2xl leading-none">{right.emoji}</span>
          <span className="mt-1 text-[11px] font-black uppercase leading-none text-foreground">JOIN</span>
          <span className="mt-1 line-clamp-2 text-[10px] font-black uppercase leading-tight text-red-400">{battleArmyName(right)}</span>
        </button>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-border pt-1.5">
        <div className="min-w-0 truncate text-[10px] font-bold text-muted-foreground">
          Your Side: <span className={selectedSide.id === left.id ? 'text-green-400' : 'text-red-400'}>{selectedSide.emoji} {battleArmyName(selectedSide)}</span>
        </div>
        <button
          onClick={() => onJoin(selectedSide)}
          className="shrink-0 rounded-lg bg-primary px-2 py-1 text-[9px] font-black text-primary-foreground active:scale-[0.98]"
        >
          Manage Position
        </button>
      </div>
    </div>
  );
}

function MobileCompactActions({
  left,
  right,
  onJoin,
}: {
  left: AgentBattleSide;
  right: AgentBattleSide;
  onJoin: (side: AgentBattleSide) => void;
}) {
  return (
    <div className="mx-1.5 mt-1 grid grid-cols-[1fr_1fr_0.9fr] gap-1.5">
      <button
        onClick={() => onJoin(left)}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-green-400/25 bg-green-600/30 px-2 py-2 text-left active:scale-[0.99]"
      >
        <span className="text-2xl">{left.emoji}</span>
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-black uppercase text-white">Join {battleSymbol(left)}</span>
          <span className="block truncate text-[9px] text-white/65">Predict {battleSymbol(left)}</span>
        </span>
      </button>
      <button
        onClick={() => onJoin(right)}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-red-400/25 bg-red-600/30 px-2 py-2 text-left active:scale-[0.99]"
      >
        <span className="text-2xl">{right.emoji}</span>
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-black uppercase text-white">Join {battleSymbol(right)}</span>
          <span className="block truncate text-[9px] text-white/65">Predict {battleSymbol(right)}</span>
        </span>
      </button>
      <button className="flex items-center justify-center gap-1 rounded-xl border border-primary/30 bg-primary/60 px-2 py-2 text-[10px] font-black uppercase text-white active:scale-[0.99]">
        <Eye size={15} /> Spectate
      </button>
    </div>
  );
}

function MobileBattleMenuBar({ onNavigate }: { onNavigate?: (section: AppSection) => void }) {
  const items: Array<{ section: AppSection; label: string; icon: string }> = [
    { section: 'dashboard', label: 'Markets', icon: '📊' },
    { section: 'agents', label: 'Agents', icon: '🤖' },
    { section: 'battles', label: 'Battle', icon: '⚔️' },
    { section: 'chat', label: 'Chat', icon: '💬' },
    { section: 'launcher', label: 'Launcher', icon: '🚀' },
  ];

  return (
    <div className="shrink-0 border-t border-white/10 bg-[#030912] px-1.5 py-1.5">
      <div className="grid grid-cols-5 overflow-hidden rounded-2xl border border-white/10 bg-[#07111d]">
        {items.map((item) => {
          const active = item.section === 'battles';
          return (
            <button
              key={item.section}
              onClick={() => onNavigate?.(item.section)}
              className={`flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-black transition active:scale-[0.98] ${
                active
                  ? 'bg-primary/45 text-white shadow-[inset_0_0_18px_rgba(124,58,237,.35)]'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileSocialPanel({
  activeTab,
  onTabChange,
  left,
  right,
  events,
  messages,
  selectedSide,
  quickTradeSideIndex,
  quickTradeAmount,
  chatInput,
  isSendingChat,
  onJoinSide,
  onQuickTradeSideChange,
  onQuickTradeAmountChange,
  onChatInputChange,
  onSubmitChat,
}: {
  activeTab: MobileSocialTab;
  onTabChange: (tab: MobileSocialTab) => void;
  left: AgentBattleSide;
  right: AgentBattleSide;
  events: AgentBattleFeed['battles'][number]['events'];
  messages: TrollboxMessage[];
  selectedSide: AgentBattleSide;
  quickTradeSideIndex: 0 | 1;
  quickTradeAmount: string;
  chatInput: string;
  isSendingChat: boolean;
  onJoinSide: (side: AgentBattleSide) => void;
  onQuickTradeSideChange: (index: 0 | 1) => void;
  onQuickTradeAmountChange: (value: string) => void;
  onChatInputChange: (value: string) => void;
  onSubmitChat: (event: FormEvent) => void;
}) {
  const tabs: Array<{ id: MobileSocialTab; label: string }> = [
    { id: 'trollbox', label: 'Trollbox' },
    { id: 'events', label: 'Events' },
    { id: 'side', label: 'Side' },
    { id: 'quick', label: 'Quick Trade' },
    { id: 'charts', label: 'Charts' },
    { id: 'stats', label: 'Stats' },
    { id: 'top', label: 'Top Bettors' },
  ];
  const displayMessages = messages.slice(-7);

  return (
    <div className="mx-2 mt-1 flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="no-scrollbar flex shrink-0 overflow-x-auto border-b border-border bg-background/70 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative shrink-0 px-3 py-2 text-[9px] font-black uppercase tracking-wide transition hover:bg-muted/60 ${activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            {tab.label}
            {activeTab === tab.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-green-400 shadow-[0_0_10px_rgba(116,240,68,.85)]" />}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
        {activeTab === 'trollbox' && (
          <div className="no-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {displayMessages.length > 0 ? displayMessages.map((message) => (
              <div key={message.id} className="grid grid-cols-[1.8rem_1fr_auto] gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-muted text-base">
                  {message.source === 'telegram' ? '✈️' : message.source === 'system' ? '🤖' : '🐸'}
                </div>
                <div className="min-w-0">
                  <div className={`truncate text-xs font-black ${message.source === 'system' ? 'text-primary' : message.source === 'telegram' ? 'text-sky-400' : 'text-green-400'}`}>
                    {message.user}
                  </div>
                  <div className="line-clamp-2 text-xs leading-tight text-foreground">{message.message}</div>
                </div>
                <div className="text-[10px] text-muted-foreground">{formatAgo(message.createdAt)}</div>
              </div>
            )) : (
              <div className="rounded-2xl border border-border bg-muted/35 p-3 text-center text-xs text-muted-foreground">
                Trollbox is quiet. Start the chant.
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <MobileRecentEvents events={events} />
            <div className="rounded-2xl border border-border bg-muted/25 p-3">
              <div className="mb-2 text-xs font-black uppercase tracking-wide text-foreground">Live Trades</div>
              <div className="space-y-1.5">
                {events.slice(0, 5).map((item) => (
                  <div key={`trade-${item.id}`} className="flex items-center justify-between rounded-2xl border border-border bg-background/70 px-2.5 py-1.5 text-xs">
                    <span className="min-w-0 truncate text-foreground">{item.message}</span>
                    <span className={item.severity === 'danger' ? 'ml-2 shrink-0 font-mono text-red-400' : 'ml-2 shrink-0 font-mono text-green-400'}>
                      {item.metricValue || item.metricLabel || 'live'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'side' && (
          <MobileChooseSideTab
            left={left}
            right={right}
            selectedSide={selectedSide}
            onJoin={onJoinSide}
          />
        )}

        {activeTab === 'quick' && (
          <MobileQuickTradeTab
            left={left}
            right={right}
            selectedIndex={quickTradeSideIndex}
            amount={quickTradeAmount}
            onSelect={onQuickTradeSideChange}
            onAmountChange={onQuickTradeAmountChange}
          />
        )}

        {activeTab === 'charts' && (
          <div className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <BattleChartPanel side={left} index={0} />
            <BattleChartPanel side={right} index={1} />
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <BattleStatsPanel left={left} right={right} />
            <div className="grid grid-cols-2 gap-2">
              <MobileMetricCard label={`${battleSymbol(left)} Pressure`} value={`${left.confidence}%`} tone="text-green-400" />
              <MobileMetricCard label={`${battleSymbol(right)} Pressure`} value={`${right.confidence}%`} tone="text-red-400" />
              <MobileMetricCard label="Total Volume" value={formatUsd((left.volumeH24 || 0) + (right.volumeH24 || 0))} tone="text-primary" />
              <MobileMetricCard label="Active Trades" value={formatCompactNumber(activeTrades(left) + activeTrades(right))} />
            </div>
          </div>
        )}

        {activeTab === 'top' && (
          <div className="grid grid-cols-2 gap-1.5">
            <MobileMetricCard label={`${battleSymbol(left)} Pool Side`} value={`${left.confidence}%`} tone="text-green-400" emoji={left.emoji} />
            <MobileMetricCard label={`${battleSymbol(right)} Pool Side`} value={`${right.confidence}%`} tone="text-red-400" emoji={right.emoji} />
            <div className="col-span-2 rounded-2xl border border-border bg-muted/35 p-2 text-[11px] text-muted-foreground">
              Escrow bettor leaderboard will fill from real placed bets once battle staking is connected.
            </div>
          </div>
        )}

        {activeTab === 'trollbox' && (
          <form onSubmit={onSubmitChat} className="mt-2 flex shrink-0 items-center gap-1.5 rounded-2xl border border-border bg-input px-2.5 py-1.5">
            <input
              value={chatInput}
              onChange={(event) => onChatInputChange(event.target.value)}
              placeholder="Type a message..."
              className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button type="button" className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground active:scale-95">
              <Smile size={18} />
            </button>
            <button disabled={isSendingChat} className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground active:scale-95 disabled:opacity-50">
              <Send size={14} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function MobileAgentBattleView({
  battle,
  left,
  right,
  trollboxMessages,
  trollboxUserCount,
  quickTradeSideIndex,
  quickTradeAmount,
  chatInput,
  isSendingChat,
  onQuickTradeSideChange,
  onQuickTradeAmountChange,
  onChatInputChange,
  onSubmitChat,
  onNavigate,
}: {
  battle: AgentBattleFeed['battles'][number];
  left: AgentBattleSide;
  right: AgentBattleSide;
  trollboxMessages: TrollboxMessage[];
  trollboxUserCount: number;
  quickTradeSideIndex: 0 | 1;
  quickTradeAmount: string;
  chatInput: string;
  isSendingChat: boolean;
  onQuickTradeSideChange: (index: 0 | 1) => void;
  onQuickTradeAmountChange: (value: string) => void;
  onChatInputChange: (value: string) => void;
  onSubmitChat: (event: FormEvent) => void;
  onNavigate?: (section: AppSection) => void;
}) {
  const { toast } = useToast();
  const [socialTab, setSocialTab] = useState<MobileSocialTab>('trollbox');
  const [joinSide, setJoinSide] = useState<AgentBattleSide | null>(null);
  const defaultSide = left.confidence >= right.confidence ? left : right;
  const [chosenSide, setChosenSide] = useState<AgentBattleSide | null>(defaultSide);

  const openJoinSide = (side: AgentBattleSide) => {
    setChosenSide(side);
    setJoinSide(side);
  };

  const confirmJoin = () => {
    if (!joinSide) return;
    toast({
      title: `${battleArmyName(joinSide)} selected`,
      description: 'Bet ticket prepared. Escrow execution will finalize once staking is connected.',
    });
    setJoinSide(null);
  };

  return (
    <div className="lg:hidden flex-1 min-h-0 overflow-hidden bg-background text-foreground">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <MobileBattleHeader left={left} right={right} spectators={battle.spectators} onBack={() => onNavigate?.('dashboard')} />
        <MobileScoreStrip battle={battle} left={left} right={right} />
        <MobileArenaStage battle={battle} left={left} right={right} />
        <div className="min-h-0 flex-1">
          <MobileSocialPanel
            activeTab={socialTab}
            onTabChange={setSocialTab}
            left={left}
            right={right}
            events={battle.events}
            messages={trollboxMessages}
            selectedSide={chosenSide || defaultSide}
            quickTradeSideIndex={quickTradeSideIndex}
            quickTradeAmount={quickTradeAmount}
            chatInput={chatInput}
            isSendingChat={isSendingChat}
            onJoinSide={openJoinSide}
            onQuickTradeSideChange={onQuickTradeSideChange}
            onQuickTradeAmountChange={onQuickTradeAmountChange}
            onChatInputChange={onChatInputChange}
            onSubmitChat={onSubmitChat}
          />
        </div>
      </div>

      <Dialog open={Boolean(joinSide)} onOpenChange={(open) => !open && setJoinSide(null)}>
        <DialogContent className="bottom-2 top-auto w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] translate-y-0 rounded-2xl border border-border/60 bg-card/95 p-3 text-card-foreground shadow-2xl backdrop-blur-xl sm:top-[50%] sm:max-w-sm sm:translate-y-[-50%]">
          <DialogHeader className="space-y-0.5 text-left">
            <DialogTitle className="text-sm font-black uppercase">{joinSide ? `Join ${battleArmyName(joinSide)}` : 'Join Army'}</DialogTitle>
            <DialogDescription className="text-[11px] leading-tight text-muted-foreground">
              Review your side before creating the bet ticket.
            </DialogDescription>
          </DialogHeader>
          {joinSide && (
            <div className="mt-2">
              <div className="flex items-center gap-2 rounded-xl bg-muted/35 px-2.5 py-2">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-background/70 text-2xl">{joinSide.emoji}</div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-black uppercase text-foreground">{battleArmyName(joinSide)}</div>
                  <div className="text-xs text-muted-foreground">{joinSide.priceDisplay} · {joinSide.change}</div>
                </div>
              </div>
              <button onClick={confirmJoin} className="mt-2 w-full rounded-xl bg-primary py-2 text-xs font-black text-primary-foreground shadow-sm active:scale-[0.99]">
                Prepare Bet Ticket
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoadingBattle() {
  return (
    <div className="flex-1 flex gap-0.5 overflow-hidden">
      <div className="flex-1 flex flex-col gap-2 p-3">
        <Skeleton className="h-24 w-full rounded" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-64 rounded" />
          <Skeleton className="h-64 rounded" />
        </div>
        <Skeleton className="h-24 w-full rounded" />
        <Skeleton className="h-48 w-full rounded" />
      </div>
      <div className="hidden lg:flex w-64 flex-col gap-2 p-3">
        <Skeleton className="h-full rounded" />
      </div>
    </div>
  );
}

function EmptyBattle({ isError }: { isError: boolean }) {
  return (
    <div className="flex-1 grid place-items-center bg-card border border-border rounded">
      <div className="max-w-md text-center px-4">
        <div className="text-sm font-bold text-foreground mb-2">
          {isError ? 'Agent Battle feed could not load' : 'Waiting for live Agent Battles'}
        </div>
        <div className="text-xs text-muted-foreground leading-relaxed">
          BantahBro needs at least two live Dexscreener-backed tokens to open a Phase 1 Agent Battle.
        </div>
      </div>
    </div>
  );
}

export default function BattlesPage({ onNavigate }: BattlesPageProps) {
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [quickTradeSideIndex, setQuickTradeSideIndex] = useState<0 | 1>(0);
  const [quickTradeAmount, setQuickTradeAmount] = useState('100');
  const [mobileBattlePanel, setMobileBattlePanel] = useState<MobileBattlePanel>('trade');
  const [desktopSideTab, setDesktopSideTab] = useState<DesktopSideTab>('trollbox');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useQuery<AgentBattleFeed>({
    queryKey: ['/api/bantahbro/agent-battles/live', { limit: '3' }],
    staleTime: 3_000,
    refetchInterval: 5_000,
  });

  const battle = data?.battles?.[0];
  const trollboxRoomId = 'agent-battle';

  const { data: trollboxFeed } = useQuery<TrollboxFeed>({
    queryKey: ['/api/bantahbro/trollbox', { roomId: trollboxRoomId, limit: '60' }],
    enabled: Boolean(battle),
    staleTime: 1_000,
    refetchInterval: 3_000,
  });

  const trollboxMessages = trollboxFeed?.messages || [];
  const trollboxUserCount = useMemo(() => {
    const users = new Set(
      trollboxMessages
        .map((message) => (message.handle || message.user || '').trim().toLowerCase())
        .filter(Boolean),
    );
    return users.size;
  }, [trollboxMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [trollboxMessages.length]);

  const submitChat = async (event: FormEvent) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || isSendingChat) return;

    setIsSendingChat(true);
    setChatInput('');
    try {
      await apiRequest('POST', '/api/bantahbro/trollbox', {
        roomId: trollboxRoomId,
        battleId: battle?.id,
        user: 'Web Degen',
        message: text,
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/bantahbro/trollbox'] });
    } finally {
      setIsSendingChat(false);
    }
  };

  if (isLoading) return <LoadingBattle />;
  if (isError || !battle) return <EmptyBattle isError={isError} />;

  const [left, right] = battle.sides;
  const leading = battle.leadingSideId === left.id ? left : right;

  return (
    <>
      <MobileAgentBattleView
        battle={battle}
        left={left}
        right={right}
        trollboxMessages={trollboxMessages}
        trollboxUserCount={trollboxUserCount}
        quickTradeSideIndex={quickTradeSideIndex}
        quickTradeAmount={quickTradeAmount}
        chatInput={chatInput}
        isSendingChat={isSendingChat}
        onQuickTradeSideChange={setQuickTradeSideIndex}
        onQuickTradeAmountChange={setQuickTradeAmount}
        onChatInputChange={setChatInput}
        onSubmitChat={submitChat}
        onNavigate={onNavigate}
      />

    <div className="hidden lg:flex flex-1 gap-0.5 overflow-hidden min-w-0">
      <div className="flex-1 flex flex-col bg-card border border-border rounded overflow-hidden min-w-0">
        <div className="border-b border-border bg-background px-3 py-2 flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate?.('dashboard')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft size={14} /> Back to Markets
          </button>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
            <span className="text-xs font-bold text-foreground">LIVE</span>
            <span className="hidden sm:inline text-xs text-muted-foreground">Agent Battle</span>
          </div>
          <button
            onClick={() => onNavigate?.('leaderboard')}
            className="flex items-center gap-1 text-xs font-bold bg-muted px-2 py-1 rounded hover:bg-muted/80 transition"
          >
            <Trophy size={11} className="text-primary" /> Leaderboard
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="px-4 pt-4 pb-3 text-center border-b border-border">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-xs font-bold bg-primary/20 text-primary px-2 py-0.5 rounded">AGENT BATTLE</span>
              <span className="text-xs font-bold bg-destructive/20 text-destructive px-2 py-0.5 rounded">LIVE MARKET DATA</span>
            </div>
            <h2 className="text-base sm:text-xl font-bold text-foreground mb-1">{battle.title}</h2>
            <div className="text-xs text-muted-foreground font-mono">
              Round ends in <span className="text-foreground font-bold">{formatDuration(battle.timeRemainingSeconds)}</span>
              <span className="mx-2">|</span>
              Updated <span className="text-foreground font-bold">{formatClock(battle.updatedAt)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 p-3 border-b border-border bg-background/70">
            <BattleSideCard side={left} index={0} isLeading={battle.leadingSideId === left.id} />
            <div className="hidden md:flex flex-col items-center justify-center px-1">
              <div className="text-2xl font-black text-primary">VS</div>
              <div className="text-[10px] text-muted-foreground font-bold mt-1">REAL DATA</div>
              <div className="mt-3 w-px h-20 bg-border" />
            </div>
            <BattleSideCard side={right} index={1} isLeading={battle.leadingSideId === right.id} />
          </div>

          <div className="px-4 py-3 border-b border-border bg-background">
            <div className="flex items-center justify-between text-sm font-mono font-bold mb-2 gap-3">
              <span className="text-secondary truncate">{left.confidence}% {left.label}</span>
              <span className="text-xs text-muted-foreground text-center shrink-0">
                LIVE SCORE<br />
                <span className="text-xs font-normal">{battle.winnerLogic}</span>
              </span>
              <span className="text-destructive truncate text-right">{right.confidence}% {right.label}</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex border border-border">
              <div className="bg-secondary transition-all duration-700" style={{ width: `${left.confidence}%` }} />
              <div className="bg-destructive transition-all duration-700" style={{ width: `${right.confidence}%` }} />
            </div>
          </div>

          <MobileBattlePanels
            activePanel={mobileBattlePanel}
            onPanelChange={setMobileBattlePanel}
            left={left}
            right={right}
            leading={leading}
            events={battle.events}
            quickTradeSideIndex={quickTradeSideIndex}
            quickTradeAmount={quickTradeAmount}
            onQuickTradeSideChange={setQuickTradeSideIndex}
            onQuickTradeAmountChange={setQuickTradeAmount}
          />

          <div className="hidden space-y-1 border-b border-border bg-background p-1 xl:block">
            <div className="grid grid-cols-1 gap-1 xl:grid-cols-[1fr_0.86fr_1fr]">
              <BattleChartPanel side={left} index={0} />
              <BattleStatsPanel left={left} right={right} />
              <BattleChartPanel side={right} index={1} />
            </div>

            <div className="grid grid-cols-1 items-stretch gap-1 xl:grid-cols-3">
              <ChooseSidePanel left={left} right={right} leading={leading} />
              <BattleFeedPanel events={battle.events} left={left} right={right} />
              <QuickTradePanel
                left={left}
                right={right}
                selectedIndex={quickTradeSideIndex}
                amount={quickTradeAmount}
                onSelect={setQuickTradeSideIndex}
                onAmountChange={setQuickTradeAmount}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex w-64 flex-col bg-card border border-border rounded overflow-hidden shrink-0">
        <div className="border-b border-border px-2 py-2 shrink-0">
          <div className="flex items-center gap-1 rounded bg-background/70 p-0.5">
            {[
              { id: 'trollbox' as const, label: 'TrollBox' },
              { id: 'feed' as const, label: 'Feed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDesktopSideTab(tab.id)}
                className={`flex-1 rounded px-2 py-1.5 text-[11px] font-black uppercase tracking-wide transition ${
                  desktopSideTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div className="ml-1 flex items-center gap-1 rounded-full bg-secondary/15 px-1.5 py-1 text-[10px] font-bold text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
              <Users size={10} />
              <span>{trollboxUserCount}</span>
            </div>
          </div>
        </div>

        {desktopSideTab === 'trollbox' ? (
          <>
            <div className="no-scrollbar flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-2 py-2 space-y-2">
              {trollboxMessages.map((message) => (
                <div key={message.id} className="flex items-start gap-1.5 text-xs">
                  <span className={`shrink-0 text-xs font-bold px-1 py-0.5 rounded ${sourceColor(message.source)}`}>
                    {sourceLabel(message.source)}
                  </span>
                  <div className="min-w-0">
                    <span className="font-bold text-foreground">{message.user}: </span>
                    <span className="text-muted-foreground">{message.message}</span>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={submitChat} className="border-t border-border p-2 shrink-0">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Say something..."
                  className="flex-1 bg-muted border border-border rounded px-2 py-1 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={isSendingChat}
                  className="p-1.5 bg-primary text-primary-foreground rounded hover:opacity-90 transition disabled:opacity-50"
                >
                  <Send size={12} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden p-1">
            <FeedPage compact />
          </div>
        )}
      </div>
    </div>
    </>
  );
}

