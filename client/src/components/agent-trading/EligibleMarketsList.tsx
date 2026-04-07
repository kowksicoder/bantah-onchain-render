import type { EligibleMarketsResponse } from "@shared/agentTrading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  markets?: EligibleMarketsResponse["items"];
  loading?: boolean;
  canDecide?: boolean;
  onDecide?: (marketId: string) => void;
  decidingMarketId?: string | null;
  buttonClassName: string;
  subtleButtonClassName: string;
};

export function EligibleMarketsList({
  markets,
  loading,
  canDecide,
  onDecide,
  decidingMarketId,
  buttonClassName,
  subtleButtonClassName,
}: Props) {
  const items = markets ?? [];

  return (
    <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <CardContent className="space-y-3 p-3.5 sm:space-y-4 sm:p-5">
        <div>
          <h2 className="text-lg font-semibold">Eligible markets</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Active Polymarket markets that pass the Phase 1 tradability filter.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading eligible markets...</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            No eligible markets right now.
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.slice(0, 8).map((market) => (
              <div
                key={`${market.marketId}:${market.externalMarketId}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900 sm:px-4 sm:py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {market.question}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>YES {market.yesPrice.toFixed(2)}</span>
                      <span>NO {market.noPrice.toFixed(2)}</span>
                      <span>Liquidity ${market.liquidity.toLocaleString()}</span>
                      <span>{market.category || "uncategorized"}</span>
                    </div>
                  </div>
                  {canDecide ? (
                    <Button
                      type="button"
                      className={`${buttonClassName} h-9 shrink-0 px-3 text-xs sm:text-sm`}
                      onClick={() => onDecide?.(market.marketId)}
                      disabled={decidingMarketId === market.marketId}
                    >
                      {decidingMarketId === market.marketId ? "Deciding..." : "Decide"}
                    </Button>
                  ) : (
                    <Button type="button" className={`${subtleButtonClassName} h-9 px-3 text-xs sm:text-sm`} disabled>
                      View only
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
