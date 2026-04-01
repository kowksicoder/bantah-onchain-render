import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Search, Share2 } from 'lucide-react';

export interface PolymarketMarket {
  id: string;
  slug?: string;
  question: string;
  description: string;
  outcomes: string[];
  prices: number[];
  volume: number;
  active: boolean;
  closed: boolean;
  marketMakerAddress: string;
  endDate: string | null;
  category: string;
  image?: string;
  icon?: string;
  sourceUrl?: string;
  resolutionSource?: string;
}

type PolymarketTabProps = {
  onQuickBet?: (market: PolymarketMarket, side: "YES" | "NO") => void;
  searchTerm?: string;
};

const parseStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((entry) => String(entry));
    } catch {
      return [];
    }
  }
  return [];
};

const parseNumberArray = (value: unknown): number[] => {
  if (Array.isArray(value)) return value.map((entry) => Number(entry) || 0);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((entry) => Number(entry) || 0);
    } catch {
      return [];
    }
  }
  return [];
};

const pickFirstValidImage = (candidates: unknown[]): string => {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
  }
  return "";
};

const PolymarketCardSkeleton = () => (
  <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm rounded-2xl animate-pulse">
    <div className="h-24 w-full bg-slate-100 dark:bg-slate-800" />
    <CardContent className="p-3 space-y-3">
      <div className="space-y-2">
        <Skeleton className="h-4 w-5/6 rounded-full bg-slate-200 dark:bg-slate-800" />
        <Skeleton className="h-3 w-2/3 rounded-full bg-slate-100 dark:bg-slate-800/50" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-12 rounded-full bg-slate-100 dark:bg-slate-800/50" />
        <Skeleton className="h-3 w-14 rounded-full bg-slate-100 dark:bg-slate-800/50" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-16 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <Skeleton className="h-6 w-16 rounded-lg bg-slate-200 dark:bg-slate-800" />
      </div>
    </CardContent>
  </Card>
);

const PolymarketMarketCard: React.FC<{
  market: PolymarketMarket;
  onQuickBet?: (market: PolymarketMarket, side: "YES" | "NO") => void;
}> = ({ market, onQuickBet }) => {
  const marketLink = market.sourceUrl || (market.slug ? `https://polymarket.com/market/${market.slug}` : `https://polymarket.com/market/${market.id}`);

  const outcomes = market.outcomes.slice(0, 2);
  const extraOutcomeCount = Math.max(0, market.outcomes.length - outcomes.length);
  const volumeLabel = Number.isFinite(market.volume)
    ? new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 0,
      }).format(market.volume)
    : "--";
  const formatEndLabel = (value: string | null) => {
    if (!value) return "--";
    const end = new Date(value);
    if (Number.isNaN(end.getTime())) return "--";
    const now = new Date();
    const days = Math.ceil((end.getTime() - now.getTime()) / 86400000);
    if (days >= 0 && days <= 30) return `${days}d`;
    if (days < 0) return "Ended";
    return `${end.getDate()}/${end.getMonth() + 1}`;
  };
  const endLabel = formatEndLabel(market.endDate);

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
            {market.image ? (
              <img src={market.image} alt={market.question} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">PM</div>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                {market.question}
              </CardTitle>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => window.open(marketLink, '_blank')}
                aria-label="Share market"
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600 dark:text-slate-400" />
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {outcomes.map((outcome, index) => {
            const price = market.prices[index] ?? 0;
            const normalized = outcome.toLowerCase();
            const isYes = normalized === "yes";
            const isNo = normalized === "no";
            const baseClass = "h-7 px-3 text-[10px] font-semibold text-white border-0";
            const colorClass = isYes
              ? "bg-emerald-500 hover:bg-emerald-500"
              : isNo
                ? "bg-rose-500 hover:bg-rose-500"
                : "bg-slate-500 hover:bg-slate-500";
            return (
              <Button
                key={`${market.id}-${outcome}`}
                size="sm"
                className={`${baseClass} ${colorClass}`}
                onClick={() => {
                  if (!onQuickBet) return;
                  const side = isNo ? "NO" : "YES";
                  onQuickBet(market, side);
                }}
              >
                {outcome} {(price * 100).toFixed(0)}%
              </Button>
            );
          })}
          {extraOutcomeCount > 0 ? (
            <span className="inline-flex items-center rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] text-slate-500 dark:border-slate-700">
              +{extraOutcomeCount}
            </span>
          ) : null}
        </div>

        <div className="relative flex items-center justify-center pt-1">
          <span className="absolute left-0 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Vol. {volumeLabel === "--" ? volumeLabel : `$${volumeLabel}`}
          </span>
          <span className="absolute right-0 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {endLabel}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export const PolymarketTab: React.FC<PolymarketTabProps> = ({ onQuickBet, searchTerm = '' }) => {

  // Fetch markets from Polymarket via Bantah API proxy
  const { data, isLoading, error } = useQuery({
    queryKey: ['polymarket-markets'],
    queryFn: async () => {
      try {
        console.log('Fetching Polymarket data from Bantah API proxy...');

        const response = await fetch('/api/polymarket/markets?active=true&closed=false&limit=20');

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        const rawMarkets = Array.isArray(result) ? result : result ? [result] : [];

        if (!rawMarkets.length) {
          throw new Error('Invalid API response format');
        }

        console.log('Polymarket API success, markets found:', rawMarkets.length);

        // Transform the data to match our interface
        const transformedMarkets = rawMarkets.map((market: any) => {
          const outcomes = parseStringArray(market.outcomes);
          const prices = parseNumberArray(market.outcomePrices);
          const normalizedPrices = outcomes.length
            ? outcomes.map((_, index) => Number(prices[index] || 0))
            : prices;
          const id = String(market.id || market.conditionId || market.condition_id || market.slug || `market_${Math.random()}`);
          const slug = market.slug ? String(market.slug) : undefined;
          const question =
            market.question ||
            market.title ||
            (slug ? slug.replace(/-/g, " ") : "Unknown Question");
          const image = pickFirstValidImage([
            market.image,
            market.icon,
            market.events?.[0]?.image,
            market.events?.[0]?.icon,
          ]);
          const icon = pickFirstValidImage([
            market.icon,
            market.image,
            market.events?.[0]?.icon,
            market.events?.[0]?.image,
          ]);

          return {
            id,
            slug,
            question,
            description: market.description || '',
            outcomes: outcomes.length ? outcomes : ['Yes', 'No'],
            prices: normalizedPrices.length ? normalizedPrices : [0, 0],
            volume: Number(market.volumeNum ?? market.volume ?? 0),
            active: Boolean(market.active ?? market.is_active ?? false),
            closed: Boolean(market.closed ?? market.is_closed ?? false),
            marketMakerAddress: market.marketMakerAddress || market.market_maker_address || market.fpmm || '',
            endDate: market.endDate || market.end_date_iso || market.endDateIso || market.end_date || null,
            category: market.groupItemTitle || market.events?.[0]?.title || market.category || 'Polymarket',
            image,
            icon,
            sourceUrl: slug ? `https://polymarket.com/market/${slug}` : `https://polymarket.com/market/${id}`,
            resolutionSource: market.resolutionSource || market.resolution_source || "",
          };
        });

        const dedupedMarkets: PolymarketMarket[] = [];
        const seen = new Set<string>();
        transformedMarkets.forEach((market) => {
          const key = market.id || market.slug || market.question;
          if (seen.has(key)) return;
          seen.add(key);
          dedupedMarkets.push(market);
        });

        return dedupedMarkets as PolymarketMarket[];

      } catch (error) {
        console.error('Error fetching Polymarket data:', error);
        throw new Error('Failed to load Polymarket data. Please try again later.');
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 2, // Retry failed requests
  });

  const filteredMarkets = data?.filter((market) => {
    const matchesSearch = searchTerm === '' ||
      market.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      market.category.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  }) || [];

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 mb-4">
          <TrendingDown className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Failed to load Polymarket data</h3>
        <p className="text-slate-500 dark:text-slate-400">Please try again later</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Markets Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
          {[...Array(6)].map((_, i) => (
            <PolymarketCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredMarkets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
          {filteredMarkets.map((market) => (
            <PolymarketMarketCard key={market.id} market={market} onQuickBet={onQuickBet} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
            <Search className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No markets found</h3>
          <p className="text-slate-500 dark:text-slate-400">
            {searchTerm ? 'Try adjusting your search terms' : 'No markets available at the moment'}
          </p>
        </div>
      )}
    </div>
  );
};

export default PolymarketTab;
