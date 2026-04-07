import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWallets } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Zap, Trophy } from "lucide-react";
import {
  executeOnchainEscrowStakeTx,
  type OnchainRuntimeConfig,
  type OnchainTokenSymbol,
} from "@/lib/onchainEscrow";

interface JoinChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: {
    id: number;
    title: string;
    category: string;
    amount: string | number;
    description?: string;
    selectedSide?: string;
    settlementRail?: string | null;
    settlement_rail?: string | null;
    chainId?: number | null;
    chain_id?: number | null;
    tokenSymbol?: string | null;
    token_symbol?: string | null;
  };
  userBalance: number;
}

function normalizeSide(value?: string): "YES" | "NO" | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return normalized === "YES" || normalized === "NO" ? normalized : null;
}

function isUpDownMarketChallenge(challenge: { title?: string; category?: string } | null | undefined) {
  const title = String(challenge?.title || "").toLowerCase();
  const category = String(challenge?.category || "").toLowerCase();
  const hasBitcoin = title.includes("bitcoin") || title.includes("btc");
  const hasDirectionPhrase =
    title.includes("up or down") ||
    title.includes("up/down") ||
    (title.includes("up") && title.includes("down"));
  return hasBitcoin && hasDirectionPhrase && category === "crypto";
}

export function JoinChallengeModal({
  isOpen,
  onClose,
  challenge,
  userBalance,
}: JoinChallengeModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { wallets } = useWallets();
  const queryClient = useQueryClient();
  const isOnchainBuild = (import.meta as any).env?.VITE_APP_MODE === "onchain";
  const { data: onchainConfig } = useQuery<OnchainRuntimeConfig>({
    queryKey: ["/api/onchain/config"],
    queryFn: async () => await apiRequest("GET", "/api/onchain/config"),
    retry: false,
    enabled: isOnchainBuild,
    staleTime: 1000 * 60 * 5,
  });
  const [selectedSide, setSelectedSide] = useState<"YES" | "NO" | null>(normalizeSide(challenge.selectedSide));
  const [isWaiting, setIsWaiting] = useState(false);
  const [btcSeries, setBtcSeries] = useState<number[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedSide(normalizeSide(challenge.selectedSide));
  }, [challenge.id, challenge.selectedSide, isOpen]);

  const isUpDownMarket = isUpDownMarketChallenge(challenge);
  const sideYesLabel = isUpDownMarket ? "UP" : "YES";
  const sideNoLabel = isUpDownMarket ? "DOWN" : "NO";

  useEffect(() => {
    if (!isOpen || !isUpDownMarket) {
      setBtcSeries([]);
      return;
    }

    let cancelled = false;
    const fetchBtcSeries = async () => {
      try {
        const response = await fetch(
          "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=24",
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (!Array.isArray(payload)) return;

        const prices = payload
          .map((entry: any) => Number(entry?.[4]))
          .filter((value: number) => Number.isFinite(value));

        if (!cancelled && prices.length > 1) {
          setBtcSeries(prices);
        }
      } catch {
        // Ignore transient API issues in modal context.
      }
    };

    fetchBtcSeries();
    const interval = window.setInterval(fetchBtcSeries, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isOpen, isUpDownMarket]);

  const stakeAmount = Number.parseInt(String(challenge.amount || "0"), 10) || 0;
  const potentialWin = stakeAmount * 2;
  const normalizedBalance = Number(userBalance || 0);
  const challengeRail = String(
    challenge?.settlementRail || challenge?.settlement_rail || "",
  ).toLowerCase();
  const isOnchainChallenge = isOnchainBuild && (challengeRail === "onchain" || !challengeRail);
  const requiresContractEscrow = Boolean(
    isOnchainChallenge && onchainConfig?.contractEnabled,
  );
  const tokenSymbol = String(
    challenge?.tokenSymbol || challenge?.token_symbol || onchainConfig?.defaultToken || "ETH",
  ).toUpperCase();
  const formatStakeLabel = (amount: number) =>
    isOnchainChallenge ? `${amount.toLocaleString()} ${tokenSymbol}` : `NGN ${amount.toLocaleString()}`;

  const getCategoryEmoji = (category?: string | null) => {
    const cats: Record<string, string> = {
      crypto: "BTC",
      sports: "SPORT",
      gaming: "GAME",
      music: "MUSIC",
      politics: "POL",
      polymarket: "PM",
      tech: "TECH",
      lifestyle: "LIFE",
      entertainment: "ENT",
    };
    const key = String(category || "").toLowerCase().trim();
    return cats[key] || "CH";
  };

  const updateChallengesCache = (challengeSnapshot?: any) => {
    queryClient.setQueryData<any[]>(["/api/challenges"], (existing) => {
      if (!Array.isArray(existing)) return existing;

      return existing.map((item: any) => {
        if (Number(item?.id) !== Number(challenge.id)) return item;

        const incomingPreviewUsers = Array.isArray(challengeSnapshot?.participantPreviewUsers)
          ? challengeSnapshot.participantPreviewUsers
          : [];
        const currentPreviewUsers = Array.isArray(item?.participantPreviewUsers)
          ? item.participantPreviewUsers
          : [];

        const mergedPreviewUsers = incomingPreviewUsers.length > 0
          ? incomingPreviewUsers
          : currentPreviewUsers;

        const fallbackJoinedUser = user?.id
          ? [{
              id: user.id,
              username: (user as any)?.username || null,
              firstName: (user as any)?.firstName || null,
              profileImageUrl: (user as any)?.profileImageUrl || null,
              side: selectedSide,
            }]
          : [];

        const dedupedPreviewUsers = [...mergedPreviewUsers, ...fallbackJoinedUser]
          .filter((entry: any, idx: number, arr: any[]) => {
            const entryId = String(entry?.id || "").trim();
            if (!entryId) return false;
            return arr.findIndex((x: any) => String(x?.id || "").trim() === entryId) === idx;
          })
          .slice(0, 2);

        const currentCount = Number(item?.participantCount || 0);
        const incomingCount = Number(challengeSnapshot?.participantCount || 0);
        const nextCount = Math.max(
          currentCount + (incomingCount > currentCount ? 0 : 1),
          incomingCount,
          dedupedPreviewUsers.length,
        );

        return {
          ...item,
          participantCount: nextCount,
          participantPreviewUsers: dedupedPreviewUsers,
          ...(challengeSnapshot ? {
            status: challengeSnapshot.status ?? item?.status,
            yesStakeTotal: challengeSnapshot.yesStakeTotal ?? item?.yesStakeTotal,
            noStakeTotal: challengeSnapshot.noStakeTotal ?? item?.noStakeTotal,
          } : {}),
        };
      });
    });
  };

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSide) {
        throw new Error(isUpDownMarket ? "Please select UP or DOWN" : "Please select YES or NO");
      }

      if (stakeAmount <= 0) {
        throw new Error("Invalid stake amount");
      }

      if (!requiresContractEscrow && stakeAmount > normalizedBalance) {
        throw new Error("Insufficient balance");
      }

      const payload: Record<string, any> = {
        side: selectedSide,
        stakeAmount,
      };

      if (requiresContractEscrow && onchainConfig) {
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
            challenge?.chainId || challenge?.chain_id || onchainConfig.defaultChainId,
          ),
          challengeId: Number(challenge?.id),
          tokenSymbol: tokenSymbol as OnchainTokenSymbol,
          amount: String(stakeAmount),
        });
        payload.escrowTxHash = escrowTx.escrowTxHash;
        payload.walletAddress = escrowTx.walletAddress;
        toast({
          title: "Escrow locked",
          description: `${stakeAmount.toLocaleString()} ${tokenSymbol} secured in escrow.`,
        });
      }

      return await apiRequest("POST", `/api/challenges/${challenge.id}/queue/join`, payload);
    },
    onSuccess: (result) => {
      setIsWaiting(true);
      updateChallengesCache(result?.challenge);

      if (result?.match) {
        toast({
          title: "Matched",
          description: `Opponent found. ${formatStakeLabel(stakeAmount)} locked in escrow.`,
        });
      } else {
        toast({
          title: "Queued for matching",
          description: `Position ${result?.queuePosition || 1}. ${formatStakeLabel(stakeAmount)} held in escrow.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });

      setTimeout(() => {
        onClose();
        setIsWaiting(false);
        setSelectedSide(null);
      }, 1200);
    },
    onError: (error: Error) => {
      const isUnauthorized = /401|unauthorized/i.test(error.message || "");
      const isWalletRequired = /WALLET_REQUIRED|Wallet required|Connect an EVM wallet/i.test(
        error.message || "",
      );
      toast({
        title: isUnauthorized
          ? "Session expired"
          : isWalletRequired
            ? "Wallet required"
            : "Error",
        description: isUnauthorized
          ? "Please sign in again, then retry joining this challenge."
          : isWalletRequired
            ? "Connect an EVM wallet in Privy, then retry joining."
            : error.message,
        variant: "destructive",
      });
    },
  });

  const isBalanceSufficient = requiresContractEscrow || normalizedBalance >= stakeAmount;
  const btcLastPrice = btcSeries.length > 0 ? btcSeries[btcSeries.length - 1] : null;
  const btcFirstPrice = btcSeries.length > 0 ? btcSeries[0] : null;
  const btcDelta = btcLastPrice !== null && btcFirstPrice !== null ? btcLastPrice - btcFirstPrice : null;
  const btcMin = btcSeries.length > 0 ? Math.min(...btcSeries) : 0;
  const btcMax = btcSeries.length > 0 ? Math.max(...btcSeries) : 0;
  const btcRange = btcMax - btcMin;
  const btcPath =
    btcSeries.length > 1
      ? btcSeries
          .map((price, index) => {
            const x = (index / (btcSeries.length - 1)) * 100;
            const y = btcRange === 0 ? 50 : ((btcMax - price) / btcRange) * 100;
            return `${x},${y}`;
          })
          .join(" ")
      : "";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-xs p-3 rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="w-4 h-4 text-yellow-500" />
            {isUpDownMarket ? "Join BTC Direction" : "Join Challenge"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isUpDownMarket ? "Pick UP or DOWN for this live 5-minute BTC round" : "Pick your side and lock stake"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-slate-900 dark:bg-slate-800 px-3 py-1.5 rounded-t-md flex items-center justify-between">
            <span className="text-[10px] font-black text-white uppercase tracking-wider">Challenge Entry</span>
            <Zap className="w-3 h-3 text-white/40" />
          </div>

          <div className="bg-white dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700 rounded-b-md p-3 -mt-4">
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 leading-tight">
                {challenge.title}
              </h3>

              <div className="flex flex-wrap items-center justify-between gap-y-2">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] h-5 bg-slate-100 dark:bg-slate-700 border-0 px-2 font-medium">
                      <span className="mr-1">{getCategoryEmoji(challenge.category)}</span>
                      {challenge.category}
                    </Badge>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Stake: {formatStakeLabel(stakeAmount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                      WIN: {formatStakeLabel(potentialWin)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isBalanceSufficient
                        ? "text-green-600 bg-green-50 dark:bg-green-900/20"
                        : "text-red-600 bg-red-50 dark:bg-red-900/20"
                    }`}
                  >
                    {isBalanceSufficient ? (requiresContractEscrow ? "WALLET" : "FUNDED") : "INSUFFICIENT"}
                  </span>
                  {!requiresContractEscrow && (
                    <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                      Wallet: {formatStakeLabel(normalizedBalance)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-primary px-3 py-1.5 rounded-t-md flex items-center justify-between">
            <span className="text-[10px] font-black text-white uppercase tracking-wider">Your Claim</span>
            <Trophy className="w-3 h-3 text-white/40" />
          </div>

          {isUpDownMarket && (
            <div className="-mt-3 rounded-md border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-2.5 py-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  BTC Live
                </span>
                {btcLastPrice !== null && (
                  <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                    ${btcLastPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <div className="h-14 w-full rounded bg-white/80 dark:bg-slate-900/50 p-1">
                {btcSeries.length > 1 ? (
                  <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
                    <polyline
                      fill="none"
                      stroke={btcDelta !== null && btcDelta >= 0 ? "#16a34a" : "#dc2626"}
                      strokeWidth="2"
                      points={btcPath}
                    />
                  </svg>
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-slate-500">
                    Loading BTC chart...
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={`grid grid-cols-2 gap-2 ${isUpDownMarket ? "mt-0" : "-mt-4"}`}>
            <button
              onClick={() => setSelectedSide("YES")}
              className={`py-2 rounded-md text-sm font-semibold transition-all ${
                selectedSide === "YES"
                  ? "bg-green-500 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-white"
              }`}
              data-testid="button-choice-yes"
            >
              {sideYesLabel}
            </button>
            <button
              onClick={() => setSelectedSide("NO")}
              className={`py-2 rounded-md text-sm font-semibold transition-all ${
                selectedSide === "NO"
                  ? "bg-red-500 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-white"
              }`}
              data-testid="button-choice-no"
            >
              {sideNoLabel}
            </button>
          </div>

          {isWaiting && (
            <div className="p-2 text-center text-sm text-slate-600 bg-slate-50 dark:bg-slate-800/30 rounded-md">
              Processing stake and queue placement...
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => joinMutation.mutate()}
            disabled={!selectedSide || !isBalanceSufficient || joinMutation.isPending}
            className="w-full border-0"
            size="sm"
            data-testid="button-confirm-join"
          >
            {joinMutation.isPending ? "Joining..." : "Join"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
