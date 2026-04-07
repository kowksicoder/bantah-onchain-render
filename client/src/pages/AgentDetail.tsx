import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Crown,
  Cpu,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  RotateCw,
  ShieldCheck,
  Trophy,
  UserCheck,
  UserPlus,
  Wallet,
} from "lucide-react";

import { AgentAvatar } from "@/components/AgentAvatar";
import { AgentDecisionResultPanel } from "@/components/agent-trading/AgentDecisionResultPanel";
import { AgentOrdersTable } from "@/components/agent-trading/AgentOrdersTable";
import { AgentPositionsTable } from "@/components/agent-trading/AgentPositionsTable";
import { AgentTradingReadinessCard } from "@/components/agent-trading/AgentTradingReadinessCard";
import { EligibleMarketsList } from "@/components/agent-trading/EligibleMarketsList";
import { MobileNavigation } from "@/components/MobileNavigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  AgentActivityResponse,
  AgentFollowStateResponse,
  AgentOfferingsResponse,
  AgentWalletProvisionResponse,
  AgentRankResponse,
  AgentRegistryProfile,
  AgentRuntimeStateResponse,
  AgentWalletSendResponse,
} from "@shared/agentApi";
import type {
  AgentDecisionResponse,
  AgentOrdersResponse,
  AgentPerformanceResponse,
  AgentPositionsResponse,
  EligibleMarketsResponse,
  TradingReadinessResponse,
} from "@shared/agentTrading";

const limeButtonClass =
  "border-0 bg-[#ccff00] text-slate-950 hover:bg-[#b8eb00] dark:bg-[#ccff00] dark:text-slate-950 dark:hover:bg-[#b8eb00]";
const softButtonClass =
  "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function activityLabel(item: AgentActivityResponse["items"][number]) {
  if (item.type === "created_market") return "Created market";
  if (item.type === "joined_market") return item.side === "no" ? "Joined NO" : "Joined YES";
  if (item.type === "won_market") return "Won market";
  return "Lost market";
}

export default function AgentDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const [, navigate] = useLocation();
  const { user, login } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendToken, setSendToken] = useState<"USDC" | "USDT" | "ETH" | "BNB">("USDC");
  const [latestDecision, setLatestDecision] = useState<AgentDecisionResponse | null>(null);
  const [decidingMarketId, setDecidingMarketId] = useState<string | null>(null);

  const { data: agent, isLoading: loadingAgent } = useQuery<AgentRegistryProfile>({
    queryKey: [`/api/agents/${agentId}`],
    enabled: Boolean(agentId),
    queryFn: () => apiRequest("GET", `/api/agents/${agentId}`),
    retry: false,
  });

  const { data: activity, isLoading: loadingActivity } = useQuery<AgentActivityResponse>({
    queryKey: [`/api/agents/${agentId}/activity`, user?.id || "guest"],
    enabled: Boolean(agentId),
    queryFn: () => apiRequest("GET", `/api/agents/${agentId}/activity?limit=20`),
    retry: false,
  });

  const { data: followState } = useQuery<AgentFollowStateResponse>({
    queryKey: [`/api/agents/${agentId}/follow-state`, user?.id || "guest"],
    enabled: Boolean(agentId),
    queryFn: () => apiRequest("GET", `/api/agents/${agentId}/follow-state`),
    retry: false,
  });
  const { data: rankState } = useQuery<AgentRankResponse>({
    queryKey: [`/api/agents/${agentId}/rank`],
    enabled: Boolean(agentId),
    queryFn: () => apiRequest("GET", `/api/agents/${agentId}/rank`),
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const { data: runtimeState } = useQuery<AgentRuntimeStateResponse>({
    queryKey: [`/api/agents/${agentId}/runtime-state`, user?.id || "guest"],
    enabled: Boolean(agentId),
    queryFn: () => apiRequest("GET", `/api/agents/${agentId}/runtime-state`),
    retry: false,
    refetchInterval: 30000,
  });

  const { data: offeringsState } = useQuery<AgentOfferingsResponse>({
    queryKey: [`/api/agents/${agentId}/offerings`],
    enabled: Boolean(agentId),
    queryFn: () => apiRequest("GET", `/api/agents/${agentId}/offerings`),
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const { data: tradingReadiness, isLoading: loadingTradingReadiness } =
    useQuery<TradingReadinessResponse>({
      queryKey: [`/api/agents/${agentId}/trading-readiness`],
      enabled: Boolean(agentId),
      queryFn: () => apiRequest("GET", `/api/agents/${agentId}/trading-readiness`),
      retry: false,
      refetchInterval: 30000,
    });

  const { data: eligibleMarkets, isLoading: loadingEligibleMarkets } =
    useQuery<EligibleMarketsResponse>({
      queryKey: [`/api/agents/${agentId}/eligible-markets`],
      enabled: Boolean(agentId),
      queryFn: () => apiRequest("GET", `/api/agents/${agentId}/eligible-markets?limit=8`),
      retry: false,
      refetchInterval: 60000,
    });

  const { data: agentOrders, isLoading: loadingAgentOrders } = useQuery<AgentOrdersResponse>({
    queryKey: [`/api/agents/${agentId}/orders`],
    enabled: Boolean(agentId),
    queryFn: () => apiRequest("GET", `/api/agents/${agentId}/orders`),
    retry: false,
    refetchInterval: 30000,
  });

  const { data: agentPositions, isLoading: loadingAgentPositions } =
    useQuery<AgentPositionsResponse>({
      queryKey: [`/api/agents/${agentId}/positions`],
      enabled: Boolean(agentId),
      queryFn: () => apiRequest("GET", `/api/agents/${agentId}/positions`),
      retry: false,
      refetchInterval: 30000,
    });

  const { data: agentPerformance } = useQuery<AgentPerformanceResponse>({
    queryKey: [`/api/agents/${agentId}/performance`],
    enabled: Boolean(agentId),
    queryFn: () => apiRequest("GET", `/api/agents/${agentId}/performance`),
    retry: false,
    refetchInterval: 30000,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!agentId) throw new Error("Agent not found");
      return apiRequest("POST", `/api/agents/${agentId}/follow`);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/follow-state`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/rank`] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/leaderboard"] });
      toast({
        title: result?.isFollowing ? "Agent followed" : "Agent unfollowed",
        description: result?.isFollowing
          ? "We'll notify you when this agent creates or joins markets."
          : "Live agent activity alerts are turned off.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Follow update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const runtimeControlMutation = useMutation({
    mutationFn: async (action: "pause" | "resume" | "restart") => {
      if (!agentId) throw new Error("Agent not found");
      return apiRequest("POST", `/api/agents/${agentId}/runtime/${action}`);
    },
    onSuccess: (_result, action) => {
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/runtime-state`] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title:
          action === "pause"
            ? "Runtime paused"
            : action === "resume"
              ? "Runtime resumed"
              : "Runtime restarted",
        description:
          action === "pause"
            ? "This agent will stop taking managed runtime actions until you resume it."
            : action === "resume"
              ? "The managed Eliza runtime is back online."
              : "We restarted the managed Eliza runtime and refreshed its live state.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Runtime update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reprovisionWalletMutation = useMutation({
    mutationFn: async () => {
      if (!agentId) throw new Error("Agent not found");
      return apiRequest("POST", `/api/agents/${agentId}/wallet/reprovision`) as Promise<AgentWalletProvisionResponse>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/runtime-state`] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agent wallet ready",
        description: `${result.agent.agentName} now has a live AgentKit wallet.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Wallet provisioning failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendWalletMutation = useMutation({
    mutationFn: async () => {
      if (!agentId) throw new Error("Agent not found");
      return apiRequest("POST", `/api/agents/${agentId}/wallet/send`, {
        recipientAddress: sendRecipient,
        amount: sendAmount,
        tokenSymbol: sendToken,
      }) as Promise<AgentWalletSendResponse>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/runtime-state`] });
      setIsSendDialogOpen(false);
      setSendRecipient("");
      setSendAmount("");
      toast({
        title: "Transfer sent",
        description: `${result.amount} ${result.tokenSymbol} sent. Tx ${shortAddress(result.txHash)}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Send failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const decideMutation = useMutation({
    mutationFn: async (marketId: string) => {
      if (!agentId) throw new Error("Agent not found");
      setDecidingMarketId(marketId);
      return apiRequest("POST", `/api/agents/${agentId}/decide`, { marketId }) as Promise<AgentDecisionResponse>;
    },
    onSuccess: (result) => {
      setLatestDecision(result);
    },
    onError: (error: Error) => {
      toast({
        title: "Decision failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setDecidingMarketId(null);
    },
  });

  const executeDecisionMutation = useMutation({
    mutationFn: async () => {
      if (!agentId || !latestDecision || latestDecision.decision.action === "skip") {
        throw new Error("No executable decision is selected.");
      }

      return apiRequest("POST", `/api/agents/${agentId}/execute`, {
        marketId: latestDecision.decision.marketId,
        action: latestDecision.decision.action,
      }) as Promise<AgentDecisionResponse>;
    },
    onSuccess: (result) => {
      setLatestDecision(result);
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/orders`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/positions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/performance`] });
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/trading-readiness`] });
      toast({
        title: "Execution attempted",
        description:
          result.order?.status === "failed"
            ? result.order.failureReason || "The order could not be routed."
            : "The order was passed into the execution pipeline.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Execution failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const supported = runtimeState?.wallet.supportedTokens || [];
    if (supported.length === 0) return;
    if (!supported.includes(sendToken)) {
      setSendToken(supported[0]);
    }
  }, [runtimeState?.wallet.supportedTokens, sendToken]);

  const handleFollow = () => {
    if (!user) {
      login();
      return;
    }
    followMutation.mutate();
  };

  const handleCopyWallet = async () => {
    if (!agent) return;

    try {
      await navigator.clipboard.writeText(agent.walletAddress);
      setCopied(true);
      toast({
        title: "Wallet copied",
        description: shortAddress(agent.walletAddress),
      });
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: "Copy failed",
        description: "We could not copy this wallet address.",
        variant: "destructive",
      });
    }
  };

  if (!agentId) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
        <div className="mx-auto max-w-4xl">
          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <CardContent className="space-y-4 p-6">
              <h1 className="text-xl font-semibold">Agent not found</h1>
              <Button type="button" className={softButtonClass} onClick={() => navigate("/agents")}>
                Back to agents
              </Button>
            </CardContent>
          </Card>
        </div>
        <MobileNavigation />
      </div>
    );
  }

  if (loadingAgent) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
        <div className="mx-auto flex max-w-4xl items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#7440ff] border-t-transparent" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading agent profile...</p>
          </div>
        </div>
        <MobileNavigation />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
        <div className="mx-auto max-w-4xl">
          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <CardContent className="space-y-4 p-6">
              <h1 className="text-xl font-semibold">Agent not found</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                We couldn't load this agent profile.
              </p>
              <Button type="button" className={softButtonClass} onClick={() => navigate("/agents")}>
                Back to agents
              </Button>
            </CardContent>
          </Card>
        </div>
        <MobileNavigation />
      </div>
    );
  }

  const items = activity?.items ?? [];
  const isFollowing = Boolean(followState?.isFollowing);
  const followerCount = Number(followState?.followerCount ?? 0);
  const isOwner = user?.id === agent.ownerId;
  const canManageRuntime = isOwner && agent.agentType === "bantah_created";
  const isViewOnlyManagedAgent = !isOwner && agent.agentType === "bantah_created";
  const canSendFromWallet = Boolean(canManageRuntime && runtimeState?.wallet.status === "ready");
  const canReprovisionWallet = Boolean(canManageRuntime && runtimeState?.wallet.status === "unavailable");
  const runtimeBadgeClass =
    runtimeState?.health === "healthy"
      ? "border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : runtimeState?.health === "starting"
        ? "border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        : runtimeState?.health === "stopped"
          ? "border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          : runtimeState?.health === "external"
            ? "border-0 bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
            : "border-0 bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:gap-5 sm:px-6 sm:py-5 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Button type="button" className={softButtonClass} onClick={() => navigate("/agents")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Badge className="border-0 bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Agent profile
          </Badge>
        </div>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:rounded-[28px]">
          <div className="flex flex-col gap-3 p-3.5 sm:gap-5 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#7440ff]/10 text-[#7440ff] dark:bg-[#7440ff]/20 dark:text-[#b9a2ff] sm:h-16 sm:w-16 sm:rounded-[22px]">
                  <AgentAvatar
                    avatarUrl={agent.avatarUrl}
                    agentName={agent.agentName}
                    className="h-14 w-14 rounded-[20px] sm:h-16 sm:w-16 sm:rounded-[22px]"
                    fallbackClassName="bg-[#7440ff]/10 text-[#7440ff] dark:bg-[#7440ff]/20 dark:text-[#b9a2ff]"
                    iconClassName="h-6 w-6 sm:h-7 sm:w-7"
                  />
                  {agent.lastSkillCheckStatus === "passed" ? (
                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white sm:h-6 sm:w-6">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </div>
                  ) : null}
                </div>
                <div className="min-w-0 space-y-1 sm:space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-lg font-semibold tracking-tight sm:text-3xl">
                      {agent.agentName}
                    </h1>
                    <Badge className="border-0 bg-slate-100 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:text-xs">
                      {agent.specialty}
                    </Badge>
                    {agent.isTokenized ? (
                      <Badge className="border-0 bg-amber-100 text-[11px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 sm:text-xs">
                        Tokenized
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 sm:hidden">
                    Bantah-managed market agent.
                  </p>
                  <p className="hidden max-w-2xl text-sm text-slate-600 dark:text-slate-400 sm:block">
                    This agent uses Bantah skills for market creation, joins, and read-side activity. Agent wins now earn BantCredit automatically.
                  </p>
                  {runtimeState ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {rankState?.rank ? (
                        <Badge className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                          <Crown className="mr-1 h-3.5 w-3.5" />
                          #{rankState.rank}
                        </Badge>
                      ) : null}
                      <Badge className={runtimeBadgeClass}>
                        <Cpu className="mr-1 h-3.5 w-3.5" />
                        {runtimeState.health}
                      </Badge>
                      {runtimeState.isManagedRuntimeLive ? (
                        <Badge className="border-0 bg-[#7440ff]/12 text-[#7440ff] dark:bg-[#7440ff]/20 dark:text-[#b9a2ff]">
                          <span className="sm:hidden">live</span>
                          <span className="hidden sm:inline">live runtime</span>
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <Button
                  type="button"
                  className={`${isFollowing ? softButtonClass : limeButtonClass} h-8 rounded-full px-2.5 text-[11px] sm:h-10 sm:px-4 sm:text-sm`}
                  onClick={handleFollow}
                  disabled={followMutation.isPending}
                >
                  {isFollowing ? (
                    <UserCheck className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                  ) : (
                    <UserPlus className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                  )}
                  <span className="sm:hidden">{isFollowing ? "Following" : "Follow"}</span>
                  <span className="hidden sm:inline">{isFollowing ? "Following" : "Follow agent"}</span>
                </Button>
                <Button
                  type="button"
                  className={`${softButtonClass} hidden sm:inline-flex`}
                  onClick={() => navigate("/challenges?tab=agents")}
                >
                  Agent feed
                </Button>
                <Button
                  type="button"
                  className={`${softButtonClass} h-8 w-8 rounded-full p-0 text-[11px] sm:h-10 sm:w-auto sm:px-4 sm:text-sm`}
                  onClick={() => window.open(agent.endpointUrl, "_blank", "noopener,noreferrer")}
                  aria-label="Open endpoint"
                >
                  <ExternalLink className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Endpoint</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
              {[
                { label: "Rank", value: rankState?.rank ? `#${rankState.rank}` : "-" },
                { label: "BantCredit", value: agent.points.toLocaleString() },
                { label: "Wins", value: agent.winCount },
                { label: "Losses", value: agent.lossCount },
                { label: "Markets", value: agent.marketCount },
                { label: "Followers", value: rankState?.followerCount ?? followerCount },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[18px] border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900 sm:rounded-2xl sm:px-3 sm:py-2.5"
                >
                  <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 sm:text-[10px] sm:tracking-[0.14em]">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold leading-tight text-slate-950 dark:text-white sm:mt-1.5 sm:text-2xl">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CardContent className="space-y-3 p-3.5 sm:space-y-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      <span className="sm:hidden">Activity</span>
                      <span className="hidden sm:inline">Full activity</span>
                    </h2>
                    <p className="hidden text-sm text-slate-500 dark:text-slate-400 sm:block">
                      Recent markets this agent created, joined, and settled.
                    </p>
                  </div>
                  <Badge className="border-0 bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:px-3 sm:text-xs">
                    <Activity className="mr-1 h-3.5 w-3.5" />
                    {items.length}
                  </Badge>
              </div>

              {loadingActivity ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading activity...</p>
              ) : items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                    <span className="sm:hidden">No activity yet.</span>
                    <span className="hidden sm:inline">No activity yet. Once this agent creates or joins markets, the full history will show here.</span>
                  </div>
                ) : (
                  <div className="space-y-2.5 sm:space-y-3">
                  {items.map((item) => (
                    <button
                      key={item.activityId}
                      type="button"
                      onClick={() => navigate(`/challenges/${item.challengeId}/activity`)}
                      className="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 sm:gap-4 sm:px-4 sm:py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 dark:text-white sm:text-sm">
                          {activityLabel(item)}
                        </p>
                        <p className="truncate text-[13px] text-slate-600 dark:text-slate-300 sm:text-sm">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                          {item.category || "general"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                        {item.occurredAt
                          ? formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true })
                          : "recently"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CardContent className="space-y-3 p-3.5 sm:space-y-4 sm:p-5">
                <h2 className="text-lg font-semibold">
                  <span className="sm:hidden">Details</span>
                  <span className="hidden sm:inline">Agent details</span>
                </h2>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900 sm:px-4 sm:py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Wallet
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {shortAddress(agent.walletAddress)}
                    </span>
                    <Button type="button" className={`${softButtonClass} h-9 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm`} onClick={handleCopyWallet}>
                      <ArrowDownLeft className="h-4 w-4 sm:mr-2" />
                      <span className="sm:hidden">{copied ? "Done" : "Get"}</span>
                      <span className="hidden sm:inline">{copied ? "Copied" : "Receive"}</span>
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {runtimeState?.wallet.explorerUrl ? (
                      <Button
                        type="button"
                        className={`${softButtonClass} h-8 rounded-full px-3 text-[11px] sm:h-9 sm:text-xs`}
                        onClick={() =>
                          window.open(runtimeState.wallet.explorerUrl || "", "_blank", "noopener,noreferrer")
                        }
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Explorer
                      </Button>
                    ) : null}
                    {canSendFromWallet ? (
                      <Button
                        type="button"
                        className={`${limeButtonClass} h-8 rounded-full px-3 text-[11px] sm:h-9 sm:text-xs`}
                        onClick={() => setIsSendDialogOpen(true)}
                      >
                        <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
                        Send
                      </Button>
                    ) : null}
                    {canReprovisionWallet ? (
                      <Button
                        type="button"
                        className={`${softButtonClass} h-8 rounded-full px-3 text-[11px] sm:h-9 sm:text-xs`}
                        onClick={() => reprovisionWalletMutation.mutate()}
                        disabled={reprovisionWalletMutation.isPending}
                      >
                        <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                        {reprovisionWalletMutation.isPending ? "Fixing" : "Fix wallet"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900 sm:px-4 sm:py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Runtime
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {agent.runtimeEngine ? (
                      <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {agent.runtimeEngine}
                      </Badge>
                    ) : null}
                    {agent.runtimeStatus ? (
                      <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {agent.runtimeStatus}
                      </Badge>
                    ) : (
                      <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        imported
                      </Badge>
                    )}
                    {runtimeState ? (
                      <Badge className={runtimeBadgeClass}>{runtimeState.health}</Badge>
                    ) : null}
                  </div>
                  {runtimeState?.startedAt ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Live since {formatDistanceToNow(new Date(runtimeState.startedAt), { addSuffix: true })}
                    </p>
                  ) : runtimeState?.updatedAt ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Last runtime update {formatDistanceToNow(new Date(runtimeState.updatedAt), { addSuffix: true })}
                    </p>
                  ) : null}
                </div>

                {runtimeState ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900 sm:px-4 sm:py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Wallet status
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {runtimeState.wallet.provider || "external wallet"}
                      </Badge>
                      {runtimeState.wallet.networkId ? (
                        <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {runtimeState.wallet.networkId}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                      {runtimeState.wallet.balance && runtimeState.wallet.currency
                        ? `${runtimeState.wallet.balance} ${runtimeState.wallet.currency}`
                        : runtimeState.wallet.status === "external"
                          ? "Managed externally"
                          : "Balance unavailable"}
                    </p>
                    {runtimeState.wallet.message ? (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="sm:hidden">
                          {runtimeState.wallet.status === "unavailable" ? "Wallet unavailable right now." : runtimeState.wallet.message}
                        </span>
                        <span className="hidden sm:inline">{runtimeState.wallet.message}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900 sm:px-4 sm:py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Added
                  </p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {agent.createdAt
                      ? formatDistanceToNow(new Date(agent.createdAt), { addSuffix: true })
                      : "recently"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {offeringsState ? (
              <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <CardContent className="space-y-3 p-3.5 sm:space-y-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">x402 offerings</h2>
                      <p className="hidden text-sm text-slate-600 dark:text-slate-400 sm:block">
                        We are starting with Bantah-managed agents first. These are the first paid outputs we can sell from this agent.
                      </p>
                    </div>
                    <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {offeringsState.x402Phase}
                    </Badge>
                  </div>

                  <div
                    className={`rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3 ${
                      offeringsState.canSellWithX402
                        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                        : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={
                          offeringsState.canSellWithX402
                            ? "border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        }
                      >
                        {offeringsState.canSellWithX402 ? "Eligible seller" : "Not ready yet"}
                      </Badge>
                      <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {offeringsState.sellerMode === "managed" ? "Bantah-managed" : "External"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                      <span className="sm:hidden">
                        {offeringsState.canSellWithX402 ? "Seller is eligible." : "Catalog not ready yet."}
                      </span>
                      <span className="hidden sm:inline">
                        {offeringsState.items[0]?.availabilityReason ||
                          "x402 charge execution is the next layer after this catalog."}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-3">
                    {offeringsState.items.map((item) => (
                      <div
                        key={item.productId}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900 sm:px-4 sm:py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {item.title}
                              </p>
                              <Badge className="border-0 bg-[#7440ff]/12 text-[#7440ff] dark:bg-[#7440ff]/20 dark:text-[#b9a2ff]">
                                {item.type}
                              </Badge>
                              <Badge
                                className={
                                  item.status === "draft"
                                    ? "border-0 bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                                    : "border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                }
                              >
                                {item.status}
                              </Badge>
                            </div>
                            <p className="mt-2 hidden text-sm text-slate-600 dark:text-slate-400 sm:block">
                              {item.description}
                            </p>
                          </div>
                           <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-right dark:border-slate-700 dark:bg-slate-950 sm:px-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              Price
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                              ${item.priceUsd} {item.settlementCurrency}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                          <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            <Wallet className="mr-1 h-3.5 w-3.5" />
                            {item.paymentRail}
                          </Badge>
                          <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {item.settlementNetworkId}
                          </Badge>
                          <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {item.audience}
                          </Badge>
                          <span>Delivery {item.estimatedDelivery}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {canManageRuntime ? (
              <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <CardContent className="space-y-3 p-3.5 sm:space-y-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-[#7440ff]" />
                    <h2 className="text-lg font-semibold">Owner controls</h2>
                  </div>
                  <p className="hidden text-sm text-slate-600 dark:text-slate-400 sm:block">
                    Pause the managed Eliza runtime if you want the agent visible but not actively executing Bantah actions.
                  </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className={`${softButtonClass} h-9 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm`}
                        disabled={!runtimeState?.controls.canPause || runtimeControlMutation.isPending}
                        onClick={() => runtimeControlMutation.mutate("pause")}
                      >
                      <PauseCircle className="mr-2 h-4 w-4" />
                      Pause runtime
                    </Button>
                      <Button
                        type="button"
                        className={`${limeButtonClass} h-9 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm`}
                        disabled={!runtimeState?.controls.canResume || runtimeControlMutation.isPending}
                        onClick={() => runtimeControlMutation.mutate("resume")}
                      >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Resume runtime
                    </Button>
                      <Button
                        type="button"
                        className={`${softButtonClass} h-9 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm`}
                        disabled={!runtimeState?.controls.canRestart || runtimeControlMutation.isPending}
                        onClick={() => runtimeControlMutation.mutate("restart")}
                      >
                      <RotateCw className="mr-2 h-4 w-4" />
                      Restart runtime
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : isViewOnlyManagedAgent ? (
              <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <CardContent className="space-y-3 p-3.5 sm:p-5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-[#7440ff]" />
                    <h2 className="text-lg font-semibold">View only</h2>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="sm:hidden">Only the owner can manage this agent.</span>
                    <span className="hidden sm:inline">
                      Only the owner can pause, resume, or restart this agent. You can follow it, review its runtime health,
                      and track its market activity here.
                    </span>
                  </p>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CardContent className="space-y-3 p-3.5 sm:space-y-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-[#7440ff]" />
                  <h2 className="text-lg font-semibold">Reward rule</h2>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="sm:hidden">Agent wins add BantCredit.</span>
                  <span className="hidden sm:inline">
                    Each agent win now adds simple BantCredit rewards to the agent profile. Losses do not deduct BantCredit.
                  </span>
                </p>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900 sm:px-4 sm:py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Wallet className="h-4 w-4 text-[#7440ff]" />
                    +100 BantCredit per agent win
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Agent trading</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Phase 1 trading readiness, decisions, and local tracking for fetched Polymarket markets.
              </p>
            </div>
            <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Phase 1
            </Badge>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <AgentTradingReadinessCard
              readiness={tradingReadiness}
              performance={agentPerformance}
              loading={loadingTradingReadiness}
            />
            <AgentDecisionResultPanel
              result={latestDecision}
              canExecute={Boolean(isOwner)}
              onExecute={() => executeDecisionMutation.mutate()}
              executing={executeDecisionMutation.isPending}
              buttonClassName={limeButtonClass}
            />
          </div>

          <EligibleMarketsList
            markets={eligibleMarkets?.items}
            loading={loadingEligibleMarkets}
            canDecide={Boolean(isOwner)}
            onDecide={(marketId) => decideMutation.mutate(marketId)}
            decidingMarketId={decidingMarketId}
            buttonClassName={limeButtonClass}
            subtleButtonClassName={softButtonClass}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <AgentOrdersTable orders={agentOrders?.items ?? []} loading={loadingAgentOrders} />
            <AgentPositionsTable
              positions={agentPositions?.items ?? []}
              loading={loadingAgentPositions}
            />
          </div>
        </section>
      </div>

      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle>Send from agent wallet</DialogTitle>
            <DialogDescription>
              Owner-only transfer from {agent.agentName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Recipient
              </label>
              <Input
                value={sendRecipient}
                onChange={(event) => setSendRecipient(event.target.value)}
                placeholder="0x..."
                className="h-10 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-[1fr_108px] gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Amount
                </label>
                <Input
                  value={sendAmount}
                  onChange={(event) => setSendAmount(event.target.value)}
                  placeholder="0.00"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Token
                </label>
                <select
                  value={sendToken}
                  onChange={(event) =>
                    setSendToken(event.target.value as "USDC" | "USDT" | "ETH" | "BNB")
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {(runtimeState?.wallet.supportedTokens || [sendToken]).map((token) => (
                    <option key={token} value={token}>
                      {token}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                className={`${softButtonClass} flex-1`}
                onClick={() => setIsSendDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={`${limeButtonClass} flex-1`}
                disabled={
                  sendWalletMutation.isPending ||
                  !sendRecipient.trim() ||
                  !sendAmount.trim()
                }
                onClick={() => sendWalletMutation.mutate()}
              >
                <ArrowUpRight className="mr-2 h-4 w-4" />
                {sendWalletMutation.isPending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MobileNavigation />
    </div>
  );
}
