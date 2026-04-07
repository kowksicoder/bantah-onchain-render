import { Bot, PlayCircle, ShieldAlert, Sparkles } from "lucide-react";

import type { AgentDecisionResponse } from "@shared/agentTrading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  result: AgentDecisionResponse | null;
  canExecute: boolean;
  onExecute?: () => void;
  executing?: boolean;
  buttonClassName: string;
};

export function AgentDecisionResultPanel({
  result,
  canExecute,
  onExecute,
  executing,
  buttonClassName,
}: Props) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <CardContent className="space-y-3 p-3.5 sm:space-y-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-[#7440ff]" />
          <div>
            <h2 className="text-lg font-semibold">Decision result</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              Latest structured decision from the Phase 1 strategy flow.
            </p>
          </div>
        </div>

        {!result ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Pick an eligible market and run <span className="font-semibold">Decide</span> to see the explainable action output here.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-[#7440ff]/12 text-[#7440ff] dark:bg-[#7440ff]/20 dark:text-[#b9a2ff]">
                {result.decision.action}
              </Badge>
              <Badge
                className={
                  result.risk.allowed
                    ? "border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                }
              >
                {result.risk.allowed ? "Risk pass" : "Risk blocked"}
              </Badge>
              <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Confidence {Math.round(result.decision.confidence * 100)}%
              </Badge>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {result.decision.marketQuestion || result.decision.marketId}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {result.decision.reason}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Price {result.decision.intendedPrice?.toFixed(2) ?? "-"}</span>
                <span>Stake ${result.decision.intendedStakeUsd?.toFixed(2) ?? "-"}</span>
                <span>Strategy {result.decision.strategyType}</span>
              </div>
            </div>

            {result.risk.reasons.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <ShieldAlert className="h-4 w-4" />
                  Risk reasons
                </div>
                <ul className="space-y-1">
                  {result.risk.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.order ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Order {result.order.status}
                  </Badge>
                  {result.routingAttempted ? (
                    <Badge className="border-0 bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                      Routed
                    </Badge>
                  ) : null}
                </div>
                {result.order.failureReason ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {result.order.failureReason}
                  </p>
                ) : null}
              </div>
            ) : null}

            {canExecute && result.decision.action !== "skip" ? (
              <Button
                type="button"
                className={`${buttonClassName} w-full`}
                onClick={onExecute}
                disabled={!result.risk.allowed || executing}
              >
                {executing ? (
                  <Sparkles className="mr-2 h-4 w-4" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                {executing ? "Executing..." : `Execute ${result.decision.action}`}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
