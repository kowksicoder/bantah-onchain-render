import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWallets } from "@privy-io/react-auth";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { getGlobalChannel } from "@/lib/pusher";
import { MobileNavigation } from "@/components/MobileNavigation";
import { ChallengeCard } from "@/components/ChallengeCard";
import { ChallengeChat } from "@/components/ChallengeChat";
import { JoinChallengeModal } from "@/components/JoinChallengeModal";
import { BantMap } from "@/components/BantMap";
import { AgentIcon } from "@/components/AgentIcon";
import { AgentImportDialog, type AgentImportMode } from "@/components/AgentImportDialog";
import { Button } from "@/components/ui/button";
import CategoryBar from "@/components/CategoryBar";
import PolymarketTab, { type PolymarketMarket } from "@/components/PolymarketTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, setAuthToken } from "@/lib/queryClient";
import {
  agentSpecialtyOptions,
  getAgentSpecialtyMeta,
  type BantahAgentSpecialty,
} from "@/lib/agentSpecialty";
import { uploadImage } from "@/lib/uploadImage";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { UserAvatar } from "@/components/UserAvatar";
import { PlayfulLoadingOverlay } from "@/components/ui/playful-loading";
import DateTimePicker from "react-datetime-picker";
import {
  CheckCircle2,
  MessageCircle,
  Clock,
  Calendar,
  Trophy,
  TrendingUp,
  Zap,
  Users,
  Shield,
  Search,
  ArrowUp,
  ArrowDown,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AgentListResponse,
  AgentRegistryProfile,
} from "@shared/agentApi";
import { getBantahAgentKitNetworkIdForChainId } from "@shared/agentApi";
import {
  type OnchainRuntimeConfig,
  type OnchainTokenSymbol,
  executeOnchainEscrowStakeTx,
} from "@/lib/onchainEscrow";

function ChallengeCardSkeleton() {
  return (
    <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[160px] bg-white dark:bg-slate-900 shadow-sm rounded-2xl animate-pulse">
      <CardContent className="p-4 flex flex-col h-full space-y-4">
        <div className="flex items-center space-x-3">
          <Skeleton className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4 rounded-full bg-slate-200 dark:bg-slate-800" />
            <Skeleton className="h-3 w-1/2 rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800/50" />
          <Skeleton className="h-3 w-5/6 rounded-full bg-slate-100 dark:bg-slate-800/50" />
        </div>
        <div className="pt-2 flex justify-between items-center">
          <Skeleton className="h-6 w-16 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-4 w-12 rounded-full bg-slate-100 dark:bg-slate-800/50" />
        </div>
      </CardContent>
    </Card>
  );
}

const createChallengeSchema = z.object({
  // challenged is optional for open challenges; if provided it becomes a P2P target
  challenged: z.string().optional(),
  title: z.string().min(1, "").max(200, "Title too long"),
  category: z.string().min(1, ""),
  chainId: z.coerce.number().int().positive().optional(),
  tokenSymbol: z.enum(["USDC", "USDT", "ETH", "BNB"]).default("USDC"),
  amount: z.string().min(1, ""),
  dueDate: z.string().optional(),
  challengerSide: z.enum(["YES", "NO"]).default("YES"), // Default to YES if not selected
  coverImageUrl: z.string().optional(),
});

const legacyTokenVisuals: Record<
  OnchainTokenSymbol,
  { glyph: string; badgeClassName: string; ringClassName: string }
> = {
  USDC: {
    glyph: "C",
    badgeClassName: "bg-gradient-to-br from-blue-500 to-cyan-400 text-white",
    ringClassName: "ring-blue-200/70 dark:ring-blue-400/20",
  },
  USDT: {
    glyph: "T",
    badgeClassName: "bg-gradient-to-br from-emerald-500 to-teal-400 text-white",
    ringClassName: "ring-emerald-200/70 dark:ring-emerald-400/20",
  },
  ETH: {
    glyph: "Ξ",
    badgeClassName: "bg-gradient-to-br from-slate-700 to-slate-500 text-white",
    ringClassName: "ring-slate-200/70 dark:ring-slate-400/20",
  },
  BNB: {
    glyph: "B",
    badgeClassName: "bg-gradient-to-br from-amber-400 to-yellow-300 text-slate-900",
    ringClassName: "ring-amber-200/80 dark:ring-amber-300/20",
  },
};

const tokenVisuals: Record<OnchainTokenSymbol, { src: string; alt: string }> = {
  USDC: { src: "/assets/token-usdc.svg", alt: "USDC logo" },
  USDT: { src: "/assets/token-usdt.svg", alt: "USDT logo" },
  ETH: { src: "/assets/token-eth.svg", alt: "ETH logo" },
  BNB: { src: "/assets/token-bnb.svg", alt: "BNB logo" },
};

function TokenMark({ token }: { token: OnchainTokenSymbol }) {
  const visual = tokenVisuals[token];

  return (
    <img
      src={visual.src}
      alt={visual.alt}
      className="h-5 w-5 rounded-full object-contain"
      loading="lazy"
    />
  );
}

export default function Challenges() {
  const { user, isAuthenticated, isLoading: authLoading, login, getAccessToken } = useAuth();
  const { wallets } = useWallets();
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportAgentDialogOpen, setIsImportAgentDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'open' | 'agent'>('open');
  const [agentFlowMode, setAgentFlowMode] = useState<"bantah" | AgentImportMode>("bantah");
  const [agentImportMode, setAgentImportMode] = useState<AgentImportMode>("eliza");
  const [agentDisplayName, setAgentDisplayName] = useState("");
  const [agentSpecialty, setAgentSpecialty] = useState<BantahAgentSpecialty>("general");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [challengeStatusTab, setChallengeStatusTab] = useState<'all' | 'polymarket' | 'p2p' | 'open' | 'updown' | 'communities' | 'agents' | 'active' | 'pending' | 'finished'>('all');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [preSelectedUser, setPreSelectedUser] = useState<any>(null);
  const [visibleChallengeCount, setVisibleChallengeCount] = useState(12);
  const [showPolymarketBetModal, setShowPolymarketBetModal] = useState(false);
  const [polymarketBet, setPolymarketBet] = useState<{
    market: PolymarketMarket;
    side: "YES" | "NO";
  } | null>(null);
  const [polymarketStake, setPolymarketStake] = useState("");
  const [isPolymarketEnsuring, setIsPolymarketEnsuring] = useState(false);
  useEffect(() => {
    if (preSelectedUser) setCreateMode('open');
  }, [preSelectedUser]);

  useEffect(() => {
    if (createMode !== "agent") {
      setAgentFlowMode("bantah");
    }
  }, [createMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (
      requestedTab === "all" ||
      requestedTab === "polymarket" ||
      requestedTab === "p2p" ||
      requestedTab === "open" ||
      requestedTab === "updown" ||
      requestedTab === "communities" ||
      requestedTab === "agents" ||
      requestedTab === "active" ||
      requestedTab === "pending" ||
      requestedTab === "finished"
    ) {
      setChallengeStatusTab(requestedTab);
    }
  }, [location]);
  const [selectedTab, setSelectedTab] = useState<string>('featured');
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const [agentAvatarFile, setAgentAvatarFile] = useState<File | null>(null);
  const [agentAvatarPreview, setAgentAvatarPreview] = useState<string | null>(null);
  const [isAgentAvatarUploading, setIsAgentAvatarUploading] = useState(false);
  const [isPreparingChallenge, setIsPreparingChallenge] = useState(false);
  const [headerChainId, setHeaderChainId] = useState<number | null>(null);
  const dueDatePickerRef = useRef<HTMLDivElement | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isClockOpen, setIsClockOpen] = useState(false);

  const openImportAgentFlow = (mode: AgentImportMode = agentImportMode) => {
    if (!isAuthenticated || authLoading) {
      toast({
        title: "Sign in required",
        description: "Please sign in before importing an agent.",
        variant: "destructive",
      });
      login();
      return;
    }
    setAgentImportMode(mode);
    setIsCreateDialogOpen(false);
    setIsImportAgentDialogOpen(true);
  };

  // Listen for header search events dispatched from Navigation
  useEffect(() => {
    const onSearch = (e: any) => {
      const val = e?.detail ?? "";
      setSearchTerm(val);
    };
    const onOpen = () => setIsSearchOpen(true);
    const onOpenCreateDialog = (e: any) => {
      const mode = e?.detail?.mode === "agent" ? "agent" : "open";
      if (mode === 'open' || mode === 'agent') {
        setCreateMode(mode);
        if (mode === "agent") {
          setAgentFlowMode("bantah");
        }
      } else {
        setCreateMode('open');
      }
      setIsCreateDialogOpen(true);
    };

    window.addEventListener("challenges-search", onSearch as EventListener);
    window.addEventListener("open-challenges-search", onOpen as EventListener);
    window.addEventListener("open-create-dialog", onOpenCreateDialog as EventListener);

    return () => {
      window.removeEventListener("challenges-search", onSearch as EventListener);
      window.removeEventListener("open-challenges-search", onOpen as EventListener);
      window.removeEventListener("open-create-dialog", onOpenCreateDialog as EventListener);
    };
  }, []);

  const form = useForm<z.infer<typeof createChallengeSchema>>({
    resolver: zodResolver(createChallengeSchema),
    defaultValues: {
      challenged: "",
      title: "",
      category: "sports",
      chainId: undefined,
      tokenSymbol: "USDC",
      amount: "",
      dueDate: "",
      challengerSide: "YES",
      coverImageUrl: "",
    },
  });

  const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }
    setCoverImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearCoverImage = () => {
    setCoverImageFile(null);
    setCoverPreview(null);
  };

  const handleAgentAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an avatar smaller than 5MB",
        variant: "destructive",
      });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }
    setAgentAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAgentAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearAgentAvatar = () => {
    setAgentAvatarFile(null);
    setAgentAvatarPreview(null);
  };

  const ensureFreshAuthToken = async (): Promise<string | null> => {
    if (!getAccessToken) return null;
    try {
      const token = await getAccessToken();
      if (token) {
        setAuthToken(token);
        return token;
      }
    } catch (error) {
      console.error("Failed to refresh auth token:", error);
    }
    return null;
  };

  const uploadCoverImage = async (file: File): Promise<string | null> => {
    try {
      setIsCoverUploading(true);
      const authToken = await ensureFreshAuthToken();
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      if (!response.ok) {
        throw new Error("Failed to upload image");
      }
      const data = await response.json();
      return data.imageUrl;
    } catch (error) {
      console.error("Cover upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCoverUploading(false);
    }
  };

  const normalizeP2PStatus = (challenge: any) => {
    const rawStatus = String(challenge?.status || "").toLowerCase();
    if (challenge?.adminCreated) return rawStatus || "open";

    const challenged = typeof challenge?.challenged === "string"
      ? challenge.challenged.trim()
      : challenge?.challenged;
    const hasDesignatedOpponent = !!challenged;

    if (rawStatus === "open" || rawStatus === "pending") {
      return hasDesignatedOpponent ? "pending" : "open";
    }

    return rawStatus || "pending";
  };

  const isBtcUpDownChallenge = (challenge: any) => {
    if (!challenge) return false;
    const title = String(challenge?.title || "").toLowerCase();
    const category = String(challenge?.category || "").toLowerCase();
    return (
      challenge?.adminCreated === true &&
      category === "crypto" &&
      (title.includes("bitcoin") || title.includes("btc")) &&
      (
        title.includes("up or down") ||
        title.includes("up/down") ||
        (title.includes("up") && title.includes("down"))
      )
    );
  };


  const isFiveMinuteChallenge = (challenge: any) => {
    if (!challenge) return false;
    const title = String(challenge?.title || "");
    const description = String(challenge?.description || "");
    const text = `${title} ${description}`;
    return /\b5\s*(m|min|mins|minute|minutes)\b/i.test(text);
  };

  const { data: challenges = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/challenges"],
    queryFn: async () => {
      try {
        // Always fetch public admin challenges + community-linked challenge metadata
        const [publicResp, communityResp] = await Promise.all([
          fetch("/api/challenges/public", { credentials: "include" }),
          fetch("/api/communities/challenges?limit=200", { credentials: "include" }),
        ]);
        if (!publicResp.ok) {
          throw new Error(`${publicResp.status}: ${await publicResp.json().then(e => e.message).catch(() => "Unknown error")}`);
        }
        const publicData = await publicResp.json();
        const communityData = communityResp.ok ? await communityResp.json() : [];
        const communityByChallengeId = new Map<number, any>();
        (communityData || []).forEach((challenge: any) => {
          const challengeId = Number(challenge?.id);
          if (Number.isFinite(challengeId)) {
            communityByChallengeId.set(challengeId, challenge?.community || null);
          }
        });

        let merged: any[] = publicData || [];

        // If user is authenticated, also fetch the authenticated feed (includes P2P/open challenges)
        if (user) {
          try {
            const authData = await apiRequest("GET", "/api/challenges?feed=all");
            const map = new Map<number, any>();

            (publicData || []).forEach((c: any) => map.set(c.id, c));
            (authData || []).forEach((c: any) => {
              const existing = map.get(c.id);
              if (!existing) {
                map.set(c.id, c);
                return;
              }

              const isAdminChallenge = Boolean(c.adminCreated ?? existing.adminCreated);
              if (!isAdminChallenge) {
                map.set(c.id, {
                  ...existing,
                  ...c,
                  coverImageUrl:
                    c.coverImageUrl ??
                    (c as any).cover_image_url ??
                    existing.coverImageUrl ??
                    (existing as any).cover_image_url ??
                    null,
                });
                return;
              }

              const existingPreviewUsers = Array.isArray(existing.participantPreviewUsers)
                ? existing.participantPreviewUsers
                : [];
              const nextPreviewUsers = Array.isArray(c.participantPreviewUsers)
                ? c.participantPreviewUsers
                : [];

              map.set(c.id, {
                ...existing,
                ...c,
                coverImageUrl:
                  c.coverImageUrl ??
                  (c as any).cover_image_url ??
                  existing.coverImageUrl ??
                  (existing as any).cover_image_url ??
                  null,
                participantCount: Math.max(
                  Number(existing.participantCount || 0),
                  Number(c.participantCount || 0),
                ),
                commentCount: Math.max(
                  Number(existing.commentCount || 0),
                  Number(c.commentCount || 0),
                ),
                participantPreviewUsers:
                  nextPreviewUsers.length > 0 ? nextPreviewUsers : existingPreviewUsers,
              });
            });
            merged = Array.from(map.values());
          } catch (err) {
            // ignore auth fetch errors and fall back to public data
            console.warn('Failed to fetch authenticated challenges feed:', err);
          }
        }

        return merged.map((challenge: any) => ({
          ...challenge,
          community: communityByChallengeId.get(Number(challenge?.id)) || challenge?.community || null,
          status: normalizeP2PStatus(challenge),
          commentCount: challenge.commentCount ?? 0,
          participantCount: challenge.participantCount ?? 0,
        }));
      } catch (error: any) {
        throw error;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 30,
  });

  const {
    data: allUsers = [] as any[],
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ["/api/users"],
    retry: false,
    enabled: !!user, // Only fetch when user is authenticated
  });

  const { data: balance = 0 } = useQuery<any>({
    queryKey: ["/api/wallet/balance"],
    retry: false,
  });

  const { data: onchainConfig } = useQuery<OnchainRuntimeConfig>({
    queryKey: ["/api/onchain/config"],
    queryFn: async () => await apiRequest("GET", "/api/onchain/config"),
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const { data: agentRegistry } = useQuery<AgentListResponse>({
    queryKey: ["/api/agents"],
    queryFn: async () => await apiRequest("GET", "/api/agents"),
    retry: false,
    staleTime: 1000 * 60 * 5,
    enabled: createMode === "agent" || isImportAgentDialogOpen,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const readStoredChain = () => {
      const stored = window.localStorage.getItem("bantah_onchain_chain_id");
      const parsed = Number(stored);
      return Number.isFinite(parsed) ? parsed : null;
    };

    setHeaderChainId(readStoredChain());

    const handleChainChange = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const parsed = Number(detail.chainId);
      if (Number.isFinite(parsed)) {
        setHeaderChainId(parsed);
      }
    };

    window.addEventListener("onchain-chain-changed", handleChainChange as EventListener);
    return () => {
      window.removeEventListener("onchain-chain-changed", handleChainChange as EventListener);
    };
  }, []);

  const chainOptions = useMemo(() => {
    const chains = Object.values(onchainConfig?.chains || {});
    return chains.sort((a, b) => Number(a.chainId) - Number(b.chainId));
  }, [onchainConfig]);

  const selectedChainId =
    form.watch("chainId") ??
    headerChainId ??
    onchainConfig?.defaultChainId ??
    Number(chainOptions[0]?.chainId || 0);

  const selectedChainConfig =
    onchainConfig?.chains?.[String(selectedChainId)] ||
    chainOptions.find((chain) => Number(chain.chainId) === Number(selectedChainId)) ||
    null;

  const selectedAgentExecutionNetworkId = getBantahAgentKitNetworkIdForChainId(selectedChainId);
  const canProvisionAgentOnSelectedChain = Boolean(selectedAgentExecutionNetworkId);

  const tokenOptions = useMemo<OnchainTokenSymbol[]>(() => {
    const chainConfig =
      onchainConfig?.chains?.[String(selectedChainId)] ||
      onchainConfig?.chains?.[String(onchainConfig?.defaultChainId || "")] ||
      chainOptions[0];

    const supportedTokens = Array.isArray(chainConfig?.supportedTokens)
      ? chainConfig.supportedTokens.filter((token): token is OnchainTokenSymbol =>
          ["USDC", "USDT", "ETH", "BNB"].includes(token),
        )
      : [];

    if (supportedTokens.length > 0) {
      return supportedTokens;
    }

    const configuredTokens = Object.entries(chainConfig?.tokens || {})
      .filter(([, token]) => Boolean(token?.isNative || token?.address))
      .map(([token]) => token)
      .filter((token): token is OnchainTokenSymbol =>
        ["USDC", "USDT", "ETH", "BNB"].includes(token),
      );

    return configuredTokens.length > 0 ? configuredTokens : ["ETH"];
  }, [onchainConfig, chainOptions, selectedChainId]);

  const selectedTokenSymbol =
    (form.watch("tokenSymbol") as OnchainTokenSymbol | undefined) ||
    onchainConfig?.defaultToken ||
    "USDC";

  const ownedAgents = useMemo(() => {
    const items = agentRegistry?.items || [];
    if (!user?.id) return items.slice(0, 3);
    return items.filter((agent) => agent.ownerId === user.id).slice(0, 3);
  }, [agentRegistry, user?.id]);

  const agentFlowCards = [
    {
      key: "bantah" as const,
      title: "Create on Bantah",
      description: "Native Bantah agent with bundled skills, managed Eliza runtime, and AgentKit wallet provisioning.",
      cta: "Create Agent",
    },
    {
      key: "eliza" as const,
      title: "Import from Eliza",
      description: "Connect a running Eliza-backed agent by importing its Bantah-compatible endpoint and wallet.",
      cta: "Open Eliza Import",
    },
    {
      key: "virtuals" as const,
      title: "Import from Virtuals",
      description: "Bring in a Virtuals-backed agent when it already exposes a runtime or adapter Bantah can call.",
      cta: "Open Virtuals Import",
    },
    {
      key: "advanced" as const,
      title: "Advanced Import",
      description: "Manual wallet + endpoint import for custom infrastructure and unsupported ecosystems.",
      cta: "Open Advanced Import",
    },
  ];

  useEffect(() => {
    if (tokenOptions.length === 0) return;
    const current = form.getValues("tokenSymbol");
    if (!current || !tokenOptions.includes(current as OnchainTokenSymbol)) {
      const fallbackToken = tokenOptions.includes(onchainConfig?.defaultToken as OnchainTokenSymbol)
        ? (onchainConfig?.defaultToken as OnchainTokenSymbol)
        : tokenOptions[0];
      form.setValue("tokenSymbol", fallbackToken, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [form, onchainConfig, tokenOptions]);

  useEffect(() => {
    if (!onchainConfig?.defaultChainId) return;
    const currentChain = form.getValues("chainId");
    if (!currentChain) {
      const fallbackChainId =
        headerChainId ?? onchainConfig.defaultChainId ?? Number(chainOptions[0]?.chainId || 0);
      if (!fallbackChainId) return;
      form.setValue("chainId", fallbackChainId, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [form, onchainConfig, headerChainId, chainOptions]);

  useEffect(() => {
    if (!headerChainId) return;
    form.setValue("chainId", headerChainId, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [form, headerChainId]);

  useEffect(() => {
    if (tokenOptions.length === 0) return;
    const current = form.getValues("tokenSymbol");
    if (!current || !tokenOptions.includes(current as OnchainTokenSymbol)) {
      form.setValue("tokenSymbol", tokenOptions[0], {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [form, tokenOptions]);

  // Real-time listeners for challenge updates via Pusher
  useEffect(() => {
    const globalChannel = getGlobalChannel();
    
    // Listen for new challenge messages
    const handleNewMessage = (data: any) => {
      if (data.type === 'challenge_message' || data.challengeId) {
        queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      }
    };

    // Listen for when users join challenges  
    const handleChallengeJoined = (data: any) => {
      if (data.type === 'challenge_joined' || data.challengeId) {
        const targetId = Number(data?.challengeId);
        if (Number.isFinite(targetId)) {
          queryClient.setQueryData<any[]>(["/api/challenges"], (existing) => {
            if (!Array.isArray(existing)) return existing;

            return existing.map((challenge: any) => {
              if (Number(challenge?.id) !== targetId) return challenge;
              if (!challenge?.adminCreated) return challenge;

              const currentPreviewUsers = Array.isArray(challenge?.participantPreviewUsers)
                ? challenge.participantPreviewUsers
                : [];
              const incomingPreviewUsers = Array.isArray(data?.participantPreviewUsers)
                ? data.participantPreviewUsers
                : [];

              const mergedPreviewUsers = [...incomingPreviewUsers, ...currentPreviewUsers]
                .filter((entry: any, idx: number, arr: any[]) => {
                  const entryId = String(entry?.id || "").trim();
                  if (!entryId) return false;
                  return arr.findIndex((x: any) => String(x?.id || "").trim() === entryId) === idx;
                })
                .slice(0, 2);

              const existingCount = Number(challenge?.participantCount || 0);
              const incomingCount = Number(data?.participantCount || 0);
              const userAddedDelta = data?.userId &&
                !currentPreviewUsers.some((entry: any) => String(entry?.id || "") === String(data.userId))
                  ? 1
                  : 0;

              return {
                ...challenge,
                participantPreviewUsers: mergedPreviewUsers.length > 0
                  ? mergedPreviewUsers
                  : currentPreviewUsers,
                participantCount: Math.max(
                  existingCount + userAddedDelta,
                  incomingCount,
                  mergedPreviewUsers.length,
                ),
              };
            });
          });
        }

        queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      }
    };

    globalChannel.bind('new-message', handleNewMessage);
    globalChannel.bind('challenge-joined', handleChallengeJoined);

    return () => {
      globalChannel.unbind('new-message', handleNewMessage);
      globalChannel.unbind('challenge-joined', handleChallengeJoined);
      globalChannel.unsubscribe();
    };
  }, [queryClient]);

  const createChallengeMutation = useMutation({
    mutationFn: async (challengeData: Record<string, any>) => {
      return await apiRequest("POST", "/api/challenges", challengeData);
    },
    onSuccess: (result: any) => {
      handleChallengeCreateSuccess(result);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleChallengeCreateSuccess = (result?: any) => {
    const bantCreditReward = result?.bantCreditReward;
    toast({
      title: "Challenge Created",
      description:
        bantCreditReward?.pointsAwarded > 0
          ? `Your challenge is live. +${bantCreditReward.pointsAwarded} BantCredit earned.`
          : "Your challenge has been sent!",
    });
    queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
    queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
    setIsCreateDialogOpen(false);
    setPreSelectedUser(null);
    form.reset();
    setCoverImageFile(null);
    setCoverPreview(null);
  };

  const createAgentMutation = useMutation({
    mutationFn: async () => {
      await ensureFreshAuthToken();
      let avatarUrl: string | null = null;
      if (agentAvatarFile) {
        avatarUrl = await uploadAgentAvatar(agentAvatarFile);
        if (!avatarUrl) {
          throw new Error("Please upload a valid avatar before creating this agent.");
        }
      }
      return apiRequest("POST", "/api/agents/create", {
        agentName: agentDisplayName.trim(),
        specialty: agentSpecialty,
        chainId: selectedChainId,
        avatarUrl,
      });
    },
    onSuccess: (result: any) => {
      const createdAgent = result?.agent;
      const provisionedChainId = Number(result?.provisioned?.chainId || selectedChainId);
      const provisionedChainName =
        onchainConfig?.chains?.[String(provisionedChainId)]?.name ||
        selectedChainConfig?.name ||
        "selected chain";
      if (createdAgent) {
        queryClient.setQueryData<AgentListResponse | undefined>(["/api/agents"], (existing) => {
          if (!existing) {
            return {
              items: [createdAgent],
              pagination: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
              },
            };
          }

          const deduped = [
            createdAgent,
            ...existing.items.filter((agent) => agent.agentId !== createdAgent.agentId),
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
      }
      toast({
        title: "Agent created",
        description: createdAgent?.walletAddress
          ? `${createdAgent.agentName} is live on ${provisionedChainName} with wallet ${String(createdAgent.walletAddress).slice(0, 6)}...${String(createdAgent.walletAddress).slice(-4)}`
          : "Your Bantah agent is now live in the registry.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setIsCreateDialogOpen(false);
      setAgentDisplayName("");
      setAgentSpecialty("general");
      clearAgentAvatar();
      window.setTimeout(() => {
        window.location.href = "/agents";
      }, 150);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Unable to create agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImportedAgent = () => {
    setIsImportAgentDialogOpen(false);
    setCreateMode("agent");
    setAgentFlowMode(agentImportMode);
    setIsCreateDialogOpen(true);
  };

  const uploadAgentAvatar = async (file: File): Promise<string | null> => {
    try {
      setIsAgentAvatarUploading(true);
      const authToken = await ensureFreshAuthToken();
      return await uploadImage(file, authToken);
    } catch (error) {
      console.error("Agent avatar upload error:", error);
      toast({
        title: "Avatar upload failed",
        description:
          error instanceof Error ? error.message : "Failed to upload avatar. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsAgentAvatarUploading(false);
    }
  };

  const categoryTabs = [
    { id: "create", label: "Create", icon: "/assets/create.png", emoji: "✨", gradient: "from-green-400 to-emerald-500", isCreate: true, value: "create" },
    { id: "all", label: "All", icon: "/assets/versus.svg", emoji: "🌐", gradient: "from-blue-400 to-purple-500", value: "all" },
    { id: "sports", label: "Sports", icon: "/assets/sportscon.svg", emoji: "⚽", gradient: "from-green-400 to-blue-500", value: "sports" },
    { id: "gaming", label: "Gaming", icon: "/assets/gamingsvg.svg", emoji: "🎮", gradient: "from-gray-400 to-gray-600", value: "gaming" },
    { id: "crypto", label: "Crypto", icon: "/assets/cryptosvg.svg", emoji: "₿", gradient: "from-yellow-400 to-orange-500", value: "crypto" },
    { id: "trading", label: "Trading", icon: "/assets/cryptosvg.svg", emoji: "📈", gradient: "from-yellow-400 to-orange-500", value: "trading" },
    { id: "music", label: "Music", icon: "/assets/musicsvg.svg", emoji: "🎵", gradient: "from-blue-400 to-purple-500", value: "music" },
    { id: "entertainment", label: "Entertainment", icon: "/assets/popcorn.svg", emoji: "🍿", gradient: "from-pink-400 to-red-500", value: "entertainment" },
    { id: "politics", label: "Politics", icon: "/assets/poltiii.svg", emoji: "🗳️", gradient: "from-green-400 to-teal-500", value: "politics" },
  ];

  const categoryOptions = [
    { value: "polymarket", label: "Polymarket", emoji: "PM" },
    ...categoryTabs.filter((item) => !item.isCreate).map((item) => ({
      value: item.value || item.id,
      label: item.label,
      emoji: item.emoji,
    })),
  ];

  const toLocalDateTimeInput = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const tzOffset = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - tzOffset);
    return local.toISOString().slice(0, 16);
  };

  const isGenericOnchainChallenge = (challenge: any) => {
    if (!challenge) return false;
    const title = String(challenge?.title || "").trim().toLowerCase();
    if (!title.startsWith("onchain challenge")) return false;
    if (challenge?.adminCreated !== true) return false;
    return true;
  };

  const isAgentChallenge = (challenge: any) => {
    if (!challenge) return false;

    const typeFields = [
      challenge?.creatorType,
      challenge?.challengerType,
      challenge?.challengedType,
      challenge?.ownerType,
      challenge?.creator_type,
      challenge?.challenger_type,
      challenge?.challenged_type,
      challenge?.owner_type,
      challenge?.creator?.type,
      challenge?.challenger?.type,
      challenge?.challenged?.type,
      challenge?.challengerUser?.type,
      challenge?.challengedUser?.type,
    ];

    if (
      typeFields.some((value) => String(value || "").trim().toLowerCase() === "agent")
    ) {
      return true;
    }

    const idFields = [
      challenge?.agentId,
      challenge?.creatorAgentId,
      challenge?.challengerAgentId,
      challenge?.challengedAgentId,
      challenge?.agent_id,
      challenge?.creator_agent_id,
      challenge?.challenger_agent_id,
      challenge?.challenged_agent_id,
      challenge?.creator?.agentId,
      challenge?.challenger?.agentId,
      challenge?.challenged?.agentId,
      challenge?.challengerUser?.agentId,
      challenge?.challengedUser?.agentId,
    ];

    if (idFields.some(Boolean)) {
      return true;
    }

    return (
      challenge?.createdByAgent === true ||
      challenge?.isAgentChallenge === true ||
      challenge?.agentInvolved === true ||
      challenge?.created_by_agent === true ||
      challenge?.agent_involved === true ||
      challenge?.is_agent_challenge === true
    );
  };

  const filteredChallenges = useMemo(() => challenges.filter((challenge: any) => {
    if (isFiveMinuteChallenge(challenge)) return false;
    if (isGenericOnchainChallenge(challenge)) return false;
    const searchLower = searchTerm ? searchTerm.toLowerCase() : "";
    const matchesSearch =
      !searchTerm ||
      (challenge.title || "").toLowerCase().includes(searchLower) ||
      (challenge.description || "").toLowerCase().includes(searchLower) ||
      (challenge.category || "").toLowerCase().includes(searchLower) ||
      (challenge.challengerUser?.username || "")
        .toLowerCase()
        .includes(searchLower) ||
      (challenge.challengedUser?.username || "")
        .toLowerCase()
        .includes(searchLower);

    const matchesCategory =
      selectedCategory === "all" || challenge.category === selectedCategory;

    // Determine admin-created flag explicitly
    const isAdminCreated = challenge.adminCreated === true;
    const normalizedStatus = String(challenge.status || "").toLowerCase();
    const dueAtMs = challenge?.dueDate ? new Date(challenge.dueDate).getTime() : NaN;
    const isTimeEnded = Number.isFinite(dueAtMs) && dueAtMs <= Date.now();
    const isFinishedChallenge =
      normalizedStatus === "completed" ||
      normalizedStatus === "cancelled" ||
      normalizedStatus === "disputed" ||
      normalizedStatus === "ended" ||
      isTimeEnded;

    // Filter by challenge status or P2P tab
    const isCommunityChallenge = !!challenge.community;
    const matchesStatus =
      challengeStatusTab === 'all' ? true :
      challengeStatusTab === 'p2p' ? !isAdminCreated :
      challengeStatusTab === 'open' ? (normalizedStatus === 'open' && !isFinishedChallenge) :
      challengeStatusTab === 'updown' ? isBtcUpDownChallenge(challenge) :
      challengeStatusTab === 'communities' ? isCommunityChallenge :
      challengeStatusTab === 'agents' ? isAgentChallenge(challenge) :
      challengeStatusTab === 'active' ? (normalizedStatus === 'active' && !isFinishedChallenge) :
      challengeStatusTab === 'pending' ? (normalizedStatus === 'pending' && !isFinishedChallenge) :
      challengeStatusTab === 'finished' ? isFinishedChallenge :
      true;

    return matchesSearch && matchesCategory && matchesStatus;
  }), [challenges, searchTerm, selectedCategory, challengeStatusTab]);

  const allTabCount = useMemo(
    () =>
      challenges.filter((challenge: any) => {
        if (isFiveMinuteChallenge(challenge)) return false;
        if (isGenericOnchainChallenge(challenge)) return false;
        const searchLower = searchTerm ? searchTerm.toLowerCase() : "";
        const matchesSearch =
          !searchTerm ||
          (challenge.title || "").toLowerCase().includes(searchLower) ||
          (challenge.description || "").toLowerCase().includes(searchLower) ||
          (challenge.category || "").toLowerCase().includes(searchLower) ||
          (challenge.challengerUser?.username || "").toLowerCase().includes(searchLower) ||
          (challenge.challengedUser?.username || "").toLowerCase().includes(searchLower);

        const matchesCategory =
          selectedCategory === "all" || challenge.category === selectedCategory;

        return matchesSearch && matchesCategory;
      }).length,
    [challenges, searchTerm, selectedCategory],
  );

  const agentTabCount = useMemo(
    () =>
      challenges.filter((challenge: any) => {
        if (isFiveMinuteChallenge(challenge)) return false;
        if (isGenericOnchainChallenge(challenge)) return false;
        if (!isAgentChallenge(challenge)) return false;
        const searchLower = searchTerm ? searchTerm.toLowerCase() : "";
        const matchesSearch =
          !searchTerm ||
          (challenge.title || "").toLowerCase().includes(searchLower) ||
          (challenge.description || "").toLowerCase().includes(searchLower) ||
          (challenge.category || "").toLowerCase().includes(searchLower) ||
          (challenge.challengerUser?.username || "").toLowerCase().includes(searchLower) ||
          (challenge.challengedUser?.username || "").toLowerCase().includes(searchLower);

        const matchesCategory =
          selectedCategory === "all" || challenge.category === selectedCategory;

        return matchesSearch && matchesCategory;
      }).length,
    [challenges, searchTerm, selectedCategory],
  );

  const filteredUsers = (allUsers as any[]).filter((u: any) => {
    if (!searchTerm || u.id === user?.id) return false;
    if (u.isAdmin) return false; // Hide admin and superadmin users
    const searchLower = searchTerm.toLowerCase();
    const firstName = (u.firstName || "").toLowerCase();
    const lastName = (u.lastName || "").toLowerCase();
    const username = (u.username || "").toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();

    return (
      firstName.includes(searchLower) ||
      lastName.includes(searchLower) ||
      username.includes(searchLower) ||
      fullName.includes(searchLower)
    );
  });

  const pendingChallenges = filteredChallenges.filter(
    (c: any) => c.status === "pending" && !c.adminCreated && (c.challengerId === user?.id || c.challengedId === user?.id),
  );
  const activeChallenges = filteredChallenges.filter(
    (c: any) => c.status === "active" && !c.adminCreated,
  );
  const awaitingResolutionChallenges = filteredChallenges.filter(
    (c: any) => c.status === "pending_admin" && c.adminCreated && (c.challengerId === user?.id || c.challengedId === user?.id || c.creatorId === user?.id),
  );
  const completedChallenges = filteredChallenges.filter(
    (c: any) => c.status === "completed",
  );
  const featuredChallenges = filteredChallenges.filter(
    (c: any) => c.adminCreated && c.status !== "pending_admin",
  );

  // Validate selected tab - reset to featured if current tab is hidden
  useEffect(() => {
    const isTabVisible = 
      selectedTab === 'featured' || 
      selectedTab === 'active' ||
      selectedTab === 'completed' ||
      (user && selectedTab === 'pending' && pendingChallenges.length > 0) ||
      (user && selectedTab === 'awaiting_resolution' && awaitingResolutionChallenges.length > 0);
    
    if (!isTabVisible) {
      setSelectedTab('featured');
    }
  }, [selectedTab, user, pendingChallenges.length, awaitingResolutionChallenges.length]);

  const normalizeAmountInput = (value: unknown) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const cleaned = raw.replace(/[^\d.]/g, "");
    if (!cleaned) return "";
    const [whole, ...rest] = cleaned.split(".");
    const fractional = rest.join("");
    return fractional.length > 0 ? `${whole}.${fractional}` : whole;
  };


  const onSubmit = async (data: z.infer<typeof createChallengeSchema>) => {
    if (createMode === "agent") {
      if (agentFlowMode !== "bantah") {
        openImportAgentFlow(agentFlowMode);
        return;
      }
      if (!agentDisplayName.trim()) {
        toast({
          title: "Agent name required",
          description: "Give your agent a name to continue.",
          variant: "destructive",
        });
        return;
      }
      createAgentMutation.mutate();
      return;
    }
      const normalizedAmount = normalizeAmountInput(data.amount);
      const amount = parseFloat(normalizedAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast({
          title: "Invalid stake",
          description: "Enter a valid amount to create this challenge.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsPreparingChallenge(true);
        await ensureFreshAuthToken();

      let finalCoverUrl = "";
      if (coverImageFile) {
        const uploaded = await uploadCoverImage(coverImageFile);
        if (uploaded) finalCoverUrl = uploaded;
      }

      const selectedChainId = Number(
        data.chainId ||
          onchainConfig?.defaultChainId ||
          Object.keys(onchainConfig?.chains || {})[0] ||
          8453,
      );
      const resolvedSelectedChainConfig =
        onchainConfig?.chains?.[String(selectedChainId)] ||
        chainOptions.find((chain) => Number(chain.chainId) === Number(selectedChainId)) ||
        null;
      const selectedToken =
        (data.tokenSymbol || onchainConfig?.defaultToken || "USDC") as OnchainTokenSymbol;

        const payload: Record<string, any> = {
          ...data,
          settlementRail: "onchain",
          chainId: selectedChainId,
          tokenSymbol: selectedToken,
          amount: normalizedAmount,
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
        };

      payload.challenged = preSelectedUser?.id || String(data.challenged || "").trim();

      if (finalCoverUrl) {
        payload.coverImageUrl = finalCoverUrl;
      }

      const contractModeEnabled = onchainConfig?.contractEnabled === true;
      const supportsChallengeAwareEscrow =
        contractModeEnabled && resolvedSelectedChainConfig?.escrowSupportsChallengeLock === true;

      if (supportsChallengeAwareEscrow) {
        const draftResult = await apiRequest("POST", "/api/challenges/draft", payload);
        const draftChallenge = draftResult?.challenge || draftResult;
        const draftChallengeId = Number(draftChallenge?.id);
        if (!Number.isFinite(draftChallengeId)) {
          throw new Error("Unable to reserve this challenge onchain right now.");
        }

        const preferredWalletAddress = (
          [
            (user as any)?.walletAddress,
            (user as any)?.primaryWalletAddress,
            (user as any)?.wallet?.address,
            Array.isArray((user as any)?.walletAddresses)
              ? (user as any)?.walletAddresses?.[0]
              : null,
          ].find((entry) => typeof entry === "string" && entry.trim().length > 0) || null
        ) as string | null;

        const escrowTx = await executeOnchainEscrowStakeTx({
          wallets: wallets as any,
          preferredWalletAddress,
          onchainConfig,
          chainId: selectedChainId,
          challengeId: draftChallengeId,
          tokenSymbol: selectedToken,
          amount: normalizedAmount,
        });

        const finalizedChallenge = await apiRequest(
          "POST",
          `/api/challenges/${draftChallengeId}/onchain/finalize-create`,
          {
            escrowTxHash: escrowTx.escrowTxHash,
            walletAddress: escrowTx.walletAddress,
          },
        );

        toast({
          title: "Escrow locked",
          description: `${amount.toLocaleString()} ${selectedToken} secured in escrow.`,
        });

        handleChallengeCreateSuccess(finalizedChallenge);
        return finalizedChallenge;
      }

      if (contractModeEnabled) {
        const preferredWalletAddress = (
          [
            (user as any)?.walletAddress,
            (user as any)?.primaryWalletAddress,
            (user as any)?.wallet?.address,
            Array.isArray((user as any)?.walletAddresses)
              ? (user as any)?.walletAddresses?.[0]
              : null,
          ].find((entry) => typeof entry === "string" && entry.trim().length > 0) || null
        ) as string | null;

        const escrowTx = await executeOnchainEscrowStakeTx({
          wallets: wallets as any,
          preferredWalletAddress,
          onchainConfig,
          chainId: selectedChainId,
          tokenSymbol: selectedToken,
          amount: normalizedAmount,
        });

        payload.escrowTxHash = escrowTx.escrowTxHash;
        payload.walletAddress = escrowTx.walletAddress;

        toast({
          title: "Escrow locked",
          description: `${amount.toLocaleString()} ${selectedToken} secured in escrow.`,
        });
      }

      createChallengeMutation.mutate(payload);
    } catch (error: any) {
      toast({
        title: "Unable to create challenge",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPreparingChallenge(false);
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (createMode === "agent") {
      event.preventDefault();
      onSubmit(form.getValues());
      return;
    }
    form.handleSubmit(onSubmit)(event);
  };

  const handleChallengeClick = (challenge: any) => {
    // Navigate to the challenge activity page instead of opening the modal.
    // This allows users to view the activity page even if they're not a participant.
    window.location.href = `/challenges/${challenge.id}/activity`;
  };
  const handleJoin = (challenge: any) => {
    const title = String(challenge?.title || "").toLowerCase();
    const category = String(challenge?.category || "").toLowerCase();
    const isUpDownMarket =
      challenge?.adminCreated === true &&
      category === "crypto" &&
      (title.includes("bitcoin") || title.includes("btc")) &&
      (
        title.includes("up or down") ||
        title.includes("up/down") ||
        (title.includes("up") && title.includes("down"))
      );

    if (isUpDownMarket) {
      const selectedSideRaw = String(challenge?.selectedSide || "").trim().toUpperCase();
      const selectedSide = selectedSideRaw === "NO" ? "NO" : "YES";
      window.location.href = `/challenges/${challenge.id}/activity?side=${selectedSide}`;
      return;
    }

    setSelectedChallenge(challenge);
    setShowJoinModal(true);
  };

  const handlePolymarketQuickBet = (market: PolymarketMarket, side: "YES" | "NO") => {
    setPolymarketBet({ market, side });
    setPolymarketStake("");
    setShowPolymarketBetModal(true);
  };

  const submitPolymarketBet = async () => {
    if (!polymarketBet) return;
    if (!isAuthenticated || authLoading) {
      toast({
        title: "Sign in required",
        description: "Please sign in to place a bet.",
        variant: "destructive",
      });
      login();
      return;
    }
    const stakeValue = Number.parseInt(String(polymarketStake).replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(stakeValue) || stakeValue <= 0) {
      toast({
        title: "Enter a valid stake",
        description: "Stake must be a positive number.",
        variant: "destructive",
      });
      return;
    }

    setIsPolymarketEnsuring(true);
    try {
      const payload = {
        marketId: polymarketBet.market.id,
        slug: polymarketBet.market.slug,
        question: polymarketBet.market.question,
        endDate: polymarketBet.market.endDate,
        sourceUrl: polymarketBet.market.sourceUrl,
        resolutionSource: polymarketBet.market.resolutionSource,
        image: polymarketBet.market.image,
        stakeAmount: stakeValue,
      };

      const ensuredChallenge = await apiRequest(
        "POST",
        "/api/polymarket/challenges/ensure",
        payload,
      );

      const challenge = ensuredChallenge || {};
      const challengeId = Number(challenge?.id);
      if (!Number.isFinite(challengeId)) {
        throw new Error("Unable to prepare this market right now.");
      }

      const challengeRail = String(challenge?.settlementRail || challenge?.settlement_rail || "onchain").toLowerCase();
      const isOnchainChallenge = challengeRail === "onchain";
      const requiresContractEscrow = Boolean(isOnchainChallenge && onchainConfig?.contractEnabled);
      const tokenSymbol = String(
        challenge?.tokenSymbol || challenge?.token_symbol || onchainConfig?.defaultToken || "USDC",
      ).toUpperCase();

      const joinPayload: Record<string, any> = {
        side: polymarketBet.side,
        stakeAmount: stakeValue,
      };

      if (requiresContractEscrow) {
        if (!onchainConfig) {
          throw new Error("Onchain config is unavailable right now.");
        }
        const preferredWalletAddress = (
          [
            (user as any)?.walletAddress,
            (user as any)?.primaryWalletAddress,
            (user as any)?.wallet?.address,
            Array.isArray((user as any)?.walletAddresses)
              ? (user as any)?.walletAddresses?.[0]
              : null,
          ].find((entry) => typeof entry === "string" && entry.trim().length > 0) || null
        ) as string | null;

        const escrowTx = await executeOnchainEscrowStakeTx({
          wallets: wallets as any,
          preferredWalletAddress,
          onchainConfig,
          chainId: Number(
            challenge?.chainId || challenge?.chain_id || onchainConfig?.defaultChainId,
          ),
          challengeId,
          tokenSymbol: tokenSymbol as OnchainTokenSymbol,
          amount: String(stakeValue),
        });
        joinPayload.escrowTxHash = escrowTx.escrowTxHash;
        joinPayload.walletAddress = escrowTx.walletAddress;
        toast({
          title: "Escrow locked",
          description: `${stakeValue.toLocaleString()} ${tokenSymbol} secured in escrow.`,
        });
      }

      const joinResult = await apiRequest(
        "POST",
        `/api/challenges/${challengeId}/queue/join`,
        joinPayload,
      );

      toast({
        title: joinResult?.match ? "Matched" : "Queued for matching",
        description: joinResult?.match
          ? `Opponent found. ${stakeValue.toLocaleString()} ${tokenSymbol} locked in escrow.`
          : `Waiting for an opponent. ${stakeValue.toLocaleString()} ${tokenSymbol} held in escrow.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      setShowPolymarketBetModal(false);
      setPolymarketBet(null);

      window.location.href = `/challenges/${challengeId}/activity`;
    } catch (error: any) {
      toast({
        title: "Unable to start bet",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPolymarketEnsuring(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "active":
        return "bg-green-500";
      case "completed":
        return "bg-blue-500";
      case "disputed":
        return "bg-red-500";
      case "cancelled":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return Clock;
      case "active":
        return Zap;
      case "completed":
        return Trophy;
      case "disputed":
        return Shield;
      default:
        return Clock;
    }
  };

  // Handle authentication errors
  useEffect(() => {
    if (usersError && isUnauthorizedError(usersError as Error)) {
      toast({
        title: "Session Expired",
        description: "Please log in again to continue.",
        variant: "destructive",
      });
    }
  }, [usersError, toast]);

  if (!user) {
    // Allow unauthenticated users to view challenges but show login prompts for actions
  }

  useEffect(() => {
    setVisibleChallengeCount(12);
  }, [searchTerm, selectedCategory, challengeStatusTab]);

  const sortedChallenges = useMemo(() => {
    const mockAgentChallenges = [
      {
        id: "agent-mock-1",
        title: "Will BTC close above $80k this week?",
        category: "crypto",
        status: "open",
        adminCreated: true,
        createdAt: new Date().toISOString(),
        createdByAgent: true,
        agentInvolved: true,
        creatorAgentId: "agent_mock_1",
        challengerSide: "YES",
        challengedSide: "NO",
        amount: "50",
        tokenSymbol: "USDC",
        description: "Agent Alpha opens a weekly BTC momentum market.",
      },
      {
        id: "agent-mock-2",
        title: "Will Lakers win tonight?",
        category: "sports",
        status: "open",
        adminCreated: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        createdByAgent: true,
        agentInvolved: true,
        challengerAgentId: "agent_mock_2",
        challengedAgentId: "agent_mock_3",
        amount: "20",
        tokenSymbol: "USDC",
        description: "Agent vs Agent: matchup read and confidence check.",
      },
      {
        id: "agent-mock-3",
        title: "Will a rate cut happen this quarter?",
        category: "politics",
        status: "open",
        adminCreated: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        agentInvolved: true,
        challengerAgentId: "agent_mock_4",
        amount: "35",
        tokenSymbol: "USDC",
        description: "Agent Beta joins a macro rate decision market.",
      },
    ];
    const resolveSortTime = (challenge: any) => {
      const raw =
        challenge?.createdAt ??
        challenge?.created_at ??
        challenge?.created ??
        challenge?.timestamp ??
        challenge?.updatedAt ??
        challenge?.updated_at ??
        challenge?.createdAtMs;

      if (typeof raw === "number" && Number.isFinite(raw)) return raw;
      if (typeof raw === "string" && raw.trim()) {
        const parsed = Date.parse(raw);
        if (Number.isFinite(parsed)) return parsed;
        const numeric = Number(raw);
        if (Number.isFinite(numeric)) return numeric;
      }
      return 0;
    };

    const resolveSortId = (challenge: any) => {
      const raw = challenge?.id ?? challenge?.challengeId ?? challenge?.challenge_id;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const base = [...filteredChallenges];
    const shouldInjectMocks =
      challengeStatusTab === "agents" && base.filter((c: any) => isAgentChallenge(c)).length === 0;
    const seeded = shouldInjectMocks ? [...mockAgentChallenges, ...base] : base;

    return [...seeded].sort((a: any, b: any) => {
    // Priority 0: Pinned challenges first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    // Priority 1: Pending (Action Required)
    const aIsPending = a.status === 'pending' && !a.adminCreated && (a.challengerId === user?.id || a.challengedId === user?.id);
    const bIsPending = b.status === 'pending' && !b.adminCreated && (b.challengerId === user?.id || b.challengedId === user?.id);
    if (aIsPending && !bIsPending) return -1;
    if (!aIsPending && bIsPending) return 1;

    // Priority 2: Active/Live
    const aIsActive = a.status === 'active';
    const bIsActive = b.status === 'active';
    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;

    // Priority 3: Featured/Open (Admin created matches)
    const aIsOpen = a.status === 'open' && a.adminCreated;
    const bIsOpen = b.status === 'open' && b.adminCreated;
    if (aIsOpen && !bIsOpen) return -1;
    if (!aIsOpen && bIsOpen) return 1;

    // Priority 4: Awaiting Resolution
    const aIsAwaiting = a.status === 'pending_admin';
    const bIsAwaiting = b.status === 'pending_admin';
    if (aIsAwaiting && !bIsAwaiting) return -1;
    if (!aIsAwaiting && bIsAwaiting) return 1;

    // Default: Newest first (with resilient timestamps)
    const timeDiff = resolveSortTime(b) - resolveSortTime(a);
    if (timeDiff !== 0) return timeDiff;
    return resolveSortId(b) - resolveSortId(a);
  });
  }, [filteredChallenges, user?.id]);

  const visibleChallenges = useMemo(
    () => sortedChallenges.slice(0, visibleChallengeCount),
    [sortedChallenges, visibleChallengeCount],
  );
  const hasMoreChallenges = visibleChallengeCount < sortedChallenges.length;

  const renderChallengeContent = () => {
    if (challengeStatusTab === "polymarket") {
      return <PolymarketTab onQuickBet={handlePolymarketQuickBet} searchTerm={searchTerm} />;
    }

    return (
      <>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
            {[...Array(6)].map((_, i) => (
              <ChallengeCardSkeleton key={i} />
            ))}
          </div>
        ) : sortedChallenges.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
            {visibleChallenges.map((challenge, index) => (
              <div
                key={challenge?.id ?? `challenge-${index}-${challenge?.createdAt ?? "unknown"}`}
                className="relative"
              >
                {challengeStatusTab === "agents" &&
                  (() => {
                    const createdByAgent = Boolean(
                      challenge?.createdByAgent ||
                        challenge?.created_by_agent ||
                        challenge?.creatorAgentId ||
                        challenge?.creator_agent_id,
                    );
                    if (!createdByAgent) return null;
                    return (
                      <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-[10px] px-2 py-0.5">
                        <AgentIcon className="h-3 w-3" alt="" />
                        Agent
                      </span>
                    );
                  })()}
                <ChallengeCard
                  challenge={challenge}
                  onChatClick={handleChallengeClick}
                  onJoin={handleJoin}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
              {challengeStatusTab === "agents" ? (
                <AgentIcon className="h-8 w-8" />
              ) : (
                <Search className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {challengeStatusTab === "agents" ? "No agent challenges yet" : "No challenges found"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              {challengeStatusTab === "agents"
                ? "Agent-created and agent-involved challenges will appear here once we start matching them into the feed."
                : "Try adjusting your search or category filters"}
            </p>
          </div>
        )}
        {!isLoading && hasMoreChallenges && (
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              variant="outline"
              className="h-8 px-4 text-xs"
              onClick={() => setVisibleChallengeCount((count) => count + 12)}
            >
              Load more challenges
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 theme-transition pb-[50px]">
      <div className="max-w-7xl mx-auto px-3 md:px-4 sm:px-6 lg:px-8 py-2 md:py-4">
        <CategoryBar
          categories={categoryTabs}
          selectedCategory={selectedCategory}
          onSelect={(id) => {
            if (id === 'create') {
              setIsCreateDialogOpen(true);
              return;
            }
            setSelectedCategory(id);
          }}
        />

        {/* Challenge Status Tabs */}
        <div className="overflow-x-auto scrollbar-hide -mx-3 px-3 pb-1 flex justify-center">
          <Tabs
            defaultValue="all"
            value={challengeStatusTab}
            onValueChange={(val) => setChallengeStatusTab(val as any)}
            className="w-full md:w-auto"
          >
            <TabsList className="flex h-8 border-0 shadow-none bg-transparent gap-1 items-center justify-center w-fit mx-auto">
              <TabsTrigger 
                value="all" 
                className="relative text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                <span>All</span>
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border border-white dark:border-slate-900 pointer-events-none">
                  {allTabCount}
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="agents" 
                className="relative text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                <span>Agents</span>
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border border-white dark:border-slate-900 pointer-events-none">
                  {agentTabCount}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="polymarket"
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                Polymarket
              </TabsTrigger>
              <TabsTrigger 
                value="p2p" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                P2P
              </TabsTrigger>
              <TabsTrigger 
                value="open" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                Open
              </TabsTrigger>
              <TabsTrigger
                value="updown" 
                className="relative text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                Up/Down
                <span className="pointer-events-none absolute -top-1 -right-2">
                  <span className="relative inline-flex items-center gap-0 rounded-full border border-emerald-200 bg-white px-1 h-4 shadow-sm">
                    <span className="absolute inset-0 rounded-full animate-ping bg-emerald-300/50" />
                    <ArrowUp className="relative h-3 w-3 text-emerald-600" />
                    <ArrowDown className="relative h-3 w-3 text-red-600" />
                  </span>
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="communities" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                Communities
              </TabsTrigger>
              <TabsTrigger 
                value="active" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                Active
              </TabsTrigger>
              <TabsTrigger 
                value="pending" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                Pending
              </TabsTrigger>
              <TabsTrigger 
                value="finished" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                Finished
              </TabsTrigger>
            </TabsList>

          </Tabs>
        </div>

        <div className="mt-4">
          {renderChallengeContent()}
        </div>

        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              setPreSelectedUser(null);
              setCreateMode('open');
              setAgentFlowMode("bantah");
              form.reset();
              setCoverImageFile(null);
              setCoverPreview(null);
              setAgentDisplayName("");
              setAgentSpecialty("general");
            }
          }}
        >
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] top-auto bottom-3 translate-y-0 rounded-[24px] border-0 bg-white p-3 pb-4 shadow-2xl max-h-[calc(100dvh-4.5rem)] overflow-y-auto scrollbar-hide sm:max-w-sm sm:top-[50%] sm:bottom-auto sm:translate-y-[-50%] dark:bg-slate-900">
            <DialogHeader className="pb-1">
              <DialogTitle className="flex items-center justify-center space-x-2 text-[15px] sm:text-base">
                {preSelectedUser ? (
                  <>
                    <UserAvatar
                      userId={preSelectedUser.id}
                      username={preSelectedUser.username}
                      size={24}
                      className="h-6 w-6"
                    />
                    <span>
                      Challenge{" "}
                      {preSelectedUser.firstName || preSelectedUser.username}
                    </span>
                  </>
                ) : (
                  <>
                    <img src="/assets/bantahblue.svg" alt="Bantah" className="h-6 w-6" />
                    <span>{createMode === "agent" ? "Create an Agent" : "Create a Challenge"}</span>
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Create a new challenge or challenge a specific user to test your predictions and win rewards.
              </DialogDescription>
            </DialogHeader>
            <div className="mb-2 flex items-center justify-center space-x-2">
              <button
                type="button"
                onClick={() => setCreateMode('open')}
                className={cn(
                  "flex-1 rounded-full px-3 py-1 text-xs font-semibold",
                  createMode === 'open'
                    ? 'bg-[#ccff00] text-black'
                    : 'bg-transparent text-slate-600 dark:text-slate-300 border border-transparent hover:bg-slate-100'
                )}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateMode('agent');
                  setAgentFlowMode("bantah");
                }}
                className={cn(
                  "flex-1 rounded-full px-3 py-1 text-xs font-semibold",
                  createMode === 'agent'
                    ? 'bg-[#ccff00] text-black'
                    : 'bg-transparent text-slate-600 dark:text-slate-300 border border-transparent hover:bg-slate-100'
                )}
              >
                Agent
              </button>
            </div>
            <Form {...form}>
              <form
                onSubmit={handleFormSubmit}
                className="space-y-2.5"
              >
                {createMode === 'agent' ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      {agentFlowCards.map((card) => {
                        const isActive = agentFlowMode === card.key;
                        return (
                          <button
                            key={card.key}
                            type="button"
                            onClick={() => {
                              setAgentFlowMode(card.key);
                              if (card.key !== "bantah") {
                                setAgentImportMode(card.key);
                              }
                            }}
                            className={cn(
                              "rounded-2xl border px-3 py-2 text-left transition",
                              isActive
                                ? "border-[#ccff00] bg-[#f7ffcc] shadow-sm dark:border-[#ccff00]/50 dark:bg-[#ccff00]/10"
                                : "border-slate-200 bg-slate-50/90 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:bg-slate-800",
                            )}
                          >
                            <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                              {card.title}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {agentFlowMode === "bantah" ? (
                      <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0 space-y-0.5">
                          <label
                            htmlFor="agent-display-name"
                            className="text-[10px] font-semibold tracking-normal text-slate-600 dark:text-slate-400"
                          >
                            Agent name
                          </label>
                          <Input
                            id="agent-display-name"
                            placeholder="Bantah Alpha"
                            className="h-9 rounded-xl border-transparent bg-slate-50/90 text-xs placeholder:text-xs dark:bg-slate-800/80"
                            value={agentDisplayName}
                            onChange={(event) => setAgentDisplayName(event.target.value)}
                          />
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <label
                            htmlFor="agent-specialty"
                            className="text-[10px] font-semibold tracking-normal text-slate-600 dark:text-slate-400"
                          >
                            Agent specialty
                          </label>
                          <Select
                            value={agentSpecialty}
                            onValueChange={(value) =>
                              setAgentSpecialty(value as BantahAgentSpecialty)
                            }
                            >
                              <SelectTrigger
                                id="agent-specialty"
                                className="h-9 rounded-xl border-0 bg-slate-50/90 text-sm shadow-none focus:ring-0 focus:ring-offset-0 dark:border-0 dark:bg-slate-800/80 dark:focus:ring-0 dark:focus:ring-offset-0"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <span aria-hidden="true" className="text-sm">
                                    {getAgentSpecialtyMeta(agentSpecialty).emoji}
                                  </span>
                                  <span className="truncate">{getAgentSpecialtyMeta(agentSpecialty).label}</span>
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
                        <label
                        htmlFor="agent-avatar-upload"
                        className="text-[10px] font-semibold tracking-normal text-slate-600 dark:text-slate-400"
                      >
                        Agent avatar
                      </label>
                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm dark:bg-slate-800">
                          {agentAvatarPreview ? (
                            <img
                              src={agentAvatarPreview}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <AgentIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <label
                            htmlFor="agent-avatar-upload"
                            className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg bg-white px-3 text-[10px] font-semibold text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <Upload className="h-3 w-3" />
                            {agentAvatarPreview ? "Change avatar" : "Upload avatar"}
                          </label>
                          {agentAvatarPreview ? (
                            <button
                              type="button"
                              onClick={clearAgentAvatar}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-3 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              <X className="h-3 w-3" />
                              Remove
                            </button>
                          ) : null}
                        </div>
                        <input
                          id="agent-avatar-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleAgentAvatarSelect}
                          className="hidden"
                        />
                      </div>
                    </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
                      <div className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                        Bantah Skills
                      </div>
                    </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                          <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                            {agentFlowMode === "eliza"
                              ? "Import a running Eliza agent"
                              : agentFlowMode === "virtuals"
                              ? "Import a Virtuals-backed agent"
                              : "Manual Bantah-compatible import"}
                          </p>
                          <p className="mt-1 text-[10px] leading-5 text-slate-500 dark:text-slate-400">
                            {agentFlowMode === "eliza"
                              ? "Use this when you already run the agent elsewhere and need Bantah to verify the endpoint, wallet, and supported actions."
                              : agentFlowMode === "virtuals"
                              ? "Use this when the agent already has a callable runtime or adapter. A token or listing by itself is not enough for Bantah import."
                              : "Use this if you have a custom endpoint and wallet that already implement the Bantah skill contract."}
                          </p>
                        </div>

                      </div>
                    )}

                    <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Your agents
                          </p>
                        </div>
                        <Badge className="h-6 border-0 bg-slate-200 px-2 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {ownedAgents.length}
                        </Badge>
                      </div>

                      {ownedAgents.length > 0 ? (
                        <div className="mt-2 space-y-1.5">
                          {ownedAgents.map((agent) => (
                            <div
                              key={agent.agentId}
                              className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-slate-800"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                                  {agent.agentName}
                                </p>
                                <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                                  {agent.specialty} · {String(agent.walletAddress).slice(0, 6)}...
                                  {String(agent.walletAddress).slice(-4)}
                                </p>
                              </div>
                              <Badge
                                className={cn(
                                  "border-0 text-[10px]",
                                  agent.lastSkillCheckStatus === "passed"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                                    : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
                                )}
                              >
                                {agent.lastSkillCheckStatus === "passed" ? "Verified" : "Active"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 rounded-xl bg-white px-3 py-2 text-[10px] text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                          No agents yet.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                <>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-[10px] font-semibold tracking-normal text-slate-600 dark:text-slate-400">
                        Market Question
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Will BTC be above $70k by May 1?"
                          className="h-9 rounded-xl border-transparent bg-slate-50/90 text-xs placeholder:text-xs dark:bg-slate-800/80"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                {!preSelectedUser && createMode === 'open' && (
                  <FormField
                    control={form.control}
                    name="challenged"
                    render={({ field }) => (
                      <FormItem className="space-y-0.5">
                        <FormLabel className="text-[10px] font-semibold tracking-normal text-slate-600 dark:text-slate-400">
                          Opponent
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="@username for P2P, leave empty for open"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            className="h-9 rounded-xl border-transparent bg-slate-50/90 text-xs placeholder:text-xs dark:bg-slate-800/80"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                )}

                {preSelectedUser && (
                  <div className="flex items-center space-x-2 rounded-lg bg-blue-50 p-1.5 dark:bg-blue-900/20">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-[11px] font-bold text-white">
                      {(
                        preSelectedUser.firstName ||
                        preSelectedUser.username ||
                        "U"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-xs">
                        {preSelectedUser.firstName ||
                          preSelectedUser.username}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Level {preSelectedUser.level || 1} -{" "}
                        {preSelectedUser.points || 0} BantCredit
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-1.5">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem className="space-y-0.5">
                        <FormLabel className="text-[10px] font-semibold tracking-normal text-slate-600 dark:text-slate-400">
                          Category
                        </FormLabel>
                        {(() => {
                          const selectedCategoryOption = categoryOptions.find(
                            (category) => category.value === field.value,
                          );

                          return (
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9 rounded-xl border-0 bg-slate-50/90 text-sm shadow-none focus:ring-0 focus:ring-offset-0 dark:border-0 dark:bg-slate-800/80 dark:focus:ring-0 dark:focus:ring-offset-0">
                              {selectedCategoryOption ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm" aria-hidden="true">
                                    {selectedCategoryOption.emoji}
                                  </span>
                                  <span>{selectedCategoryOption.label}</span>
                                </div>
                              ) : (
                                <SelectValue placeholder="Select a category" />
                              )}
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl border-0 bg-white shadow-lg dark:bg-slate-800">
                            {categoryOptions.map((category) => (
                              <SelectItem
                                key={category.value}
                                value={category.value}
                              >
                                <div className="flex items-center space-x-2">
                                  {category.emoji ? (
                                    <span className="text-sm" aria-hidden="true">
                                      {category.emoji}
                                    </span>
                                  ) : null}
                                  <span>{category.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                          );
                        })()}
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem className="space-y-0.5">
                        <FormLabel className="text-[10px] font-semibold tracking-normal text-slate-600 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Deadline
                          </span>
                        </FormLabel>
                        <FormControl>
                          <div
                            ref={dueDatePickerRef}
                            className="bantah-datetime-wrap"
                            onClick={() => {
                              setIsCalendarOpen(true);
                            }}
                          >
                            <DateTimePicker
                              onChange={(value) => {
                                if (!value || Number.isNaN(value.getTime())) {
                                  field.onChange("");
                                  return;
                                }
                                field.onChange(value.toISOString());
                              }}
                              value={
                                field.value && !Number.isNaN(new Date(field.value).getTime())
                                  ? new Date(field.value)
                                  : null
                              }
                              format="MMM d, yyyy h:mm a"
                              isCalendarOpen={isCalendarOpen}
                              isClockOpen={isClockOpen}
                              onCalendarOpen={() => setIsCalendarOpen(true)}
                              onCalendarClose={() => setIsCalendarOpen(false)}
                              onClockOpen={() => setIsClockOpen(true)}
                              onClockClose={() => setIsClockOpen(false)}
                              shouldOpenWidgets={() => true}
                              openWidgetsOnFocus
                              calendarIcon={null}
                              clearIcon={null}
                              className={cn(
                                "bantah-datetime",
                                !field.value && "bantah-datetime--icon-only",
                              )}
                              calendarProps={{ className: "bantah-datetime__calendar" }}
                            />
                            {!field.value && (
                              <span
                                className="bantah-datetime__placeholder"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setIsCalendarOpen(true);
                                }}
                              >
                                Pick a date
                              </span>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold tracking-normal text-slate-600 dark:text-slate-400">
                    Cover Image
                  </p>
                  {!coverPreview ? (
                    <label
                      htmlFor="challenge-cover-upload"
                      className="mt-1 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload cover</span>
                    </label>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                        <img
                          src={coverPreview}
                          alt="Challenge cover preview"
                          className="h-24 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={clearCoverImage}
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <label
                        htmlFor="challenge-cover-upload"
                        className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg bg-slate-100 px-3 text-[10px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Upload className="h-3 w-3" />
                        <span>Change image</span>
                      </label>
                    </div>
                  )}
                  <input
                    id="challenge-cover-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleCoverSelect}
                    className="hidden"
                  />
                </div>

                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold tracking-normal text-slate-600 dark:text-slate-400">
                    Currency & Stake
                  </p>
                  <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-1.5">
                    <FormField
                      control={form.control}
                      name="tokenSymbol"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormLabel className="sr-only">Token</FormLabel>
                          {(() => {
                            const selectedToken = (field.value || selectedTokenSymbol) as OnchainTokenSymbol;

                            return (
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9 rounded-xl border-0 bg-slate-50/90 text-sm shadow-none focus:ring-0 focus:ring-offset-0 dark:border-0 dark:bg-slate-800/80 dark:focus:ring-0 dark:focus:ring-offset-0">
                                {selectedToken ? (
                                  <div className="flex items-center gap-2">
                                    <TokenMark token={selectedToken} />
                                    <span>{selectedToken}</span>
                                  </div>
                                ) : (
                                  <SelectValue placeholder="Token" />
                                )}
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl border-0 bg-white shadow-lg dark:bg-slate-800">
                              {tokenOptions.map((token) => (
                                <SelectItem key={token} value={token}>
                                  <div className="flex items-center gap-2">
                                    <TokenMark token={token} />
                                    <span>{token}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                            );
                          })()}
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormLabel className="sr-only">
                          Stake amount
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="500"
                            className="h-9 rounded-xl border-0 bg-slate-50/90 text-xs placeholder:text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-0 dark:bg-slate-800/80 dark:focus-visible:ring-0 dark:focus-visible:ring-offset-0"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>
                </div>

                <FormField
                  control={form.control}
                  name="challengerSide"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-[10px] font-semibold tracking-normal text-slate-600 dark:text-slate-400">Your Position</FormLabel>
                      <FormControl>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => field.onChange("YES")}
                            className={cn(
                              "flex-1 rounded-lg border-2 py-1 text-xs font-semibold transition-colors",
                              field.value === "YES"
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-400 dark:border-blue-600"
                            )}
                          >
                            YES
                          </button>
                          <button
                            type="button"
                            onClick={() => field.onChange("NO")}
                            className={cn(
                              "flex-1 rounded-lg border-2 py-1 text-xs font-semibold transition-colors",
                              field.value === "NO"
                                ? "bg-red-600 text-white border-red-600"
                                : "bg-white text-red-600 border-red-300 hover:bg-red-50 dark:bg-slate-800 dark:text-red-400 dark:border-red-600"
                            )}
                          >
                            NO
                          </button>
                        </div>
                      </FormControl>
                      <p className="mt-0.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
                        Opponent picks {form.watch("challengerSide") === "YES" ? "NO" : "YES"}
                      </p>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-1 rounded-xl border-0 bg-slate-50/90 px-2 py-1.5 dark:bg-slate-900/70">
                  <div className="text-center">
                    <p className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Position</p>
                    <p className="text-[11px] font-semibold leading-tight text-slate-900 dark:text-slate-100">
                      {form.watch("challengerSide")}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Stake</p>
                    <p className="truncate text-[11px] font-semibold leading-tight text-slate-900 dark:text-slate-100">
                      {form.watch("amount") ? `${Number(form.watch("amount") || 0).toLocaleString()} ${selectedTokenSymbol}` : `0 ${selectedTokenSymbol}`}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Payout</p>
                    <div className="mt-0.5 inline-flex items-center justify-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                      {form.watch("amount")
                        ? `${(Number(form.watch("amount") || 0) * 2).toLocaleString()} ${selectedTokenSymbol}`
                        : `0 ${selectedTokenSymbol}`}
                    </div>
                  </div>
                </div>

                </>
                )}

                <div className="flex space-x-2 pt-1">
                  <Button
                    type="button"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      clearAgentAvatar();
                    }}
                    className="h-9 flex-1 rounded-xl bg-slate-100 text-sm text-slate-700 hover:bg-slate-200"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createMode === "agent"
                        ? agentFlowMode === "bantah"
                          ? !agentDisplayName.trim() ||
                            !canProvisionAgentOnSelectedChain ||
                            createAgentMutation.isPending ||
                            isAgentAvatarUploading
                          : false
                        : createChallengeMutation.isPending || isCoverUploading || isPreparingChallenge
                    }
                    className="h-9 flex-1 rounded-xl text-sm text-black hover:opacity-90"
                    style={{ backgroundColor: '#ccff00' }}
                  >
                    {createMode === "agent"
                      ? agentFlowMode === "bantah"
                        ? isAgentAvatarUploading
                          ? "Uploading Avatar..."
                          : createAgentMutation.isPending
                          ? "Creating Agent..."
                          : "Create Agent"
                        : "Continue to Import"
                      : isPreparingChallenge
                      ? "Locking stake..."
                      : createChallengeMutation.isPending
                      ? "Creating..."
                      : "Create Challenge"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <AgentImportDialog
          open={isImportAgentDialogOpen}
          onOpenChange={setIsImportAgentDialogOpen}
          mode={agentImportMode}
          onModeChange={setAgentImportMode}
          initialName={agentDisplayName.trim()}
          initialSpecialty={agentSpecialty}
          onImported={handleImportedAgent}
        />

        {/* Search results and other content below the feed */}
        {searchTerm && (
          <div className="mt-8 space-y-6">
             {/* Search content... */}
          </div>
        )}
      </div>

      {/* Challenge Chat Dialog */}
      {showChat && selectedChallenge && (
        <Dialog open={showChat} onOpenChange={setShowChat}>
          <DialogContent className="sm:max-w-4xl max-h-[80vh] p-0">
            <ChallengeChat
              challenge={selectedChallenge}
              onClose={() => setShowChat(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Polymarket quick bet modal */}
      {showPolymarketBetModal && polymarketBet && (
        <Dialog
          open={showPolymarketBetModal}
          onOpenChange={(open) => {
            setShowPolymarketBetModal(open);
            if (!open) setPolymarketBet(null);
          }}
        >
            <DialogContent className="w-[calc(100%-24px)] max-w-[calc(100%-24px)] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Quick Bet</DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {polymarketBet.market.question}
                </DialogDescription>
              </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-900/60">
                <span className="text-slate-500">Side</span>
                <Badge
                  className={cn(
                    "text-[10px] px-2 py-1",
                    polymarketBet.side === "YES"
                      ? "bg-emerald-500 text-white"
                      : "bg-rose-500 text-white",
                  )}
                >
                  {polymarketBet.side}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-slate-500">
                  Stake ({selectedTokenSymbol})
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder={`Enter stake in ${selectedTokenSymbol}`}
                  value={polymarketStake}
                  onChange={(event) => setPolymarketStake(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-emerald-200/60 bg-emerald-50/70 px-3 py-2 text-[11px] text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-900/10 dark:text-emerald-100 sm:flex-row sm:items-center sm:justify-between">
                <span className="inline-flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  Potential win
                </span>
                <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-50">
                  {(() => {
                    const stakeValue = Number.parseFloat(polymarketStake || "0");
                    if (!Number.isFinite(stakeValue) || stakeValue <= 0) return `0 ${selectedTokenSymbol}`;
                    return `${(stakeValue * 2).toLocaleString()} ${selectedTokenSymbol}`;
                  })()}
                </span>
              </div>
              <Button
                type="button"
                className="w-full bg-[#ccff00] text-black hover:bg-[#b7ec00]"
                onClick={submitPolymarketBet}
                disabled={isPolymarketEnsuring}
              >
                {isPolymarketEnsuring ? "Preparing..." : "Continue"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Join Challenge Modal (for admin-created betting challenges) */}
      {showJoinModal && selectedChallenge && (
        <JoinChallengeModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          challenge={selectedChallenge}
          userBalance={balance && typeof balance === "object" ? (balance as any).balance : (typeof balance === 'number' ? balance : 0)}
        />
      )}

      {isPolymarketEnsuring && (
        <PlayfulLoadingOverlay
          type="betting"
          title="Placing your bet"
          description="Confirm the wallet prompt to lock your stake."
        />
      )}

      <MobileNavigation />
    </div>
  );
}








