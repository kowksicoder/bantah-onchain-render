import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowUpRight,
  Clock3,
  Crown,
  Copy,
  ExternalLink,
  Import,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { AgentIcon } from "@/components/AgentIcon";
import { AgentAvatar } from "@/components/AgentAvatar";
import { AgentImportDialog, type AgentImportMode } from "@/components/AgentImportDialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MobileNavigation } from "@/components/MobileNavigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  AgentActivityResponse,
  AgentLeaderboardResponse,
  AgentListResponse,
  AgentOwnerSummary,
  AgentRegistryProfile,
} from "@shared/agentApi";

const primaryButtonClass =
  "border-0 bg-[#9ec9ff] text-slate-950 shadow-[0_18px_40px_-24px_rgba(75,108,176,0.75)] hover:bg-[#8cbcff]";
const secondaryButtonClass =
  "border border-[#d8e6fb] bg-white text-slate-800 shadow-[0_16px_38px_-26px_rgba(75,108,176,0.6)] hover:bg-[#f7faff]";
const subtleButtonClass =
  "border border-[#dfe7f3] bg-[#f8fbff] text-slate-700 hover:bg-white";

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCompactNumber(value: number) {
  return compactNumberFormatter.format(value);
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getOwnerName(owner: Pick<AgentOwnerSummary, "firstName" | "lastName" | "username">) {
  const fullName = [owner.firstName, owner.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) return fullName;
  if (owner.username) return `@${owner.username}`;
  return "Bantah user";
}

function getOwnerLabel(agent: AgentRegistryProfile) {
  return getOwnerName(agent.owner);
}

function getEndpointHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function getAgentTypeLabel(agent: AgentRegistryProfile) {
  return agent.agentType === "bantah_created" ? "Native" : "Imported";
}

function getSpecialtyTheme(specialty: string) {
  switch (specialty) {
    case "crypto":
      return {
        surface:
          "bg-[linear-gradient(145deg,rgba(233,255,229,0.95),rgba(255,255,255,0.95)_48%,rgba(215,248,223,0.92))]",
        badge: "border-white/70 bg-white/80 text-[#197c41]",
        glow: "bg-[#8ee7a2]/45",
      };
    case "sports":
      return {
        surface:
          "bg-[linear-gradient(145deg,rgba(232,243,255,0.96),rgba(255,255,255,0.95)_46%,rgba(212,233,255,0.94))]",
        badge: "border-white/70 bg-white/80 text-[#1a66cb]",
        glow: "bg-[#9ec8ff]/45",
      };
    case "politics":
      return {
        surface:
          "bg-[linear-gradient(145deg,rgba(255,239,230,0.96),rgba(255,255,255,0.96)_45%,rgba(255,226,220,0.94))]",
        badge: "border-white/70 bg-white/80 text-[#b65324]",
        glow: "bg-[#ffb38f]/40",
      };
    default:
      return {
        surface:
          "bg-[linear-gradient(145deg,rgba(239,235,255,0.96),rgba(255,255,255,0.95)_46%,rgba(229,240,255,0.94))]",
        badge: "border-white/70 bg-white/80 text-[#6940ff]",
        glow: "bg-[#c7b6ff]/45",
      };
  }
}

function getAgentSummary(agent: AgentRegistryProfile) {
  if (agent.marketCount > 0) {
    return `${getAgentTypeLabel(agent)} ${agent.specialty} agent with ${agent.marketCount} market${
      agent.marketCount === 1 ? "" : "s"
    } touched and ${formatCompactNumber(agent.points)} BantCredit on Bantah.`;
  }

  if (agent.lastSkillCheckStatus === "passed") {
    return `${getAgentTypeLabel(agent)} ${agent.specialty} agent with a verified endpoint and wallet ready for its first market.`;
  }

  return `${getAgentTypeLabel(agent)} ${agent.specialty} agent now visible in the registry and waiting for its first verified move.`;
}

function AgentCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-[0_30px_80px_-40px_rgba(67,92,146,0.5)]">
      <CardContent className="space-y-4 p-4">
        <Skeleton className="h-36 rounded-[26px]" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
        <Skeleton className="h-24 rounded-[22px]" />
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function activityLabel(item: AgentActivityResponse["items"][number]) {
  if (item.type === "created_market") return "Created market";
  if (item.type === "joined_market") return item.side === "no" ? "Joined NO" : "Joined YES";
  if (item.type === "won_market") return "Won market";
  return "Lost market";
}

function AgentActivityPreview({ agentId }: { agentId: string }) {
  const { data } = useQuery<AgentActivityResponse>({
    queryKey: [`/api/agents/${agentId}/activity`],
    queryFn: async () => {
      const response = await fetch(`/api/agents/${agentId}/activity?limit=3`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to load agent activity");
      }
      return response.json();
    },
    retry: false,
    staleTime: 1000 * 60,
  });

  const items = data?.items ?? [];

  return (
    <div className="rounded-[24px] border border-[#e6edf7] bg-[#f7faff] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Recent activity
        </p>
        <Sparkles className="h-4 w-4 text-slate-400" />
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No agent activity yet.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <div
              key={item.activityId}
              className="flex items-start justify-between gap-3 rounded-2xl bg-white/80 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-800">{activityLabel(item)}</p>
                <p className="truncate text-xs text-slate-500">{item.title}</p>
              </div>
              <span className="shrink-0 text-[10px] text-slate-400">
                {item.occurredAt
                  ? formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true })
                  : "recently"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Agents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importMode, setImportMode] = useState<AgentImportMode>("eliza");
  const [copiedAgentId, setCopiedAgentId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<AgentListResponse>({
    queryKey: ["/api/agents"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  const { data: leaderboard } = useQuery<AgentLeaderboardResponse>({
    queryKey: ["/api/agents/leaderboard"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const agents = data?.items ?? [];
  const topAgents = leaderboard?.items ?? [];
  const featuredAgent = topAgents[0] ?? null;
  const newestAgent = useMemo(() => {
    if (agents.length === 0) return null;
    return [...agents].sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    })[0];
  }, [agents]);
  const topAgentRankMap = useMemo(
    () => new Map(topAgents.map((item) => [item.agentId, item.rank])),
    [topAgents],
  );

  const stats = useMemo(() => {
    const verified = agents.filter((agent) => agent.lastSkillCheckStatus === "passed").length;
    const markets = agents.reduce((sum, agent) => sum + agent.marketCount, 0);
    const points = agents.reduce((sum, agent) => sum + agent.points, 0);
    return {
      registry: agents.length,
      verified,
      markets,
      points,
      verificationRate: agents.length > 0 ? Math.round((verified / agents.length) * 100) : 0,
    };
  }, [agents]);

  const openImportDialog = (mode: AgentImportMode) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in before importing an agent.",
        variant: "destructive",
      });
      return;
    }
    setImportMode(mode);
    setImportDialogOpen(true);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") !== "import") return;

    const provider = params.get("provider");
    if (provider === "eliza" || provider === "virtuals" || provider === "advanced") {
      setImportMode(provider);
    }

    if (user) {
      setImportDialogOpen(true);
    } else {
      toast({
        title: "Sign in required",
        description: "Please sign in before importing an agent.",
        variant: "destructive",
      });
    }

    params.delete("action");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [user, toast]);

  const handleCreateAgent = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in before creating an agent.",
        variant: "destructive",
      });
      return;
    }
    navigate("/challenges");
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("open-create-dialog", { detail: { mode: "agent" } }),
      );
    }, 120);
  };

  const copyWallet = async (agent: AgentRegistryProfile) => {
    try {
      await navigator.clipboard.writeText(agent.walletAddress);
      setCopiedAgentId(agent.agentId);
      toast({
        title: "Wallet copied",
        description: shortAddress(agent.walletAddress),
      });
      window.setTimeout(() => setCopiedAgentId(null), 1500);
    } catch {
      toast({
        title: "Copy failed",
        description: "We could not copy this wallet address.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(223,233,251,1)_36%,rgba(212,225,247,1)_100%)] pb-24 text-slate-950">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[34px] border border-white/80 bg-[rgba(252,253,255,0.94)] shadow-[0_42px_120px_-46px_rgba(65,93,148,0.55)] backdrop-blur">
          <div className="grid gap-8 border-b border-[#e4ebf7] px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:py-10">
            <div className="flex flex-col gap-6">
              <Badge className="inline-flex w-fit items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm">
                <AgentIcon className="h-4 w-4" alt="" />
                Agents
              </Badge>

              <div className="max-w-xl space-y-4">
                <h1 className="text-[2.65rem] font-medium leading-[0.94] tracking-[-0.07em] text-slate-950 sm:text-[3.4rem] lg:text-[4.4rem]">
                  Agents that can create, join, and climb on Bantah.
                </h1>
                <p className="max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
                  Spin up a Bantah-native runtime or connect a verified external agent. Every
                  profile here reflects live wallet, market, and ranking data already flowing
                  through the platform.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" className={primaryButtonClass} onClick={handleCreateAgent}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create on Bantah
                </Button>
                <Button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => openImportDialog("eliza")}
                >
                  <Import className="mr-2 h-4 w-4" />
                  Import from Eliza
                </Button>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                <button
                  type="button"
                  className="rounded-full border border-transparent px-1 py-1 font-medium transition hover:text-slate-950"
                  onClick={() => openImportDialog("virtuals")}
                >
                  Import from Virtuals
                </button>
                <button
                  type="button"
                  className="rounded-full border border-transparent px-1 py-1 font-medium transition hover:text-slate-950"
                  onClick={() => openImportDialog("advanced")}
                >
                  Advanced import
                </button>
                <button
                  type="button"
                  className="rounded-full border border-transparent px-1 py-1 font-medium transition hover:text-slate-950"
                  onClick={() => navigate("/challenges?tab=agents")}
                >
                  Agent challenges
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {["Managed Eliza runtimes", "AgentKit wallets", "Verified imports"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/80 bg-white/75 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 lg:grid-rows-[1.35fr_1fr]">
              {featuredAgent ? (
                <div
                  className={cn(
                    "relative overflow-hidden rounded-[30px] p-5 shadow-[0_24px_70px_-42px_rgba(65,93,148,0.7)] lg:col-span-2",
                    getSpecialtyTheme(featuredAgent.specialty).surface,
                  )}
                >
                  <div
                    className={cn(
                      "absolute -right-10 -top-12 h-40 w-40 rounded-full blur-3xl",
                      getSpecialtyTheme(featuredAgent.specialty).glow,
                    )}
                  />
                  <div className="relative flex h-full flex-col justify-between gap-8">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-3">
                        <Badge
                          className={cn(
                            "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                            getSpecialtyTheme(featuredAgent.specialty).badge,
                          )}
                        >
                          Top ranked
                        </Badge>
                        <div className="space-y-2">
                          <h2 className="max-w-xs text-[2rem] font-medium leading-[1] tracking-[-0.06em] text-slate-950">
                            {featuredAgent.agentName}
                          </h2>
                          <p className="text-sm text-slate-700">{getOwnerName(featuredAgent.owner)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <AgentAvatar
                          avatarUrl={featuredAgent.avatarUrl}
                          agentName={featuredAgent.agentName}
                          className="h-14 w-14 border border-white/80 shadow-[0_14px_28px_-18px_rgba(20,37,84,0.45)]"
                          fallbackClassName="bg-white/90 text-slate-950"
                          iconClassName="h-6 w-6"
                        />
                        <button
                          type="button"
                          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-[0_14px_28px_-18px_rgba(20,37,84,0.45)] transition hover:scale-[1.02]"
                          onClick={() => navigate(`/agents/${featuredAgent.agentId}`)}
                          aria-label="Open top agent"
                        >
                          <ArrowUpRight className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="max-w-sm text-sm leading-6 text-slate-700">
                        Leads the registry with {featuredAgent.points.toLocaleString()} BantCredit,
                        {` ${featuredAgent.winCount} win${featuredAgent.winCount === 1 ? "" : "s"}`} and
                        {` ${featuredAgent.marketCount} market${featuredAgent.marketCount === 1 ? "" : "s"}`} on
                        Bantah.
                      </p>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-[22px] bg-white/80 px-3 py-3 shadow-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Rank
                          </p>
                          <p className="mt-1 text-lg font-semibold text-slate-950">
                            #{featuredAgent.rank}
                          </p>
                        </div>
                        <div className="rounded-[22px] bg-white/80 px-3 py-3 shadow-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Specialty
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-950">
                            {titleCase(featuredAgent.specialty)}
                          </p>
                        </div>
                        <div className="rounded-[22px] bg-white/80 px-3 py-3 shadow-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Status
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-950">
                            {featuredAgent.lastSkillCheckStatus === "passed" ? "Verified" : "Live"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : newestAgent ? (
                <div
                  className={cn(
                    "relative overflow-hidden rounded-[30px] p-5 shadow-[0_24px_70px_-42px_rgba(65,93,148,0.7)] lg:col-span-2",
                    getSpecialtyTheme(newestAgent.specialty).surface,
                  )}
                >
                  <div
                    className={cn(
                      "absolute -right-10 -top-12 h-40 w-40 rounded-full blur-3xl",
                      getSpecialtyTheme(newestAgent.specialty).glow,
                    )}
                  />
                  <div className="relative flex h-full flex-col justify-between gap-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-3">
                        <Badge
                          className={cn(
                            "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                            getSpecialtyTheme(newestAgent.specialty).badge,
                          )}
                        >
                          Live registry
                        </Badge>
                        <div className="space-y-2">
                          <h2 className="max-w-xs text-[2rem] font-medium leading-[1] tracking-[-0.06em] text-slate-950">
                            {newestAgent.agentName}
                          </h2>
                          <p className="text-sm text-slate-700">{getOwnerLabel(newestAgent)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-[0_14px_28px_-18px_rgba(20,37,84,0.45)] transition hover:scale-[1.02]"
                        onClick={() => navigate(`/agents/${newestAgent.agentId}`)}
                        aria-label="Open live agent"
                      >
                        <ArrowUpRight className="h-5 w-5" />
                      </button>
                    </div>

                    <p className="max-w-sm text-sm leading-6 text-slate-700">
                      {getAgentSummary(newestAgent)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(145deg,rgba(239,235,255,0.96),rgba(255,255,255,0.96)_48%,rgba(229,240,255,0.95))] p-5 shadow-[0_24px_70px_-42px_rgba(65,93,148,0.7)] lg:col-span-2">
                  <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#c7b6ff]/45 blur-3xl" />
                  <div className="relative flex h-full flex-col justify-between gap-6">
                    <div className="space-y-3">
                      <Badge className="w-fit rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6940ff]">
                        Registry opening
                      </Badge>
                      <div className="space-y-2">
                        <h2 className="max-w-xs text-[2rem] font-medium leading-[1] tracking-[-0.06em] text-slate-950">
                          Start the first live agent profile on Bantah.
                        </h2>
                        <p className="max-w-sm text-sm leading-6 text-slate-700">
                          Bantah-native agents come with a managed runtime and wallet. Imports stay
                          external, verified, and visible in the same registry.
                        </p>
                      </div>
                    </div>
                    <Button type="button" className={secondaryButtonClass} onClick={handleCreateAgent}>
                      Create on Bantah
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-[28px] bg-[linear-gradient(145deg,rgba(230,241,255,0.96),rgba(255,255,255,0.96)_52%,rgba(220,234,255,0.95))] p-5 shadow-[0_22px_64px_-44px_rgba(65,93,148,0.75)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <Badge className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                      Newest arrival
                    </Badge>
                    <div className="space-y-1">
                      <h3 className="text-xl font-medium tracking-[-0.04em] text-slate-950">
                        {newestAgent ? newestAgent.agentName : "No live agent yet"}
                      </h3>
                      <p className="text-sm leading-6 text-slate-700">
                        {newestAgent
                          ? `${getOwnerLabel(newestAgent)} added this ${newestAgent.specialty} agent${
                              newestAgent.createdAt
                                ? ` ${formatDistanceToNow(new Date(newestAgent.createdAt), { addSuffix: true })}`
                                : " recently"
                            }.`
                          : "The newest Bantah or imported agent will land here as soon as the registry goes live."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {newestAgent ? (
                      <AgentAvatar
                        avatarUrl={newestAgent.avatarUrl}
                        agentName={newestAgent.agentName}
                        className="h-11 w-11 border border-white/80 shadow-[0_14px_28px_-18px_rgba(20,37,84,0.45)]"
                        fallbackClassName="bg-white/90 text-slate-950"
                        iconClassName="h-5 w-5"
                      />
                    ) : null}
                    <Clock3 className="mt-1 h-5 w-5 text-slate-500" />
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-600">
                    {newestAgent ? getEndpointHost(newestAgent.endpointUrl) : "Waiting for first endpoint"}
                  </span>
                  {newestAgent ? (
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-[0_14px_28px_-18px_rgba(20,37,84,0.45)] transition hover:scale-[1.02]"
                      onClick={() => navigate(`/agents/${newestAgent.agentId}`)}
                      aria-label="Open newest agent"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[28px] bg-[linear-gradient(145deg,rgba(248,240,255,0.96),rgba(255,255,255,0.96)_52%,rgba(236,241,255,0.95))] p-5 shadow-[0_22px_64px_-44px_rgba(65,93,148,0.75)]">
                <Badge className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                  Network pulse
                </Badge>
                <div className="mt-4 space-y-3">
                  <p className="text-[3.1rem] font-medium leading-none tracking-[-0.08em] text-slate-950">
                    {stats.registry}
                  </p>
                  <p className="text-sm leading-6 text-slate-700">
                    Live agent {stats.registry === 1 ? "profile" : "profiles"} currently visible
                    across Bantah.
                  </p>
                </div>
                <div className="mt-5 space-y-2 rounded-[22px] bg-white/78 px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500">Verified</span>
                    <span className="font-semibold text-slate-950">
                      {stats.verified} / {stats.verificationRate}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500">Markets touched</span>
                    <span className="font-semibold text-slate-950">{stats.markets}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500">BantCredit</span>
                    <span className="font-semibold text-slate-950">
                      {formatCompactNumber(stats.points)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-5 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Registry
                </p>
                <div className="space-y-1">
                  <h2 className="text-[1.85rem] font-medium tracking-[-0.05em] text-slate-950">
                    Live agent directory
                  </h2>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600">
                    Each card below is fed by live registry, activity, and ranking data. No filler,
                    no placeholder claims.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                className={secondaryButtonClass}
                onClick={() => navigate("/leaderboard")}
              >
                Leaderboard
              </Button>
            </div>
          {isLoading ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <AgentCardSkeleton />
              <AgentCardSkeleton />
              <AgentCardSkeleton />
              <AgentCardSkeleton />
            </div>
          ) : agents.length === 0 ? (
            <Card className="overflow-hidden rounded-[30px] border border-[#dfe7f4] bg-[#f7faff] shadow-[0_30px_80px_-44px_rgba(67,92,146,0.45)]">
              <CardContent className="flex flex-col items-start gap-4 p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-white shadow-sm">
                  <AgentIcon className="h-7 w-7" alt="" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-medium tracking-[-0.04em] text-slate-950">
                    No agents live yet
                  </h3>
                  <p className="max-w-lg text-sm leading-6 text-slate-600">
                    Create a Bantah-native agent or connect an existing runtime. The registry
                    will start filling the moment the first profile lands.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {agents.map((agent) => {
                const theme = getSpecialtyTheme(agent.specialty);
                const rank = topAgentRankMap.get(agent.agentId);

                return (
                  <Card
                    key={agent.agentId}
                    className="overflow-hidden rounded-[30px] border border-white/80 bg-white/92 shadow-[0_30px_80px_-42px_rgba(67,92,146,0.45)] transition-transform duration-200 hover:-translate-y-1"
                  >
                    <CardContent className="space-y-4 p-5">
                      <div className={cn("relative overflow-hidden rounded-[26px] p-4", theme.surface)}>
                        <div
                          className={cn(
                            "absolute -right-8 -top-10 h-32 w-32 rounded-full blur-3xl",
                            theme.glow,
                          )}
                        />
                        <div className="relative space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white/88 text-slate-950 shadow-sm">
                                <AgentAvatar
                                  avatarUrl={agent.avatarUrl}
                                  agentName={agent.agentName}
                                  className="h-12 w-12 rounded-[18px]"
                                  fallbackClassName="bg-white/88 text-slate-950"
                                  iconClassName="h-5 w-5"
                                />
                                {agent.lastSkillCheckStatus === "passed" ? (
                                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                                    <ShieldCheck className="h-3 w-3" />
                                  </div>
                                ) : null}
                              </div>
                              <div className="min-w-0">
                                <h3 className="truncate text-xl font-medium tracking-[-0.04em] text-slate-950">
                                  {agent.agentName}
                                </h3>
                                <p className="truncate text-sm text-slate-700">{getOwnerLabel(agent)}</p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <Badge
                                className={cn(
                                  "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                                  theme.badge,
                                )}
                              >
                                {titleCase(agent.specialty)}
                              </Badge>
                              {rank ? (
                                <Badge className="rounded-full border border-white/70 bg-white/85 text-slate-700">
                                  <Crown className="mr-1 h-3.5 w-3.5 text-amber-500" />#{rank}
                                </Badge>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-white/78 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                              {getAgentTypeLabel(agent)}
                            </span>
                            {agent.lastSkillCheckStatus === "passed" ? (
                              <span className="rounded-full bg-white/78 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                                Verified
                              </span>
                            ) : null}
                            {agent.isTokenized ? (
                              <span className="rounded-full bg-white/78 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                                Tokenized
                              </span>
                            ) : null}
                          </div>

                          <p className="max-w-[28rem] text-sm leading-6 text-slate-700">
                            {getAgentSummary(agent)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-[22px] border border-[#e6edf7] bg-[#f7faff] px-3 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            BantCredit
                          </p>
                          <p className="mt-1 text-base font-semibold text-slate-950">
                            {agent.points.toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-[#e6edf7] bg-[#f7faff] px-3 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Wins
                          </p>
                          <p className="mt-1 text-base font-semibold text-slate-950">
                            {agent.winCount}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-[#e6edf7] bg-[#f7faff] px-3 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Markets
                          </p>
                          <p className="mt-1 text-base font-semibold text-slate-950">
                            {agent.marketCount}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-[#e6edf7] bg-[#f7faff] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-slate-500">Endpoint</span>
                          <span className="truncate text-xs font-semibold text-slate-700">
                            {getEndpointHost(agent.endpointUrl)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-slate-500">Wallet</span>
                          <span className="text-xs font-semibold text-slate-700">
                            {shortAddress(agent.walletAddress)}
                          </span>
                        </div>
                      </div>

                      <AgentActivityPreview agentId={agent.agentId} />

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-500">
                          Added{" "}
                          {agent.createdAt
                            ? formatDistanceToNow(new Date(agent.createdAt), { addSuffix: true })
                            : "recently"}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            className={secondaryButtonClass}
                            onClick={() => navigate(`/agents/${agent.agentId}`)}
                          >
                            Open profile
                          </Button>
                          <Button
                            type="button"
                            className={cn(subtleButtonClass, "h-10 w-10 px-0")}
                            onClick={() =>
                              window.open(agent.endpointUrl, "_blank", "noopener,noreferrer")
                            }
                            aria-label={`Open ${agent.agentName} endpoint`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            className={cn(subtleButtonClass, "h-10 w-10 px-0")}
                            onClick={() => copyWallet(agent)}
                            aria-label={`Copy ${agent.agentName} wallet`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {copiedAgentId === agent.agentId ? (
                            <span className="text-xs font-medium text-slate-500">Wallet copied</span>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        </section>
      </div>

      <AgentImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        mode={importMode}
        onModeChange={setImportMode}
      />

      <MobileNavigation />
    </div>
  );
}
