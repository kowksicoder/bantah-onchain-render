import { BarChart3, CheckCircle2, ShieldAlert, Wallet } from "lucide-react";

import type {
  AgentPerformanceResponse,
  TradingReadinessResponse,
} from "@shared/agentTrading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  readiness?: TradingReadinessResponse;
  performance?: AgentPerformanceResponse;
  loading?: boolean;
};

export function AgentTradingReadinessCard({ readiness, performance, loading }: Props) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <CardContent className="space-y-3 p-3.5 sm:space-y-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Trading readiness</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              Wallet, limits, and position health before live routing.
            </p>
          </div>
          <Badge
            className={
              readiness?.canTrade
                ? "border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
            }
          >
            {readiness?.canTrade ? "Ready" : "Blocked"}
          </Badge>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading trading state...</p>
        ) : readiness ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Wallet
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {readiness.walletReady ? "Funded" : "Needs funds"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Daily trades
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {readiness.dailyTradesUsed}/{readiness.dailyTradeLimit}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Open positions
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {readiness.openPositionsCount}/{readiness.maxOpenPositions}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Balance
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {readiness.balanceSummary.amount && readiness.balanceSummary.currency
                    ? `${readiness.balanceSummary.amount} ${readiness.balanceSummary.currency}`
                    : "Unavailable"}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Trades
                </div>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  {performance?.totalTrades ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  <Wallet className="h-3.5 w-3.5" />
                  Volume
                </div>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  ${performance?.totalSubmittedVolume.toFixed(2) ?? "0.00"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Unrealized PnL
                </div>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  ${performance?.unrealizedPnl.toFixed(4) ?? "0.0000"}
                </p>
              </div>
            </div>

            {readiness.reasons.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <ShieldAlert className="h-4 w-4" />
                  Current blockers
                </div>
                <ul className="space-y-1">
                  {readiness.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
