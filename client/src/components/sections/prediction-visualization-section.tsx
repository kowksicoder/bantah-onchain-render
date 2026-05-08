'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWallets } from '@privy-io/react-auth';
import { ExternalLink, Eye } from 'lucide-react';
import { useLocation } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type {
  PredictionVisualizationBattle,
  PredictionVisualizationExecutionPreflight,
  PredictionVisualizationFeed,
  PredictionVisualizationOrderIntent,
  PredictionVisualizationPositionResponse,
  PredictionVisualizationUserPosition,
} from '@shared/predictionVisualization';

function formatUsd(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'n/a';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatTimeRemaining(seconds?: number | null) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return 'No deadline';
  const safe = Math.max(0, Math.round(seconds));
  if (safe <= 0) return 'Closing';
  const days = Math.floor(safe / 86_400);
  const hours = Math.floor((safe % 86_400) / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getWalletAddress(wallets: unknown[]) {
  const firstWallet = wallets.find((wallet) => typeof (wallet as { address?: unknown })?.address === 'string') as
    | { address?: string }
    | undefined;
  return firstWallet?.address || '';
}

function shortAddress(address: string) {
  if (!address) return 'No wallet';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function PredictionVisualizationSection({
  onOpenBattle,
}: {
  onOpenBattle?: (battleId: string) => void;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const { wallets } = useWallets();
  const walletAddress = getWalletAddress(wallets as unknown[]);
  const [battleMode, setBattleMode] = useState(true);
  const [selectedBattle, setSelectedBattle] = useState<PredictionVisualizationBattle | null>(null);
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes');
  const [amountUsd, setAmountUsd] = useState('10');
  const [maxPrice, setMaxPrice] = useState('');
  const [orderIntent, setOrderIntent] = useState<PredictionVisualizationOrderIntent | null>(null);
  const [savedPosition, setSavedPosition] = useState<PredictionVisualizationUserPosition | null>(null);
  const [executionPreflight, setExecutionPreflight] = useState<PredictionVisualizationExecutionPreflight | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'crypto' | 'politics' | 'sports'>('all');
  const { data, isLoading, isError, isFetching } = useQuery<PredictionVisualizationFeed>({
    queryKey: ['/api/bantahbro/prediction-battles/live', { limit: '12' }],
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: 1_500,
    placeholderData: (previousData) => previousData,
  });
  const { data: positionsData } = useQuery<{ positions: PredictionVisualizationUserPosition[]; updatedAt: string }>({
    queryKey: ['/api/bantahbro/prediction-battles/positions/my', { limit: '20' }],
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    retry: 1,
  });

  const battles = data?.battles || [];
  const positions = positionsData?.positions || [];
  const trackedByBattleId = new Map(positions.map((position) => [position.battleId, position]));
  const visibleBattles =
    categoryFilter === 'all'
      ? battles
      : battles.filter((battle) => String(battle.category || '').toLowerCase().includes(categoryFilter));
  const selectedSideData = selectedBattle?.sides[selectedSide === 'yes' ? 0 : 1] || null;
  const savePositionMutation = useMutation<PredictionVisualizationPositionResponse, Error>({
    mutationFn: () =>
      apiRequest('POST', `/api/bantahbro/prediction-battles/${selectedBattle?.id}/positions`, {
        side: selectedSide,
        amountUsd: Number(amountUsd || 0),
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        walletAddress: walletAddress || undefined,
      }),
    onSuccess: (response) => {
      setOrderIntent(response.intent);
      setSavedPosition(response.position);
      setExecutionPreflight(null);
      queryClient.invalidateQueries({ queryKey: ['/api/bantahbro/prediction-battles/positions/my'] });
      toast({
        title: 'Tracked ticket saved',
        description: `${response.position.factionName} is now in your BantahBro position tracker.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Ticket could not be prepared',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  const markOpenedMutation = useMutation<{ position: PredictionVisualizationUserPosition }, Error, string>({
    mutationFn: (positionId) =>
      apiRequest('POST', `/api/bantahbro/prediction-battles/positions/${positionId}/source-opened`, {}),
    onSuccess: ({ position }) => {
      setSavedPosition(position);
      queryClient.invalidateQueries({ queryKey: ['/api/bantahbro/prediction-battles/positions/my'] });
    },
  });
  const preflightMutation = useMutation<PredictionVisualizationExecutionPreflight, Error>({
    mutationFn: () =>
      apiRequest('POST', `/api/bantahbro/prediction-battles/positions/${savedPosition?.id}/execution-preflight`, {
        walletAddress: walletAddress || undefined,
      }),
    onSuccess: (preflight) => {
      setExecutionPreflight(preflight);
      queryClient.invalidateQueries({ queryKey: ['/api/bantahbro/prediction-battles/positions/my'] });
      toast({
        title: preflight.executionReady ? 'Execution ready' : 'Execution locked safely',
        description: preflight.message,
      });
    },
    onError: (error) => {
      toast({
        title: 'Preflight failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  const submitClobMutation = useMutation<unknown, Error>({
    mutationFn: () =>
      apiRequest('POST', `/api/bantahbro/prediction-battles/positions/${savedPosition?.id}/submit-clob-order`, {
        walletAddress: walletAddress || undefined,
      }),
    onError: (error) => {
      toast({
        title: 'CLOB submit is not live yet',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const openOrderDialog = (battle: PredictionVisualizationBattle, side: 'yes' | 'no') => {
    const sideData = battle.sides[side === 'yes' ? 0 : 1];
    const existingPosition = trackedByBattleId.get(battle.id) || null;
    setSelectedBattle(battle);
    setSelectedSide(side);
    setAmountUsd('10');
    setMaxPrice(Math.min(0.99, sideData.price + 0.02).toFixed(2));
    setOrderIntent(null);
    setSavedPosition(existingPosition);
    setExecutionPreflight(null);
  };

  const openBattlePage = (battleId: string) => {
    if (onOpenBattle) {
      onOpenBattle(battleId);
      return;
    }
    setLocation(`/bantahbro/polymarket/${encodeURIComponent(battleId)}`);
  };

  const handleSaveTicket = () => {
    if (!isAuthenticated) {
      login();
      return;
    }
    savePositionMutation.mutate();
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-muted/20 px-3 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(['all', 'crypto', 'politics', 'sports'] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setCategoryFilter(filter)}
            className={`bb-tap rounded px-2 py-1 text-[10px] font-black uppercase transition ${
              categoryFilter === filter
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            {filter}
          </button>
        ))}
        {isAuthenticated && positions.length > 0 && (
          <span className="ml-auto shrink-0 rounded border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-black uppercase text-primary">
            {positions.length} tracked
          </span>
        )}
        {isFetching && !isLoading && <span className="ml-auto hidden text-[10px] font-bold uppercase text-muted-foreground sm:inline">Refreshing</span>}
      </div>

      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isLoading && battles.length === 0 && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && isError && battles.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            Polymarket visualization feed could not load. No fallback or mock markets are shown.
          </div>
        )}

        {!isLoading && !isError && battles.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            No tradable Polymarket markets passed the visualization filters yet.
          </div>
        )}

        {!isLoading && !isError && battles.length > 0 && visibleBattles.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            No {categoryFilter} markets are in the current visualization batch.
          </div>
        )}

        {!isLoading && visibleBattles.length > 0 && (
          <div className="hidden md:flex items-center gap-2 lg:gap-3 px-3 py-1.5 border-b border-border bg-muted/30 text-xs font-bold text-muted-foreground uppercase tracking-wide">
            <span className="w-4 shrink-0 text-center">#</span>
            <span className="w-9 shrink-0">Art</span>
            <span className="flex-1 min-w-0">Market</span>
            <span className="hidden lg:block min-w-[84px] shrink-0 text-right">Timer</span>
            <span className="hidden xl:block min-w-[92px] shrink-0 text-right">Volume</span>
            <span className="hidden xl:block min-w-[92px] shrink-0 text-right">Liquidity</span>
            <span className="min-w-[72px] shrink-0 text-center">YES</span>
            <span className="min-w-[72px] shrink-0 text-center">NO</span>
            <span className="min-w-[128px] shrink-0 text-right">Actions</span>
          </div>
        )}

        {visibleBattles.map((battle, index) => {
          const [yes, no] = battle.sides;
          const trackedPosition = trackedByBattleId.get(battle.id);

          return (
            <article
              key={battle.id}
              role="button"
              tabIndex={0}
              onClick={() => openBattlePage(battle.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openBattlePage(battle.id);
                }
              }}
              className="flex cursor-pointer items-center gap-2 lg:gap-3 border-b border-border px-3 py-2 transition hover:bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/70"
            >
              <span className="w-4 shrink-0 text-center text-xs font-bold text-muted-foreground">{index + 1}</span>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
                <Eye size={16} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                  <span className="shrink-0 text-[10px] font-black uppercase text-primary">
                    {battle.sourcePlatform}
                  </span>
                  {battle.category && (
                    <span className="hidden sm:inline-block max-w-[5.5rem] truncate rounded bg-muted px-1.5 py-0 text-[10px] leading-4 font-bold uppercase text-muted-foreground">
                      {battle.category}
                    </span>
                  )}
                  <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                  <span className="truncate text-[10px] font-bold uppercase text-muted-foreground">
                    Ends {formatTimeRemaining(battle.timeRemainingSeconds)}
                  </span>
                  {trackedPosition && (
                    <span className="hidden sm:inline-block rounded bg-primary/15 px-1.5 py-0 text-[10px] leading-4 font-black uppercase text-primary">
                      Tracking {trackedPosition.outcome}
                    </span>
                  )}
                </div>
                <h3 className="mt-0.5 line-clamp-2 text-sm font-black leading-tight text-foreground">
                  {battle.marketTitle}
                </h3>
                {battleMode && <div className="mt-0.5 truncate text-xs font-bold text-primary">{battle.title}</div>}
              </div>

              <div className="hidden lg:flex min-w-[84px] shrink-0 flex-col items-end text-xs font-mono">
                <span className="font-bold text-foreground">{formatTimeRemaining(battle.timeRemainingSeconds)}</span>
                <span className="text-muted-foreground">{battle.sourceStatus}</span>
              </div>

              <div className="hidden xl:flex min-w-[92px] shrink-0 flex-col items-end text-xs font-mono">
                <span className="font-bold text-foreground">{formatUsd(battle.volume)}</span>
                <span className="text-muted-foreground">volume</span>
              </div>

              <div className="hidden xl:flex min-w-[92px] shrink-0 flex-col items-end text-xs font-mono">
                <span className="font-bold text-foreground">{formatUsd(battle.liquidity)}</span>
                <span className="text-muted-foreground">liquidity</span>
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openOrderDialog(battle, 'yes');
                }}
                className="bb-tap flex min-w-[72px] shrink-0 flex-col items-center rounded bg-secondary/10 px-2 py-1.5 text-center transition hover:bg-secondary/20"
              >
                <span className="max-w-[64px] truncate text-xs font-black text-secondary">{yes.factionName}</span>
                <span className="text-xs font-mono text-muted-foreground">{yes.confidence}% · {yes.priceDisplay}</span>
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openOrderDialog(battle, 'no');
                }}
                className="bb-tap flex min-w-[72px] shrink-0 flex-col items-center rounded bg-destructive/10 px-2 py-1.5 text-center transition hover:bg-destructive/20"
              >
                <span className="max-w-[64px] truncate text-xs font-black text-destructive">{no.factionName}</span>
                <span className="text-xs font-mono text-muted-foreground">{no.confidence}% · {no.priceDisplay}</span>
              </button>

              <div className="flex min-w-[128px] shrink-0 items-center justify-end gap-1">
                {battleMode && (
                  <>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openOrderDialog(battle, 'yes');
                    }}
                    className="bb-tap hidden rounded bg-secondary px-2 py-1 text-[10px] font-black text-secondary-foreground transition hover:opacity-90 sm:inline-flex"
                  >
                    Bulls
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openOrderDialog(battle, 'no');
                    }}
                    className="bb-tap hidden rounded bg-destructive px-2 py-1 text-[10px] font-black text-destructive-foreground transition hover:opacity-90 sm:inline-flex"
                  >
                    Bears
                  </button>
                  </>
                )}
                <a
                  href={battle.sourceMarketUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="bb-tap inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[10px] font-black text-primary-foreground transition hover:opacity-90"
                >
                  Open
                  <ExternalLink size={11} />
                </a>
              </div>
            </article>
          );
        })}
      </div>

      <Dialog
        open={Boolean(selectedBattle)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedBattle(null);
            setOrderIntent(null);
            setSavedPosition(null);
          }
        }}
      >
        <DialogContent className="max-w-[390px] overflow-hidden rounded-xl border-0 bg-card p-0 font-mono text-card-foreground shadow-2xl">
          <DialogHeader className="bg-background px-4 pb-3 pt-4 text-left">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  selectedSide === 'yes' ? 'bg-green-400' : 'bg-red-400'
                }`}
              />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                Polymarket route
              </span>
            </div>
            <DialogTitle className="text-lg font-black leading-tight text-foreground">
              Join {selectedSideData?.factionName || 'Faction'}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-snug text-muted-foreground">
              Save a BantahBro ticket and execute on Polymarket until direct CLOB routing is enabled.
            </DialogDescription>
          </DialogHeader>
          {selectedBattle && selectedSideData && (
            <div className="space-y-3 bg-card px-4 pb-4 pt-3">
              <div className="rounded-lg bg-muted px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Source market</span>
                  <span className="rounded bg-background px-2 py-0.5 text-[10px] font-black text-primary">
                    {selectedSideData.outcome} {selectedSideData.priceDisplay}
                  </span>
                </div>
                <div className="mt-1.5 text-sm font-bold leading-snug text-foreground">{selectedBattle.marketTitle}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] font-black uppercase text-muted-foreground">
                  Amount USD
                  <input
                    value={amountUsd}
                    onChange={(event) => setAmountUsd(event.target.value)}
                    inputMode="decimal"
                    className="mt-1 w-full rounded-lg border-0 bg-input px-3 py-2 text-sm font-bold text-foreground outline-none ring-1 ring-transparent transition focus:ring-primary"
                  />
                </label>
                <label className="text-[11px] font-black uppercase text-muted-foreground">
                  Max price
                  <input
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                    inputMode="decimal"
                    className="mt-1 w-full rounded-lg border-0 bg-input px-3 py-2 text-sm font-bold text-foreground outline-none ring-1 ring-transparent transition focus:ring-primary"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleSaveTicket}
                disabled={savePositionMutation.isPending || authLoading}
                className="bb-tap w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-black text-primary-foreground shadow-[0_3px_0_0_rgb(var(--color-btn-primary-border)/1)] transition hover:opacity-90 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
              >
                {savePositionMutation.isPending
                  ? 'Saving...'
                  : isAuthenticated
                    ? 'Prepare & Save Ticket'
                    : 'Sign in to Save Ticket'}
              </button>

              {(orderIntent || savedPosition) && (
                <div className="rounded-lg bg-muted p-3 text-xs">
                  <div className="font-black text-primary">
                    {savedPosition ? 'Tracked position saved' : 'Ticket preview ready'}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Est. shares:{' '}
                    <span className="font-mono text-foreground">
                      {savedPosition?.estimatedShares ?? orderIntent?.estimatedShares}
                    </span>
                  </div>
                  {savedPosition && (
                    <div className="mt-1 text-muted-foreground">
                      Status: <span className="font-mono text-foreground">{savedPosition.status}</span>
                    </div>
                  )}
                  <div className="mt-1 text-muted-foreground">
                    Wallet:{' '}
                    <span className="font-mono text-foreground">
                      {shortAddress(savedPosition?.walletAddress || walletAddress)}
                    </span>
                  </div>
                  {orderIntent && <div className="mt-1 text-muted-foreground">{orderIntent.message}</div>}
                </div>
              )}

              {savedPosition && (
                <div className="space-y-2 rounded-lg bg-muted p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-black uppercase text-foreground">Execution Preflight</div>
                      <div className="text-[11px] text-muted-foreground">
                        Checks wallet, outcome token, price protection, and CLOB wiring.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => preflightMutation.mutate()}
                      disabled={preflightMutation.isPending}
                      className="bb-tap shrink-0 rounded bg-secondary px-2 py-1 text-[11px] font-black text-secondary-foreground disabled:opacity-50"
                    >
                      {preflightMutation.isPending ? 'Checking...' : 'Check'}
                    </button>
                  </div>

                  {executionPreflight && (
                    <div className="space-y-1.5">
                      {executionPreflight.checks.map((item) => (
                        <div key={item.id} className="flex items-start gap-2 text-[11px]">
                          <span
                            className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                              item.ready ? 'bg-green-400' : 'bg-amber-400'
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-foreground">{item.label}</div>
                            <div className="text-muted-foreground">{item.detail}</div>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => submitClobMutation.mutate()}
                        disabled={!executionPreflight.executionReady || submitClobMutation.isPending}
                        className="bb-tap mt-2 w-full rounded-lg bg-background px-3 py-2 text-xs font-black text-muted-foreground transition disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {executionPreflight.executionReady ? 'Submit Signed CLOB Order' : 'CLOB Submit Locked'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <a
                href={selectedBattle.sourceMarketUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (savedPosition) {
                    markOpenedMutation.mutate(savedPosition.id);
                  }
                }}
                className="bb-tap flex w-full items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-black text-foreground transition hover:bg-muted/70"
              >
                Open Polymarket
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
