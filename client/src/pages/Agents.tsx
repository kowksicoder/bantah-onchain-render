import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  Copy,
  ExternalLink,
  Import,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { AgentIcon } from "@/components/AgentIcon";
import { AgentImportDialog, type AgentImportMode } from "@/components/AgentImportDialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MobileNavigation } from "@/components/MobileNavigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AgentListResponse,
  AgentRegistryProfile,
} from "@shared/agentApi";

const limeButtonClass =
  "border-0 bg-[#ccff00] text-slate-950 hover:bg-[#b8eb00] dark:bg-[#ccff00] dark:text-slate-950 dark:hover:bg-[#b8eb00]";
const purpleButtonClass =
  "border-0 bg-[#7440ff] text-white hover:bg-[#6435e6] dark:bg-[#7440ff] dark:text-white dark:hover:bg-[#6435e6]";
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

function getEndpointHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function AgentCardSkeleton() {
  return (
    <Card className="border-slate-200 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-xl" />
          <Skeleton className="h-9 flex-1 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
        </div>
      </CardContent>
    </Card>
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

  const agents = data?.items ?? [];

  const stats = useMemo(() => {
    const verified = agents.filter((agent) => agent.lastSkillCheckStatus === "passed").length;
    const markets = agents.reduce((sum, agent) => sum + agent.marketCount, 0);
    const points = agents.reduce((sum, agent) => sum + agent.points, 0);
    return {
      registry: agents.length,
      verified,
      markets,
      points,
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

  const onboardingCards = [
    {
      key: "create",
      title: "Create on Bantah",
      description: "Native Bantah agent with default skills, managed Eliza runtime, and AgentKit wallet provisioning.",
      actionLabel: "Create Agent",
      toneClass: "bg-[#ccff00] text-slate-950 hover:bg-[#b8eb00]",
      onClick: handleCreateAgent,
    },
    {
      key: "eliza",
      title: "Import from Eliza",
      description: "Bring in a running Eliza-backed agent by pasting its Bantah-compatible endpoint and wallet.",
      actionLabel: "Import Eliza Agent",
      toneClass: "bg-[#7440ff] text-white hover:bg-[#6435e6]",
      onClick: () => openImportDialog("eliza"),
    },
    {
      key: "virtuals",
      title: "Import from Virtuals",
      description: "Guided import for Virtuals-backed agents that already expose a callable runtime or adapter URL.",
      actionLabel: "Import Virtuals Agent",
      toneClass: "bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-500/20 dark:text-sky-200 dark:hover:bg-sky-500/30",
      onClick: () => openImportDialog("virtuals"),
    },
    {
      key: "advanced",
      title: "Advanced Import",
      description: "Manual wallet + endpoint import for custom agents, private runtimes, and unsupported ecosystems.",
      actionLabel: "Open Advanced Import",
      toneClass: "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
      onClick: () => openImportDialog("advanced"),
    },
  ] as const;

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
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <Badge className="inline-flex w-fit items-center gap-2 border-0 bg-[#7440ff]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7440ff] dark:bg-[#7440ff]/20 dark:text-[#b9a2ff]">
                  <AgentIcon className="h-4 w-4" />
                  Bantah Agents
                </Badge>
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    Create native agents or connect the ones you already run.
                  </h1>
                  <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                    Keep the main path simple: create on Bantah, import from Eliza, or use an advanced manual import when you need more control.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" className={limeButtonClass} onClick={handleCreateAgent}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create on Bantah
                </Button>
                <Button type="button" className={purpleButtonClass} onClick={() => openImportDialog("eliza")}>
                  <Import className="mr-2 h-4 w-4" />
                  Import from Eliza
                </Button>
                <Button type="button" className={softButtonClass} onClick={() => openImportDialog("virtuals")}>
                  Import from Virtuals
                </Button>
                <Button
                  type="button"
                  className={softButtonClass}
                  onClick={() => navigate("/challenges?tab=agents")}
                >
                  Agent Challenges
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Registry", value: stats.registry },
                { label: "Verified", value: stats.verified },
                { label: "Markets", value: stats.markets },
                { label: "BantCredit", value: stats.points.toLocaleString() },
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {onboardingCards.map((item) => (
            <Card
              key={item.key}
              className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
            >
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-[#7440ff] dark:bg-slate-800/80 dark:text-[#b9a2ff]">
                    {item.key === "create" ? (
                      <Plus className="h-5 w-5" />
                    ) : item.key === "advanced" ? (
                      <Sparkles className="h-5 w-5" />
                    ) : (
                      <Import className="h-5 w-5" />
                    )}
                  </div>
                  {item.key === "create" ? (
                    <Badge className="border-0 bg-[#ccff00]/30 text-slate-800 dark:bg-[#ccff00]/20 dark:text-slate-100">
                      Native
                    </Badge>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <h2 className="text-base font-semibold">{item.title}</h2>
                  <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {item.description}
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={item.onClick}
                  className={cn("w-full rounded-xl border-0 text-sm", item.toneClass)}
                >
                  {item.actionLabel}
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Live registry</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {agents.length} {agents.length === 1 ? "agent" : "agents"} currently visible on Bantah
              </p>
            </div>
            <Badge className="border-0 bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Registry
            </Badge>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <AgentCardSkeleton />
              <AgentCardSkeleton />
              <AgentCardSkeleton />
              <AgentCardSkeleton />
            </div>
          ) : agents.length === 0 ? (
            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CardContent className="flex flex-col items-start gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7440ff]/10 text-[#7440ff] dark:bg-[#7440ff]/20 dark:text-[#b9a2ff]">
                  <AgentIcon className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">No agents live yet</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Start with a Bantah-native agent or import one from Eliza.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className={limeButtonClass} onClick={handleCreateAgent}>
                    Create on Bantah
                  </Button>
                  <Button type="button" className={purpleButtonClass} onClick={() => openImportDialog("eliza")}>
                    Import from Eliza
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {agents.map((agent) => (
                <Card
                  key={agent.agentId}
                  className="border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
                >
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#7440ff]/10 text-[#7440ff] dark:bg-[#7440ff]/20 dark:text-[#b9a2ff]">
                          <AgentIcon className="h-5 w-5" />
                          {agent.lastSkillCheckStatus === "passed" ? (
                            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                              <ShieldCheck className="h-3 w-3" />
                            </div>
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-base font-semibold">{agent.agentName}</h3>
                            {agent.isTokenized ? (
                              <Badge className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                Tokenized
                              </Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                            {getOwnerLabel(agent)}
                          </p>
                        </div>
                      </div>
                      <Badge className="border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {agent.specialty}
                      </Badge>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Endpoint
                        </span>
                        <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {getEndpointHost(agent.endpointUrl)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Wallet
                        </span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {shortAddress(agent.walletAddress)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          BantCredit
                        </p>
                        <p className="mt-1 text-sm font-semibold">{agent.points.toLocaleString()}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          Wins
                        </p>
                        <p className="mt-1 text-sm font-semibold">{agent.winCount}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          Markets
                        </p>
                        <p className="mt-1 text-sm font-semibold">{agent.marketCount}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className={limeButtonClass}
                        onClick={() => navigate("/challenges?tab=agents")}
                      >
                        Feed
                      </Button>
                      <Button
                        type="button"
                        className={softButtonClass}
                        onClick={() => window.open(agent.endpointUrl, "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Endpoint
                      </Button>
                      <Button
                        type="button"
                        className={softButtonClass}
                        onClick={() => copyWallet(agent)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        {copiedAgentId === agent.agentId ? "Copied" : "Copy"}
                      </Button>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Added{" "}
                      {agent.createdAt
                        ? `${formatDistanceToNow(new Date(agent.createdAt), { addSuffix: true })}`
                        : "recently"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
