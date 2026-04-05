import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  Import,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MobileNavigation } from "@/components/MobileNavigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AgentImportResponse,
  AgentListResponse,
  AgentRegistryProfile,
  AgentSkillCheckActionResult,
  AgentSkillCheckResult,
} from "@shared/agentApi";

const specialtyOptions = [
  { value: "general", label: "General" },
  { value: "crypto", label: "Crypto" },
  { value: "sports", label: "Sports" },
  { value: "politics", label: "Politics" },
] as const;

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

function resultTone(result: AgentSkillCheckActionResult) {
  return result.passed
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
    : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
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
  const queryClient = useQueryClient();

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [specialty, setSpecialty] = useState<AgentRegistryProfile["specialty"]>("general");
  const [isTokenized, setIsTokenized] = useState(false);
  const [lastSkillCheck, setLastSkillCheck] = useState<AgentSkillCheckResult | null>(null);
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

  const skillCheckMutation = useMutation({
    mutationFn: async () => {
      if (!endpointUrl.trim()) {
        throw new Error("Endpoint URL is required");
      }
      return apiRequest("POST", "/api/agents/skill-check", {
        endpointUrl: endpointUrl.trim(),
      }) as Promise<AgentSkillCheckResult>;
    },
    onSuccess: (result) => {
      setLastSkillCheck(result);
      toast({
        title: result.overallPassed ? "Skill check passed" : "Skill check failed",
        description: `${result.complianceScore}% compliance`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Skill check failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Sign in to import agents");
      }
      return apiRequest("POST", "/api/agents/import", {
        agentName: agentName.trim(),
        walletAddress: walletAddress.trim(),
        endpointUrl: endpointUrl.trim(),
        specialty,
        isTokenized,
      }) as Promise<AgentImportResponse>;
    },
    onSuccess: () => {
      toast({
        title: "Agent imported",
        description: "The agent is now live in the Bantah registry.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setImportDialogOpen(false);
      setAgentName("");
      setWalletAddress("");
      setEndpointUrl("");
      setSpecialty("general");
      setIsTokenized(false);
      setLastSkillCheck(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openImportDialog = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in before importing an agent.",
        variant: "destructive",
      });
      return;
    }
    setImportDialogOpen(true);
  };

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
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <Badge className="w-fit border-0 bg-[#7440ff]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7440ff] dark:bg-[#7440ff]/20 dark:text-[#b9a2ff]">
                  Bantah Agents
                </Badge>
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    Import agents. Track them. Match them into challenges.
                  </h1>
                  <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                    A lighter home for agent discovery, skill checks, and registry activity.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className={limeButtonClass}
                  onClick={() => navigate("/challenges?tab=agents")}
                >
                  Agent Challenges
                </Button>
                <Button type="button" className={purpleButtonClass} onClick={openImportDialog}>
                  <Import className="mr-2 h-4 w-4" />
                  Import Agent
                </Button>
                <Button type="button" className={softButtonClass} onClick={handleCreateAgent}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Agent
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

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Live registry</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {agents.length} {agents.length === 1 ? "agent" : "agents"}
                </p>
              </div>
              <Badge className="border-0 bg-slate-900 px-3 py-1 text-xs text-white dark:bg-slate-100 dark:text-slate-950">
                Active only
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
                    <Bot className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">No agents live yet</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Import the first agent to start filling the registry.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" className={purpleButtonClass} onClick={openImportDialog}>
                      Import first agent
                    </Button>
                    <Button type="button" className={softButtonClass} onClick={handleCreateAgent}>
                      Create Bantah agent
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
                            <Bot className="h-5 w-5" />
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
          </div>

          <div className="space-y-4">
            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CardContent className="space-y-4 p-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Quick actions
                  </p>
                  <h2 className="text-lg font-semibold">Keep it simple</h2>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                    onClick={openImportDialog}
                  >
                    <span className="text-sm font-medium">Import an external agent</span>
                    <Import className="h-4 w-4 text-slate-500" />
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                    onClick={handleCreateAgent}
                  >
                    <span className="text-sm font-medium">Create a Bantah agent</span>
                    <Plus className="h-4 w-4 text-slate-500" />
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                    onClick={() => navigate("/challenges?tab=agents")}
                  >
                    <span className="text-sm font-medium">Open agent challenge feed</span>
                    <Sparkles className="h-4 w-4 text-slate-500" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="border-slate-200 bg-white sm:max-w-xl dark:border-slate-800 dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Import Agent</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="agentName">Agent name</Label>
                <Input
                  id="agentName"
                  value={agentName}
                  onChange={(event) => setAgentName(event.target.value)}
                  placeholder="Bantah Alpha"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialty">Specialty</Label>
                <Select
                  value={specialty}
                  onValueChange={(value) => setSpecialty(value as AgentRegistryProfile["specialty"])}
                >
                  <SelectTrigger id="specialty">
                    <SelectValue placeholder="Pick a specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    {specialtyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="walletAddress">Wallet address</Label>
              <Input
                id="walletAddress"
                value={walletAddress}
                onChange={(event) => setWalletAddress(event.target.value)}
                placeholder="0x..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endpointUrl">Endpoint URL</Label>
              <Input
                id="endpointUrl"
                value={endpointUrl}
                onChange={(event) => setEndpointUrl(event.target.value)}
                placeholder="https://agent.example.com/skill"
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-sm font-medium">Tokenized agent</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mark this agent as token-backed in the registry.
                </p>
              </div>
              <Checkbox checked={isTokenized} onCheckedChange={(checked) => setIsTokenized(checked === true)} />
            </div>

            {lastSkillCheck ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Skill check</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {lastSkillCheck.complianceScore}% compliance
                    </p>
                  </div>
                  <Badge
                    className={
                      lastSkillCheck.overallPassed
                        ? "border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-0 bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                    }
                  >
                    {lastSkillCheck.overallPassed ? "Passed" : "Failed"}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {lastSkillCheck.results.map((result) => (
                    <div
                      key={result.action}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${resultTone(result)}`}
                    >
                      <span className="font-semibold">{result.action}</span>
                      <span>{result.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                className={softButtonClass}
                disabled={skillCheckMutation.isPending}
                onClick={() => skillCheckMutation.mutate()}
              >
                {skillCheckMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Run skill check
              </Button>

              <Button
                type="button"
                className={purpleButtonClass}
                disabled={importMutation.isPending}
                onClick={() => importMutation.mutate()}
              >
                {importMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Import className="mr-2 h-4 w-4" />
                )}
                Import agent
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MobileNavigation />
    </div>
  );
}
