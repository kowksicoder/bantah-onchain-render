import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Import, Loader2, Sparkles } from "lucide-react";

import { AgentIcon } from "@/components/AgentIcon";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { agentSpecialtyOptions, getAgentSpecialtyMeta } from "@/lib/agentSpecialty";
import { apiRequest, setAuthToken } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AgentImportResponse,
  AgentListResponse,
  AgentRegistryProfile,
  AgentSkillCheckActionResult,
  AgentSkillCheckResult,
} from "@shared/agentApi";

export type AgentImportMode = "eliza" | "virtuals" | "advanced";

type AgentImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AgentImportMode;
  onModeChange?: (mode: AgentImportMode) => void;
  initialName?: string;
  initialSpecialty?: AgentRegistryProfile["specialty"];
  onImported?: (result: AgentImportResponse) => void;
};

const modeMeta: Record<
  AgentImportMode,
  {
    title: string;
    kicker: string;
    helper: string;
    endpointLabel: string;
    endpointPlaceholder: string;
    walletHint: string;
    showTokenized: boolean;
  }
> = {
  eliza: {
    title: "Import from Eliza",
    kicker: "Best for hosted or self-run Eliza agents.",
    helper:
      "Paste the Bantah-compatible endpoint in front of your Eliza runtime. Bantah will verify the skills and register the agent.",
    endpointLabel: "Eliza endpoint",
    endpointPlaceholder: "https://alpha.example.com/api/bantah",
    walletHint: "Use the wallet attached to the Eliza agent runtime.",
    showTokenized: false,
  },
  virtuals: {
    title: "Import from Virtuals",
    kicker: "For Virtuals-backed agents that already expose a callable runtime.",
    helper:
      "A token or listing alone is not enough. Bantah needs a runtime or adapter URL it can call for market actions.",
    endpointLabel: "Runtime or adapter URL",
    endpointPlaceholder: "https://adapter.example.com/virtuals/agent",
    walletHint: "Use the wallet that the executable agent will operate from.",
    showTokenized: true,
  },
  advanced: {
    title: "Advanced import",
    kicker: "Manual wallet + endpoint import for custom runtimes.",
    helper:
      "Use this if your agent does not fit the guided Eliza or Virtuals flows. Bantah will still run the same skill check before import.",
    endpointLabel: "Endpoint URL",
    endpointPlaceholder: "https://agent.example.com/skill",
    walletHint: "Any EVM wallet is fine as long as this runtime actually uses it.",
    showTokenized: true,
  },
};

function isValidEvmAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function normalizeEndpointUrlInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^localhost[:/]/i.test(trimmed) || /^127\.0\.0\.1[:/]/.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

function looksLikeValidEndpointUrl(value: string) {
  const normalized = normalizeEndpointUrlInput(value);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function resultTone(result: AgentSkillCheckActionResult) {
  return result.passed
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
    : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
}

export function AgentImportDialog({
  open,
  onOpenChange,
  mode,
  onModeChange,
  initialName,
  initialSpecialty = "general",
  onImported,
}: AgentImportDialogProps) {
  const { isAuthenticated, isLoading: authLoading, login, getAccessToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [agentName, setAgentName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [specialty, setSpecialty] = useState<AgentRegistryProfile["specialty"]>("general");
  const [isTokenized, setIsTokenized] = useState(false);
  const [lastSkillCheck, setLastSkillCheck] = useState<AgentSkillCheckResult | null>(null);

  const currentModeMeta = useMemo(() => modeMeta[mode], [mode]);
  const canCheckEndpoint = looksLikeValidEndpointUrl(endpointUrl);
  const canImportAgent =
    agentName.trim().length > 0 &&
    canCheckEndpoint &&
    isValidEvmAddress(walletAddress) &&
    !importMutation.isPending;

  const resetForm = () => {
    setAgentName(initialName?.trim() || "");
    setWalletAddress("");
    setEndpointUrl("");
    setSpecialty(initialSpecialty);
    setIsTokenized(mode === "virtuals");
    setLastSkillCheck(null);
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open, initialName, initialSpecialty, mode]);

  const ensureFreshAuthToken = async (): Promise<string | null> => {
    if (!getAccessToken) return null;

    try {
      const token = await getAccessToken();
      if (token) {
        setAuthToken(token);
        return token;
      }
    } catch (error) {
      console.error("Failed to refresh auth token for agent import:", error);
    }

    return null;
  };

  const skillCheckMutation = useMutation({
    mutationFn: async () => {
      const endpoint = normalizeEndpointUrlInput(endpointUrl);
      if (!endpoint) {
        throw new Error("Endpoint URL is required");
      }

      return apiRequest("POST", "/api/agents/skill-check", {
        endpointUrl: endpoint,
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
      if (!isAuthenticated || authLoading) {
        throw new Error("Sign in to import agents");
      }

      const normalizedAgentName = agentName.trim();
      const normalizedWalletAddress = walletAddress.trim();
      const normalizedEndpointUrl = normalizeEndpointUrlInput(endpointUrl);

      if (!normalizedAgentName) {
        throw new Error("Agent name is required");
      }
      if (!normalizedEndpointUrl) {
        throw new Error("Endpoint URL is required");
      }
      if (!isValidEvmAddress(normalizedWalletAddress)) {
        throw new Error("Wallet address must be a valid EVM address");
      }

      await ensureFreshAuthToken();

      return apiRequest("POST", "/api/agents/import", {
        agentName: normalizedAgentName,
        walletAddress: normalizedWalletAddress,
        endpointUrl: normalizedEndpointUrl,
        specialty,
        isTokenized,
      }) as Promise<AgentImportResponse>;
    },
    onSuccess: (result) => {
      const nextAgent = result.agent;
      queryClient.setQueryData<AgentListResponse | undefined>(["/api/agents"], (existing) => {
        if (!existing) {
          return {
            items: [nextAgent],
            pagination: {
              page: 1,
              limit: 20,
              total: 1,
              totalPages: 1,
            },
          };
        }

        const deduped = [
          nextAgent,
          ...existing.items.filter((agent) => agent.agentId !== nextAgent.agentId),
        ];

        return {
          ...existing,
          items: deduped,
          pagination: {
            ...existing.pagination,
            total: Math.max(existing.pagination.total, deduped.length),
            totalPages: Math.max(
              existing.pagination.totalPages,
              Math.ceil(Math.max(existing.pagination.total, deduped.length) / existing.pagination.limit),
            ),
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agent imported",
        description: "The agent is now live in the Bantah registry.",
      });
      onOpenChange(false);
      onImported?.(result);
    },
    onError: (error: Error) => {
      if (String(error.message || "").toLowerCase().includes("sign in")) {
        login();
        return;
      }

      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openGuarded = (nextOpen: boolean) => {
    if (nextOpen && (!isAuthenticated || authLoading)) {
      toast({
        title: "Sign in required",
        description: "Please sign in before importing an agent.",
        variant: "destructive",
      });
      login();
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={openGuarded}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] top-auto bottom-3 translate-y-0 rounded-[24px] border-0 bg-white p-3 pb-4 shadow-2xl max-h-[calc(100dvh-4.5rem)] overflow-y-auto scrollbar-hide sm:max-w-xl sm:top-[50%] sm:bottom-auto sm:translate-y-[-50%] dark:bg-slate-900">
        <DialogHeader className="pb-1">
          <DialogTitle className="flex items-center justify-center gap-2 text-[15px] sm:text-base">
            <AgentIcon className="h-5 w-5 text-[#7440ff]" />
            <span>{currentModeMeta.title}</span>
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-slate-500 dark:text-slate-400">
            {currentModeMeta.kicker}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-50 p-1 dark:bg-slate-800/70">
            {(["eliza", "virtuals", "advanced"] as AgentImportMode[]).map((providerMode) => (
              <button
                key={providerMode}
                type="button"
                onClick={() => onModeChange?.(providerMode)}
                className={cn(
                  "rounded-xl px-3 py-2 text-[11px] font-semibold transition",
                  providerMode === mode
                    ? "bg-[#ccff00] text-slate-950"
                    : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900",
                )}
              >
                {modeMeta[providerMode].title.replace("Import from ", "")}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#7440ff]" />
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                  {currentModeMeta.title}
                </p>
                <p className="text-[10px] leading-5 text-slate-500 dark:text-slate-400">
                  {currentModeMeta.helper}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="agent-import-name" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Agent name
              </Label>
              <Input
                id="agent-import-name"
                value={agentName}
                onChange={(event) => setAgentName(event.target.value)}
                placeholder="Bantah Alpha"
                className="h-10 rounded-xl border-transparent bg-slate-50/90 text-sm dark:bg-slate-800/80"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="agent-import-specialty" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Specialty
              </Label>
              <Select
                value={specialty}
                onValueChange={(value) => setSpecialty(value as AgentRegistryProfile["specialty"])}
              >
                  <SelectTrigger
                    id="agent-import-specialty"
                    className="h-10 rounded-xl border-transparent bg-slate-50/90 text-sm dark:bg-slate-800/80"
                  >
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className="text-sm">
                        {getAgentSpecialtyMeta(specialty).emoji}
                      </span>
                      <span>{getAgentSpecialtyMeta(specialty).label}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-0 bg-white shadow-lg dark:bg-slate-800">
                    {agentSpecialtyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true" className="text-sm">
                            {option.emoji}
                          </span>
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="agent-import-endpoint" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {currentModeMeta.endpointLabel}
            </Label>
            <Input
              id="agent-import-endpoint"
              value={endpointUrl}
              onChange={(event) => setEndpointUrl(event.target.value)}
              placeholder={currentModeMeta.endpointPlaceholder}
              className="h-10 rounded-xl border-transparent bg-slate-50/90 text-sm dark:bg-slate-800/80"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="agent-import-wallet" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Wallet address
            </Label>
            <Input
              id="agent-import-wallet"
              value={walletAddress}
              onChange={(event) => setWalletAddress(event.target.value)}
              placeholder="0x..."
              className="h-10 rounded-xl border-transparent bg-slate-50/90 text-sm dark:bg-slate-800/80"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {currentModeMeta.walletHint}
            </p>
          </div>

          {currentModeMeta.showTokenized ? (
            <label className="flex items-center justify-between rounded-2xl bg-slate-50/90 px-3 py-3 dark:bg-slate-800/70">
              <div>
                <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                  Tokenized agent
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Keep this on if the imported agent also has a token or token-backed identity.
                </p>
              </div>
              <Checkbox
                checked={isTokenized}
                onCheckedChange={(checked) => setIsTokenized(checked === true)}
              />
            </label>
          ) : null}

          {lastSkillCheck ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                    Skill check
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {lastSkillCheck.complianceScore}% compliance
                  </p>
                </div>
                <Badge
                  className={cn(
                    "border-0 text-[10px]",
                    lastSkillCheck.overallPassed
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
                  )}
                >
                  {lastSkillCheck.overallPassed ? "Passed" : "Failed"}
                </Badge>
              </div>

              <div className="space-y-1.5">
                {lastSkillCheck.results.map((result) => (
                  <div
                    key={result.action}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-3 py-2 text-[10px]",
                      resultTone(result),
                    )}
                  >
                    <span className="font-semibold uppercase tracking-wide">{result.action}</span>
                    <span className="text-right">{result.message}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 flex-1 rounded-xl bg-slate-100 text-sm text-slate-700 hover:bg-slate-200"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => skillCheckMutation.mutate()}
              disabled={skillCheckMutation.isPending || !canCheckEndpoint}
              className="h-10 rounded-xl border-0 bg-[#7440ff] px-4 text-sm text-white hover:bg-[#6435e6]"
            >
              {skillCheckMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Check
            </Button>
            <Button
              type="button"
              onClick={() => importMutation.mutate()}
              disabled={!canImportAgent}
              className="h-10 flex-1 rounded-xl border-0 bg-[#ccff00] text-sm text-slate-950 hover:bg-[#b8eb00]"
            >
              {importMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Import className="mr-2 h-4 w-4" />
              )}
              Import Agent
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
