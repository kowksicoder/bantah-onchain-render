import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BantahBroAlert, BantahBroSystemAgentStatus } from "@shared/bantahBro";

type BantahBroAlertsResponse = {
  alerts: BantahBroAlert[];
};

type BantahBroLeaderboardResponse = {
  entries: Array<{
    rank: number;
    username?: string | null;
    firstName?: string | null;
    points?: number | null;
    coins?: number | null;
    challengesWon?: number | null;
    eventsWon?: number | null;
  }>;
};

type BantahBroSystemAgentResponse = {
  exists: boolean;
  systemAgent: BantahBroSystemAgentStatus | null;
};

type BantahBroAutomationStatus = {
  started: boolean;
  enabled: boolean;
  watchlistSize: number;
  lastTokenMonitorAt: string | null;
  lastAlertSchedulerAt: string | null;
  lastMarketTriggerAt: string | null;
  lastTwitterLoopAt: string | null;
  twitterLoop: {
    enabled: boolean;
    active: boolean;
    reason: string | null;
  };
};

const featureCards = [
  {
    icon: "🔎",
    title: "Analyze Tokens",
    body: "Scan meme coins across Solana, Base, Arbitrum, and BSC with live pair data, holder concentration, and suggested next actions.",
  },
  {
    icon: "⚠️",
    title: "Score Rug Risk",
    body: "Turn shaky liquidity, holder concentration, and bad flow into a blunt risk verdict the community can actually act on.",
  },
  {
    icon: "🚀",
    title: "Call Runners",
    body: "Track momentum, spot heat early, and package strong moves into runner alerts before the room gets crowded.",
  },
  {
    icon: "🏟",
    title: "Open Markets",
    body: "Convert conviction into Bantah markets, including P2P setups and conviction challenges powered by the Bantah runtime.",
  },
  {
    icon: "🏆",
    title: "Read Leaderboards",
    body: "Pull live Bantah rankings and use them as social proof, challenge bait, and competitive fuel inside the BantahBro loop.",
  },
  {
    icon: "📣",
    title: "Run Telegram First",
    body: "Telegram is live now as the command center. Chat UI lands next on web, and Twitter automation comes after that.",
  },
] as const;

function chainLabel(chainId: string | null | undefined) {
  const normalized = String(chainId || "").trim().toLowerCase();
  if (normalized === "solana" || normalized === "sol") return "Solana";
  if (normalized === "8453" || normalized === "base") return "Base";
  if (normalized === "42161" || normalized === "arb" || normalized === "arbitrum") {
    return "Arbitrum";
  }
  if (normalized === "56" || normalized === "bsc" || normalized === "binance" || normalized === "bnb") {
    return "BSC";
  }
  return chainId || "Unknown";
}

function shortAddress(address: string | null | undefined) {
  const value = String(address || "").trim();
  if (!value) return "Not provisioned";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function relativeTime(iso: string | null | undefined) {
  if (!iso) return "Not yet";
  try {
    return `${formatDistanceToNow(new Date(iso), { addSuffix: true })}`;
  } catch {
    return "Unknown";
  }
}

function statusTone(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "active" || normalized === "live" || normalized === "started") {
    return "border-emerald-200 bg-emerald-100 text-emerald-700";
  }
  if (normalized === "configured" || normalized === "warming" || normalized === "pending") {
    return "border-amber-200 bg-amber-100 text-amber-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function alertTone(alert: BantahBroAlert) {
  if (alert.type === "rug_alert") return "border-rose-200 bg-rose-50";
  if (alert.type === "runner_alert") return "border-emerald-200 bg-emerald-50";
  if (alert.type === "market_live") return "border-orange-200 bg-orange-50";
  return "border-slate-200 bg-white/80";
}

export default function BantahBro() {
  const [, navigate] = useLocation();

  const { data: alertsData, isLoading: alertsLoading } = useQuery<BantahBroAlertsResponse>({
    queryKey: ["/api/bantahbro/alerts/live", { limit: "6" }],
    retry: false,
  });

  const { data: leaderboardData, isLoading: leaderboardLoading } =
    useQuery<BantahBroLeaderboardResponse>({
      queryKey: ["/api/bantahbro/leaderboard", { limit: "8" }],
      retry: false,
    });

  const { data: systemAgentData, isLoading: systemLoading } =
    useQuery<BantahBroSystemAgentResponse>({
      queryKey: ["/api/bantahbro/system-agent/status"],
      retry: false,
    });

  const { data: automationData, isLoading: automationLoading } =
    useQuery<BantahBroAutomationStatus>({
      queryKey: ["/api/bantahbro/automation/status"],
      retry: false,
    });

  const alerts = alertsData?.alerts || [];
  const leaderboard = leaderboardData?.entries || [];
  const systemAgent = systemAgentData?.systemAgent || null;
  const automation = automationData || null;

  const alertBreakdown = alerts.reduce(
    (acc, alert) => {
      if (alert.type === "rug_alert") acc.rug += 1;
      if (alert.type === "runner_alert") acc.runner += 1;
      if (alert.market) acc.market += 1;
      return acc;
    },
    { rug: 0, runner: 0, market: 0 },
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.18),_transparent_42%),linear-gradient(180deg,#050816_0%,#0d1326_42%,#f8fafc_42%,#f8fafc_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.2),_transparent_38%),linear-gradient(180deg,#050816_0%,#0d1326_42%,#020617_42%,#020617_100%)] dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.45)] backdrop-blur sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-100">
                Telegram Live
              </Badge>
              <Badge className="border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
                Chat UI Next
              </Badge>
              <Badge className="border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100">
                Twitter Later
              </Badge>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                BantahBro is the degen command center for calls, rugs, runners, and conviction markets.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-200/85 sm:text-base">
                Telegram is live now. Web chat comes next. Twitter lands after that. This page is the public home for the
                BantahBro engine while we wire the chat layer back in.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Runtime</div>
                <div className="mt-2 text-2xl font-bold text-white">{systemAgent?.runtimeStatus || "pending"}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {systemAgent?.canCreateMarkets ? "Market-ready agent wallet" : "Provisioning in progress"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Automation</div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {automation?.started ? "ON" : automationLoading ? "..." : "OFF"}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Watchlist: {automation?.watchlistSize ?? 0} token{(automation?.watchlistSize ?? 0) === 1 ? "" : "s"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Live Alerts</div>
                <div className="mt-2 text-2xl font-bold text-white">{alerts.length}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {alertBreakdown.rug} rug, {alertBreakdown.runner} runner, {alertBreakdown.market} market-linked
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                className="rounded-full bg-gradient-to-r from-fuchsia-500 via-orange-500 to-amber-400 px-6 text-slate-950 hover:opacity-95"
                onClick={() => {
                  const target = document.getElementById("bantahbro-alerts");
                  target?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                See live alerts
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-white/20 bg-white/5 px-6 text-white hover:bg-white/10"
                onClick={() => navigate("/agents")}
              >
                Open agents hub
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-white/20 bg-white/5 px-6 text-white hover:bg-white/10"
                onClick={() => navigate("/leaderboard")}
              >
                View full leaderboard
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/40 shadow-[0_20px_80px_rgba(15,23,42,0.45)]">
            <img
              src="/bantahbro/telegram-banner.jpg"
              alt="BantahBro Telegram banner"
              className="h-full min-h-[320px] w-full object-cover"
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((feature) => (
            <Card
              key={feature.title}
              className="overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/70"
            >
              <CardContent className="space-y-4 p-6">
                <div className="text-3xl">{feature.icon}</div>
                <div className="space-y-2">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{feature.title}</h2>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Card
            id="bantahbro-alerts"
            className="overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/70"
          >
            <CardContent className="space-y-5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-fuchsia-600 dark:text-fuchsia-300">
                    Live Feed
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    Latest BantahBro alerts
                  </h2>
                </div>
                <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate("/agents")}>
                  Agent runtime
                </Button>
              </div>

              {alertsLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((item) => (
                    <Skeleton key={item} className="h-32 rounded-3xl" />
                  ))}
                </div>
              ) : alerts.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                  No live alerts yet. BantahBro is online, but the watchlist is still empty. Once the token monitor is fed
                  with targets, this section turns into the public call tape.
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <article
                      key={alert.id}
                      className={`rounded-[1.5rem] border p-5 shadow-sm transition-transform hover:-translate-y-0.5 ${alertTone(alert)} dark:border-slate-800 dark:bg-slate-950/60`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`border ${statusTone(alert.type)} px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]`}>
                              {alert.type.replace(/_/g, " ")}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-[0.18em]">
                              {chainLabel(alert.chainId)}
                            </Badge>
                            {alert.tokenSymbol ? (
                              <Badge variant="outline" className="text-[10px] uppercase tracking-[0.18em]">
                                ${alert.tokenSymbol}
                              </Badge>
                            ) : null}
                          </div>
                          <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">{alert.headline}</h3>
                          <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{alert.body}</p>
                        </div>
                        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                          <div>{relativeTime(alert.createdAt)}</div>
                          <div className="mt-2">Confidence {(alert.confidence * 100).toFixed(0)}%</div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        {alert.rugScore != null ? (
                          <span className="rounded-full bg-slate-900 px-3 py-1 font-semibold text-white dark:bg-white dark:text-slate-900">
                            Rug {alert.rugScore}/100
                          </span>
                        ) : null}
                        {alert.momentumScore != null ? (
                          <span className="rounded-full bg-emerald-600 px-3 py-1 font-semibold text-white">
                            Momentum {alert.momentumScore}/100
                          </span>
                        ) : null}
                        {alert.market?.url ? (
                          <a
                            href={alert.market.url}
                            className="rounded-full bg-orange-500 px-3 py-1 font-semibold text-white hover:opacity-90"
                          >
                            Open market
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-[1.75rem] border border-slate-200/70 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/70">
              <CardContent className="space-y-5 p-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">
                    Rankings
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    Bantah leaderboard
                  </h2>
                </div>

                {leaderboardLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2, 3].map((item) => (
                      <Skeleton key={item} className="h-14 rounded-2xl" />
                    ))}
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                    Leaderboard data is empty right now.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaderboard.map((entry) => {
                      const wins = (entry.challengesWon || 0) + (entry.eventsWon || 0);
                      const score = entry.coins ?? entry.points ?? 0;
                      const label = entry.coins != null ? "coins" : "pts";
                      const name = entry.username ? `@${entry.username}` : entry.firstName || "User";

                      return (
                        <div
                          key={`${entry.rank}-${name}`}
                          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80"
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                              #{entry.rank} {name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{wins} wins tracked</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{score}</div>
                            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                              {label}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border border-slate-200/70 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/70">
              <CardContent className="space-y-4 p-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-500 dark:text-orange-300">
                    Ops Status
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    Live engine health
                  </h2>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/80">
                    <span className="text-slate-600 dark:text-slate-300">Runtime status</span>
                    <Badge className={`border ${statusTone(systemAgent?.runtimeStatus || null)}`}>
                      {systemLoading ? "loading" : systemAgent?.runtimeStatus || "missing"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/80">
                    <span className="text-slate-600 dark:text-slate-300">Wallet health</span>
                    <Badge className={`border ${statusTone(systemAgent?.walletHealth || null)}`}>
                      {systemAgent?.walletHealth || "unknown"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/80">
                    <span className="text-slate-600 dark:text-slate-300">Wallet</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {shortAddress(systemAgent?.walletAddress)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/80">
                    <span className="text-slate-600 dark:text-slate-300">Network</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {chainLabel(systemAgent?.walletNetworkId)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/80">
                    <span className="text-slate-600 dark:text-slate-300">Last token monitor</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {relativeTime(automation?.lastTokenMonitorAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/80">
                    <span className="text-slate-600 dark:text-slate-300">Twitter loop</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {automation?.twitterLoop.enabled ? "Configured later" : "Disabled for now"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/70 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-fuchsia-600 dark:text-fuchsia-300">
                Roadmap Split
              </p>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Telegram is the command center. Web chat is next. Twitter comes after that.
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                This page is the public wrapper around the live BantahBro engine. The next return pass is the in-page chat
                interface so users can talk to the agent on web. After that, we wire the Twitter transport and reply loop.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-fuchsia-300">Now</div>
                <div className="mt-2 text-lg font-bold">Telegram + live engine</div>
                <p className="mt-2 text-sm text-slate-300">
                  Alerts, leaderboard, markets, system agent, automation, and public status.
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-amber-100 p-5 text-slate-900">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Next</div>
                <div className="mt-2 text-lg font-bold">Web chat interface</div>
                <p className="mt-2 text-sm text-amber-900/80">
                  Same BantahBro brain, but directly inside `/bantahbro` without leaving the page.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
