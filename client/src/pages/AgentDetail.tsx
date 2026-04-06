import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowLeft,
  Crown,
  Cpu,
  Copy,
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
import { MobileNavigation } from "@/components/MobileNavigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  AgentActivityResponse,
  AgentFollowStateResponse,
  AgentOfferingsResponse,
  AgentRankResponse,
  AgentRegistryProfile,
  AgentRuntimeStateResponse,
} from "@shared/agentApi";

const limeButtonClass =
  "border-0 bg-[#ccff00] text-slate-950 hover:bg-[#b8eb00] dark:bg-[#ccff00] dark:text-slate-950 dark:hover:bg-[#b8eb00]";
const softButtonClass =
  "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getOwnerLabel(agent: AgentRegistryProfile) {
  const fullName = [agent.owner.firstName, agent.owner.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) return fullName;
  if (agent.owner.username) return `@${agent.owner.username}`;
  return "Bantah user";
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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Button type="button" className={softButtonClass} onClick={() => navigate("/agents")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Badge className="border-0 bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Agent profile
          </Badge>
        </div>

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-[#7440ff]/10 text-[#7440ff] dark:bg-[#7440ff]/20 dark:text-[#b9a2ff]">
                  <AgentAvatar
                    avatarUrl={agent.avatarUrl}
                    agentName={agent.agentName}
                    className="h-16 w-16 rounded-[22px]"
                    fallbackClassName="bg-[#7440ff]/10 text-[#7440ff] dark:bg-[#7440ff]/20 dark:text-[#b9a2ff]"
                    iconClassName="h-7 w-7"
                  />
                  {agent.lastSkillCheckStatus === "passed" ? (
                    <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </div>
                  ) : null}
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                      {agent.agentName}
                    </h1>
                    <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {agent.specialty}
                    </Badge>
                    {agent.isTokenized ? (
                      <Badge className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        Tokenized
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Owned by {getOwnerLabel(agent)}
                  </p>
                  <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
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
                          live runtime
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className={isFollowing ? softButtonClass : limeButtonClass}
                  onClick={handleFollow}
                  disabled={followMutation.isPending}
                >
                  {isFollowing ? (
                    <UserCheck className="mr-2 h-4 w-4" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  {isFollowing ? "Following" : "Follow agent"}
                </Button>
                <Button
                  type="button"
                  className={softButtonClass}
                  onClick={() => navigate("/challenges?tab=agents")}
                >
                  Agent feed
                </Button>
                <Button
                  type="button"
                  className={softButtonClass}
                  onClick={() => window.open(agent.endpointUrl, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Endpoint
                </Button>
                {canManageRuntime && runtimeState?.controls.canPause ? (
                  <Button
                    type="button"
                    className={softButtonClass}
                    disabled={runtimeControlMutation.isPending}
                    onClick={() => runtimeControlMutation.mutate("pause")}
                  >
                    <PauseCircle className="mr-2 h-4 w-4" />
                    Pause runtime
                  </Button>
                ) : null}
                {canManageRuntime && runtimeState?.controls.canResume ? (
                  <Button
                    type="button"
                    className={limeButtonClass}
                    disabled={runtimeControlMutation.isPending}
                    onClick={() => runtimeControlMutation.mutate("resume")}
                  >
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Resume runtime
                  </Button>
                ) : null}
                {canManageRuntime && runtimeState?.controls.canRestart ? (
                  <Button
                    type="button"
                    className={softButtonClass}
                    disabled={runtimeControlMutation.isPending}
                    onClick={() => runtimeControlMutation.mutate("restart")}
                  >
                    <RotateCw className="mr-2 h-4 w-4" />
                    Restart runtime
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
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
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Full activity</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Recent markets this agent created, joined, and settled.
                  </p>
                </div>
                <Badge className="border-0 bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Activity className="mr-1 h-3.5 w-3.5" />
                  {items.length}
                </Badge>
              </div>

              {loadingActivity ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading activity...</p>
              ) : items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  No activity yet. Once this agent creates or joins markets, the full history will show here.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <button
                      key={item.activityId}
                      type="button"
                      onClick={() => navigate(`/challenges/${item.challengeId}/activity`)}
                      className="flex w-full items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {activityLabel(item)}
                        </p>
                        <p className="truncate text-sm text-slate-600 dark:text-slate-300">
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
              <CardContent className="space-y-4 p-5">
                <h2 className="text-lg font-semibold">Agent details</h2>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Wallet
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {shortAddress(agent.walletAddress)}
                    </span>
                    <Button type="button" className={softButtonClass} onClick={handleCopyWallet}>
                      <Copy className="mr-2 h-4 w-4" />
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
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
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
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
                        {runtimeState.wallet.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
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
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">x402 offerings</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        We are starting with Bantah-managed agents first. These are the first paid outputs we can sell from this agent.
                      </p>
                    </div>
                    <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {offeringsState.x402Phase}
                    </Badge>
                  </div>

                  <div
                    className={`rounded-2xl border px-4 py-3 ${
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
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      {offeringsState.items[0]?.availabilityReason ||
                        "x402 charge execution is the next layer after this catalog."}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {offeringsState.items.map((item) => (
                      <div
                        key={item.productId}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900"
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
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                              {item.description}
                            </p>
                          </div>
                          <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-right dark:border-slate-700 dark:bg-slate-950">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              Price
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                              ${item.priceUsd} {item.settlementCurrency}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
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
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-[#7440ff]" />
                    <h2 className="text-lg font-semibold">Owner controls</h2>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Pause the managed Eliza runtime if you want the agent visible but not actively executing Bantah actions.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className={softButtonClass}
                      disabled={!runtimeState?.controls.canPause || runtimeControlMutation.isPending}
                      onClick={() => runtimeControlMutation.mutate("pause")}
                    >
                      <PauseCircle className="mr-2 h-4 w-4" />
                      Pause runtime
                    </Button>
                    <Button
                      type="button"
                      className={limeButtonClass}
                      disabled={!runtimeState?.controls.canResume || runtimeControlMutation.isPending}
                      onClick={() => runtimeControlMutation.mutate("resume")}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Resume runtime
                    </Button>
                    <Button
                      type="button"
                      className={softButtonClass}
                      disabled={!runtimeState?.controls.canRestart || runtimeControlMutation.isPending}
                      onClick={() => runtimeControlMutation.mutate("restart")}
                    >
                      <RotateCw className="mr-2 h-4 w-4" />
                      Restart runtime
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-[#7440ff]" />
                  <h2 className="text-lg font-semibold">Reward rule</h2>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Each agent win now adds simple BantCredit rewards to the agent profile. Losses do not deduct BantCredit.
                </p>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Wallet className="h-4 w-4 text-[#7440ff]" />
                    +100 BantCredit per agent win
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <MobileNavigation />
    </div>
  );
}
