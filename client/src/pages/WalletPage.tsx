import { useState, useEffect } from "react";
import { MobileNavigation } from "@/components/MobileNavigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatDistanceToNow } from "date-fns";
import { formatBalance } from "@/utils/currencyUtils";
import { useWallets } from "@privy-io/react-auth";
import type { OnchainRuntimeConfig } from "@/lib/onchainEscrow";
import { PlayfulLoading } from "@/components/ui/playful-loading";
import {
  ShoppingCart,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  TrendingUp,
  Eye,
  Receipt,
  Plus,
  Minus,
  Gift,
  Calendar,
  Trophy,
  ArrowLeftRight,
  Coins,
  DollarSign,
  Copy,
  SendHorizontal,
  ExternalLink,
} from "lucide-react";
import { useLocation } from "wouter";

type OnchainWalletAsset = {
  chainId: number;
  chainName: string;
  symbol: string;
  decimals: number;
  amountAtomic: string;
  amountFormatted: string;
  isNative: boolean;
};

async function rpcCall(rpcUrl: string, method: string, params: unknown[]) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });
  const json = await response.json();
  if (json?.error) {
    throw new Error(String(json.error?.message || "RPC request failed"));
  }
  return json?.result;
}

function hexToBigInt(value: unknown): bigint {
  if (typeof value !== "string") return 0n;
  const normalized = value.trim().toLowerCase();
  if (!normalized.startsWith("0x")) return 0n;
  try {
    return BigInt(normalized);
  } catch {
    return 0n;
  }
}

function formatAtomicAmount(atomic: bigint, decimals: number, maxFraction = 6): string {
  if (!Number.isInteger(decimals) || decimals <= 0) return atomic.toString();
  const base = 10n ** BigInt(decimals);
  const whole = atomic / base;
  const fraction = atomic % base;
  let fractionText = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  if (fractionText.length > maxFraction) {
    fractionText = fractionText.slice(0, maxFraction).replace(/0+$/, "");
  }
  return fractionText ? `${whole.toString()}.${fractionText}` : whole.toString();
}

function encodeErc20BalanceOf(address: string): string {
  const normalized = address.trim().toLowerCase().replace(/^0x/, "");
  return `0x70a08231${normalized.padStart(64, "0")}`;
}

export default function WalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [isSwapDialogOpen, setIsSwapDialogOpen] = useState(false);
  const [swapAmount, setSwapAmount] = useState("");
  const [swapDirection, setSwapDirection] = useState<
    "money-to-coins" | "coins-to-money"
  >("money-to-coins");
  const [lastDepositAttempt, setLastDepositAttempt] = useState<number>(0);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const appModeRaw = String((import.meta as any).env?.VITE_APP_MODE || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();
  const isOnchainBuild = appModeRaw !== "offchain";
  const { wallets } = useWallets();
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);

  const { data: onchainConfig } = useQuery<OnchainRuntimeConfig>({
    queryKey: ["/api/onchain/config"],
    queryFn: async () => await apiRequest("GET", "/api/onchain/config"),
    retry: false,
    enabled: isOnchainBuild,
    staleTime: 1000 * 60 * 5,
  });

  const walletAddressCandidates = [
    (user as any)?.walletAddress,
    (user as any)?.primaryWalletAddress,
    (user as any)?.wallet?.address,
    Array.isArray((user as any)?.walletAddresses)
      ? (user as any)?.walletAddresses?.[0]
      : null,
    Array.isArray(wallets) && wallets.length > 0 ? (wallets[0] as any)?.address : null,
  ];
  const connectedWalletAddress = (
    walletAddressCandidates.find(
      (entry) => typeof entry === "string" && /^0x[a-fA-F0-9]{40}$/.test(entry.trim()),
    ) || ""
  ).toString();

  const chainOptions = Object.values(onchainConfig?.chains || {}).sort(
    (a, b) => Number(a.chainId) - Number(b.chainId),
  );

  useEffect(() => {
    if (!isOnchainBuild || selectedChainId || chainOptions.length === 0) return;
    setSelectedChainId(
      Number(onchainConfig?.defaultChainId || chainOptions[0]?.chainId || 0),
    );
  }, [isOnchainBuild, selectedChainId, chainOptions, onchainConfig?.defaultChainId]);

  const selectedChain =
    chainOptions.find((chain) => Number(chain.chainId) === Number(selectedChainId)) ||
    chainOptions.find((chain) => Number(chain.chainId) === Number(onchainConfig?.defaultChainId)) ||
    chainOptions[0];

  const { data: onchainAssets = [], isLoading: isOnchainAssetsLoading } = useQuery<OnchainWalletAsset[]>({
    queryKey: [
      "/wallet/onchain/assets",
      connectedWalletAddress || "none",
      selectedChain?.chainId || onchainConfig?.defaultChainId || "default",
    ],
    enabled: Boolean(
      isOnchainBuild &&
        connectedWalletAddress &&
        /^0x[a-fA-F0-9]{40}$/.test(connectedWalletAddress) &&
        chainOptions.length > 0,
    ),
    retry: false,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const assets: OnchainWalletAsset[] = [];
      for (const chain of chainOptions) {
        try {
          const tokens = Object.values(chain.tokens || {});
          const nativeToken = tokens.find((token) => token.isNative) || tokens[0];

          if (nativeToken) {
            const nativeResult = await rpcCall(chain.rpcUrl, "eth_getBalance", [
              connectedWalletAddress,
              "latest",
            ]);
            const nativeAtomic = hexToBigInt(nativeResult);
            assets.push({
              chainId: Number(chain.chainId),
              chainName: chain.name,
              symbol: nativeToken.symbol,
              decimals: Number(nativeToken.decimals || 18),
              amountAtomic: nativeAtomic.toString(),
              amountFormatted: formatAtomicAmount(
                nativeAtomic,
                Number(nativeToken.decimals || 18),
              ),
              isNative: true,
            });
          }

          for (const token of tokens) {
            if (token.isNative || !token.address) continue;
            const balanceCallData = encodeErc20BalanceOf(connectedWalletAddress);
            const erc20Result = await rpcCall(chain.rpcUrl, "eth_call", [
              {
                to: token.address,
                data: balanceCallData,
              },
              "latest",
            ]);
            const tokenAtomic = hexToBigInt(erc20Result);
            assets.push({
              chainId: Number(chain.chainId),
              chainName: chain.name,
              symbol: token.symbol,
              decimals: Number(token.decimals || 18),
              amountAtomic: tokenAtomic.toString(),
              amountFormatted: formatAtomicAmount(
                tokenAtomic,
                Number(token.decimals || 18),
              ),
              isNative: false,
            });
          }
        } catch (error) {
          console.warn(`Failed to fetch chain balances for ${chain.name}:`, error);
        }
      }
      return assets;
    },
  });

  const selectedChainAssets = onchainAssets.filter(
    (asset) => Number(asset.chainId) === Number(selectedChain?.chainId),
  );
  const primaryAsset =
    selectedChainAssets.find(
      (asset) => asset.symbol === String(onchainConfig?.defaultToken || "ETH"),
    ) || selectedChainAssets[0] || null;

  const selectedSwapUrl = (() => {
    const chainId = Number(selectedChain?.chainId || 0);
    if (chainId === 84532) return "https://app.uniswap.org/#/swap?chain=base";
    if (chainId === 421614) return "https://app.uniswap.org/#/swap?chain=arbitrum";
    if (chainId === 56) return "https://pancakeswap.finance/swap?chain=bsc";
    if (chainId === 97) return "https://pancakeswap.finance/swap?chain=bscTestnet";
    return "https://app.uniswap.org/#/swap";
  })();

  const shortWalletAddress =
    connectedWalletAddress && connectedWalletAddress.length > 10
      ? `${connectedWalletAddress.slice(0, 6)}...${connectedWalletAddress.slice(-4)}`
      : connectedWalletAddress;

  const { data: balance = { balance: 0, coins: 0 } } = useQuery({
    queryKey: ["/api/wallet/balance"],
    retry: false,
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
      }
    },
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["/api/transactions"],
    retry: false,
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
      }
    },
  });

  const depositMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await apiRequest("POST", "/api/wallet/deposit", {
        amount,
      });
      return response;
    },
    onSuccess: async (data: any) => {
      console.log("Deposit response:", data);

      if (data.authorization_url && data.reference) {
        // Open payment in modal
        setPaymentUrl(data.authorization_url);
        setPaymentReference(data.reference);
        setIsPaymentModalOpen(true);
      } else {
        console.log("No authorization URL in response");
        toast({
          title: "Payment Error",
          description: "Unable to initialize payment. Please try again.",
          variant: "destructive",
        });
      }
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
      
      // Handle duplicate transaction reference error
      if (error.message.includes("Duplicate Transaction Reference")) {
        toast({
          title: "Transaction Error",
          description: "Please wait a moment and try again. If the issue persists, refresh the page.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Deposit Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (amount: number) => {
      await apiRequest("POST", "/api/wallet/withdraw", { amount });
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Requested",
        description: "Your withdrawal request is being processed!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setIsWithdrawDialogOpen(false);
      setWithdrawAmount("");
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
        title: "Withdrawal Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const swapMutation = useMutation({
    mutationFn: async ({
      amount,
      direction,
    }: {
      amount: number;
      direction: "money-to-coins" | "coins-to-money";
    }) => {
      const response = await apiRequest("POST", "/api/wallet/swap", {
        amount,
        fromCurrency: direction === "money-to-coins" ? "money" : "coins",
        toCurrency: direction === "money-to-coins" ? "coins" : "money",
      });
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Swap Successful",
        description: `Successfully swapped ${data.fromAmount} ${data.fromCurrency} for ${data.toAmount} ${data.toCurrency}!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setIsSwapDialogOpen(false);
      setSwapAmount("");
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
        title: "Swap Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    const now = Date.now();
    
    // Prevent rapid successive attempts (3 second cooldown)
    if (now - lastDepositAttempt < 3000) {
      toast({
        title: "Please Wait",
        description: "Please wait a moment before trying again.",
        variant: "destructive",
      });
      return;
    }
    
    if (amount > 0) {
      setLastDepositAttempt(now);
      depositMutation.mutate(amount);
    }
  };

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    const currentBalance =
      typeof balance === "object" ? balance.balance : balance;
    if (amount > 0 && amount <= currentBalance) {
      withdrawMutation.mutate(amount);
    } else {
      toast({
        title: "Invalid Amount",
        description: "Withdrawal amount exceeds your balance.",
        variant: "destructive",
      });
    }
  };

  const handleSwap = () => {
    const amount = parseFloat(swapAmount);
    const currentBalance =
      typeof balance === "object" ? balance.balance : balance;
    const currentCoins = typeof balance === "object" ? balance.coins : 0;

    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount.",
        variant: "destructive",
      });
      return;
    }

    if (swapDirection === "money-to-coins" && amount > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough money to swap.",
        variant: "destructive",
      });
      return;
    }

    if (swapDirection === "coins-to-money" && amount > currentCoins) {
      toast({
        title: "Insufficient Coins",
        description: "You don't have enough coins to swap.",
        variant: "destructive",
      });
      return;
    }

    swapMutation.mutate({ amount, direction: swapDirection });
  };

  if (!user) return null;

  const currentBalance =
    typeof balance === "object" ? balance.balance || 0 : balance || 0;
  const currentCoins = typeof balance === "object" ? balance.coins || 0 : 0;

  const formatOnchainAmount = (amount: string | number, symbol: string) => {
    const numeric = typeof amount === "number" ? amount : Number(amount || 0);
    return `${numeric.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    })} ${symbol}`;
  };

  const formatTransactionAmount = (transaction: any) => {
    const parsedAmount = Number(transaction?.amount || 0);
    const isCoinTx = [
      "Gifted",
      "Gift received",
      "coins_locked",
      "challenge_queue_stake",
      "challenge_escrow",
    ].includes(String(transaction?.type || ""));

    if (isCoinTx) {
      return `${Math.abs(parseInt(String(transaction?.amount || 0), 10)).toLocaleString()} coins`;
    }

    if (isOnchainBuild) {
      const txTokenSymbol = String(
        transaction?.tokenSymbol ||
          transaction?.token_symbol ||
          onchainConfig?.defaultToken ||
          "ETH",
      ).toUpperCase();
      return formatOnchainAmount(Math.abs(parsedAmount), txTokenSymbol);
    }

    return formatBalance(parsedAmount);
  };

  const copyWalletAddress = async () => {
    if (!connectedWalletAddress) return;
    try {
      await navigator.clipboard.writeText(connectedWalletAddress);
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy wallet address. Please copy manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 theme-transition pb-[50px]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-6"></div>

        {isOnchainBuild ? (
          <>
            {/* Onchain Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-800/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-200 dark:bg-emerald-700 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                  </div>
                  <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200 text-[10px]">
                    {selectedChain?.name || "Onchain"}
                  </Badge>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Wallet Balance
                  </p>
                  <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                    {isOnchainAssetsLoading
                      ? "Loading..."
                      : primaryAsset
                        ? `${primaryAsset.amountFormatted} ${primaryAsset.symbol}`
                        : "0"}
                  </h3>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-200/80 truncate">
                    {shortWalletAddress || "Connect wallet in Sign In"}
                  </p>
                </div>
              </div>

              <div className="bg-sky-50 dark:bg-sky-900/20 rounded-2xl p-4 border border-sky-100 dark:border-sky-800/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-200 dark:bg-sky-700 flex items-center justify-center">
                    <Coins className="w-4 h-4 text-sky-700 dark:text-sky-300" />
                  </div>
                  <Badge className="border-0 bg-sky-100 text-sky-700 dark:bg-sky-800 dark:text-sky-200 text-[10px]">
                    Assets
                  </Badge>
                </div>
                <div className="space-y-1">
                  {selectedChainAssets.length === 0 ? (
                    <p className="text-xs text-sky-700 dark:text-sky-200">
                      No token balances yet.
                    </p>
                  ) : (
                    selectedChainAssets.map((asset) => (
                      <div key={`${asset.chainId}-${asset.symbol}`} className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-sky-900 dark:text-sky-100">
                          {asset.symbol}
                        </span>
                        <span className="text-sky-700 dark:text-sky-200">
                          {asset.amountFormatted}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Chain Selector */}
            {chainOptions.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 mb-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                  Network
                </p>
                <div className="flex flex-wrap gap-2">
                  {chainOptions.map((chain) => (
                    <button
                      key={chain.chainId}
                      type="button"
                      onClick={() => setSelectedChainId(Number(chain.chainId))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        Number(selectedChain?.chainId) === Number(chain.chainId)
                          ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                          : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600"
                      }`}
                    >
                      {chain.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-800/30">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-200 dark:bg-emerald-700 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                </div>
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-xs font-medium">+5.2%</span>
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  Main Balance
                </p>
                <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                  {formatBalance(currentBalance)}
                </h3>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-800/30">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-amber-200 dark:bg-amber-700 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                </div>
                <div className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-700 flex items-center justify-center">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    {currentCoins > 999 ? "1K+" : currentCoins}
                  </span>
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Bantah Bucks
                </p>
                <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100">
                  {currentCoins.toLocaleString()}
                </h3>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 mb-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
            Quick Actions
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <Dialog
              open={isDepositDialogOpen}
              onOpenChange={setIsDepositDialogOpen}
            >
              <DialogTrigger asChild>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800/30 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="w-8 h-8 rounded-xl bg-blue-200 dark:bg-blue-700 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-blue-700 dark:text-blue-300" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-xs">
                        {isOnchainBuild ? "Receive" : "Add Money"}
                      </h4>
                    </div>
                  </div>
                </div>
              </DialogTrigger>
            </Dialog>

            <Dialog open={isSwapDialogOpen} onOpenChange={setIsSwapDialogOpen}>
              <DialogTrigger asChild>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-100 dark:border-green-800/30 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="w-8 h-8 rounded-xl bg-green-200 dark:bg-green-700 flex items-center justify-center">
                      <ArrowLeftRight className="w-4 h-4 text-green-700 dark:text-green-300" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-green-900 dark:text-green-100 text-xs">
                        Swap
                      </h4>
                    </div>
                  </div>
                </div>
              </DialogTrigger>
            </Dialog>

            <Dialog
              open={isWithdrawDialogOpen}
              onOpenChange={setIsWithdrawDialogOpen}
            >
              <DialogTrigger asChild>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 border border-purple-100 dark:border-purple-800/30 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="w-8 h-8 rounded-xl bg-purple-200 dark:bg-purple-700 flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4 text-purple-700 dark:text-purple-300" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-purple-900 dark:text-purple-100 text-xs">
                        {isOnchainBuild ? "Send" : "Cash out"}
                      </h4>
                    </div>
                  </div>
                </div>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Recent Activity
            </h3>
            <Button variant="ghost" size="sm" className="p-1">
              <Receipt className="w-4 h-4" />
            </Button>
          </div>

          {isLoading ? (
            <PlayfulLoading
              type="wallet"
              title="Loading Transactions"
              description="Getting your transaction history..."
              className="py-8"
            />
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-8 h-8 text-slate-400" />
              </div>
              <h4 className="text-slate-900 dark:text-white font-medium mb-1">
                No transactions yet
              </h4>
              <p className="text-slate-500 text-sm">
                Your transaction history will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((transaction: any) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                        transaction.type === "deposit" ||
                        transaction.type === "signup_bonus" ||
                        transaction.type === "daily_signin" ||
                        transaction.type === "Gift received"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                          : transaction.type === "coin_purchase" &&
                              parseFloat(transaction.amount) > 0
                            ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
                            : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {transaction.type === "signup_bonus" && (
                        <Trophy className="w-5 h-5" />
                      )}
                      {transaction.type === "daily_signin" && (
                        <Calendar className="w-5 h-5" />
                      )}
                      {transaction.type === "coin_purchase" && (
                        <ShoppingCart className="w-5 h-5" />
                      )}
                      {transaction.type === "challenge_escrow" && (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                      {transaction.type === "Gifted" && (
                        <Gift className="w-5 h-5" />
                      )}
                      {transaction.type === "Gift received" && (
                        <Gift className="w-5 h-5" />
                      )}
                      {![
                        "signup_bonus",
                        "daily_signin",
                        "coin_purchase",
                        "challenge_escrow",
                        "Gifted",
                        "Gift received",
                      ].includes(transaction.type) && (
                        <Wallet className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white text-sm">
                        {transaction.type === "signup_bonus" && "Welcome Bonus"}
                        {transaction.type === "daily_signin" && "Daily Sign-in"}
                        {transaction.type === "coin_purchase" &&
                          "Coin Purchase"}
                        {transaction.type === "challenge_escrow" &&
                          "Challenge Entry"}
                        {transaction.type === "Gifted" && "Gifted"}
                        {transaction.type === "Gift received" && "Gift received"}
                        {![
                          "signup_bonus",
                          "daily_signin",
                          "coin_purchase",
                          "challenge_escrow",
                          "Gifted",
                          "Gift received",
                        ].includes(transaction.type) &&
                          transaction.type.charAt(0).toUpperCase() +
                            transaction.type.slice(1)}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(transaction.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        parseFloat(transaction.amount) >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {parseFloat(transaction.amount) >= 0 ? "+" : ""}
                      {formatTransactionAmount(transaction)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deposit Dialog */}
        <Dialog
          open={isDepositDialogOpen}
          onOpenChange={setIsDepositDialogOpen}
        >
          <DialogContent className="rounded-2xl max-w-xs mx-auto border-0 bg-white dark:bg-slate-800">
            {isOnchainBuild ? (
              <>
                <DialogHeader className="pb-2">
                  <DialogTitle className="text-center text-lg font-bold">
                    Receive
                  </DialogTitle>
                  <DialogDescription className="text-center text-xs text-slate-500 dark:text-slate-400">
                    Send assets to your address on {selectedChain?.name || "the selected chain"}.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Wallet address</p>
                    <p className="text-xs font-semibold break-all text-slate-900 dark:text-slate-100">
                      {connectedWalletAddress || "No wallet connected"}
                    </p>
                  </div>
                  <Button
                    onClick={copyWalletAddress}
                    disabled={!connectedWalletAddress}
                    className="w-full h-10 rounded-xl text-black font-semibold border-0"
                    style={{ backgroundColor: "#ccff00" }}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Address
                  </Button>
                </div>
              </>
            ) : (
            <>
            <DialogHeader className="pb-2">
              <DialogTitle className="text-center text-lg font-bold">
                Add Money
              </DialogTitle>
              <DialogDescription className="sr-only">
                Deposit funds to your wallet using Paystack
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="text-center text-base border-0 bg-slate-50 dark:bg-slate-700 rounded-xl h-12"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[500, 1000, 2500, 5000].map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    onClick={() => setDepositAmount(amount.toString())}
                    className="h-9 text-sm border-0 bg-slate-50 dark:bg-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600"
                  >
                    {amount.toLocaleString()}
                  </Button>
                ))}
              </div>
              <Button
                onClick={handleDeposit}
                disabled={!depositAmount || depositMutation.isPending}
                className="w-full h-11 rounded-xl text-black font-semibold"
                style={{ backgroundColor: '#ccff00' }}
                data-testid="button-deposit-continue"
              >
                {depositMutation.isPending ? "Processing..." : "Continue"}
              </Button>
            </div>
            </>
            )}
          </DialogContent>
        </Dialog>

        {/* Swap Dialog */}
        <Dialog open={isSwapDialogOpen} onOpenChange={setIsSwapDialogOpen}>
          <DialogContent className="rounded-2xl max-w-xs mx-auto border-0 bg-white dark:bg-slate-800">
            {isOnchainBuild ? (
              <>
                <DialogHeader className="pb-2">
                  <DialogTitle className="text-center text-lg font-bold">
                    Swap Tokens
                  </DialogTitle>
                  <DialogDescription className="text-center text-xs text-slate-500 dark:text-slate-400">
                    Swap on a DEX for {selectedChain?.name || "the selected network"}.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Network</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {selectedChain?.name || "Not selected"}
                    </p>
                  </div>
                  <Button
                    onClick={() => window.open(selectedSwapUrl, "_blank", "noopener,noreferrer")}
                    className="w-full h-10 rounded-xl text-black font-semibold border-0"
                    style={{ backgroundColor: "#ccff00" }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Swap App
                  </Button>
                </div>
              </>
            ) : (
            <>
            <DialogHeader className="pb-2">
              <DialogTitle className="text-center text-lg font-bold">
                Currency Swap
              </DialogTitle>
              <DialogDescription className="sr-only">
                Exchange between money and Bantah Bucks
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Swap Direction Toggle */}
              <div className="flex bg-slate-50 dark:bg-slate-700 rounded-xl p-1">
                <button
                  onClick={() => setSwapDirection("money-to-coins")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    swapDirection === "money-to-coins"
                      ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <DollarSign className="w-3 h-3" />
                  <ArrowLeftRight className="w-3 h-3" />
                  <Coins className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setSwapDirection("coins-to-money")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    swapDirection === "coins-to-money"
                      ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <Coins className="w-3 h-3" />
                  <ArrowLeftRight className="w-3 h-3" />
                  <DollarSign className="w-3 h-3" />
                </button>
              </div>

              {/* Current Balances */}
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 bg-slate-50 dark:bg-slate-700 rounded-xl">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <DollarSign className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Money
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatBalance(currentBalance)}
                  </p>
                </div>
                <div className="text-center p-2 bg-slate-50 dark:bg-slate-700 rounded-xl">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Coins className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Coins
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {currentCoins.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Amount Input */}
              <div className="relative">
                <Input
                  type="number"
                  placeholder={`Enter ${swapDirection === "money-to-coins" ? "money" : "coins"} amount`}
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  className="text-center text-base border-0 bg-slate-50 dark:bg-slate-700 rounded-xl h-12 pl-8"
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                  {swapDirection === "money-to-coins" ? (
                    <DollarSign className="w-4 h-4" />
                  ) : (
                    <Coins className="w-4 h-4" />
                  )}
                </span>
              </div>

              {/* Conversion Preview */}
              {swapAmount && parseFloat(swapAmount) > 0 && (
                <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800/30">
                  <p className="text-xs text-green-600 dark:text-green-400">
                    You will receive:
                  </p>
                  <p className="text-sm font-bold text-green-900 dark:text-green-100">
                    {swapDirection === "money-to-coins"
                      ? `${(parseFloat(swapAmount) * 10).toLocaleString()} coins`
                      : formatBalance(parseFloat(swapAmount) * 0.1)}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Rate: 1 unit = 10 coins
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsSwapDialogOpen(false)}
                  className="flex-1 text-sm border-0 bg-slate-50 dark:bg-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSwap}
                  disabled={!swapAmount || swapMutation.isPending}
                  className="flex-1 text-sm rounded-xl text-black font-semibold"
                  style={{ backgroundColor: '#ccff00' }}
                >
                  {swapMutation.isPending ? "Swapping..." : "Swap"}
                </Button>
              </div>
            </div>
            </>
            )}
          </DialogContent>
        </Dialog>

        {/* Withdraw Dialog */}
        <Dialog
          open={isWithdrawDialogOpen}
          onOpenChange={setIsWithdrawDialogOpen}
        >
          <DialogContent className="rounded-2xl max-w-xs mx-auto border-0 bg-white dark:bg-slate-800">
            {isOnchainBuild ? (
              <>
                <DialogHeader className="pb-2">
                  <DialogTitle className="text-center text-lg font-bold">
                    Send Assets
                  </DialogTitle>
                  <DialogDescription className="text-center text-xs text-slate-500 dark:text-slate-400">
                    Your funds are self-custodied. Send directly from your connected wallet.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Connected wallet</p>
                    <p className="text-xs font-semibold break-all text-slate-900 dark:text-slate-100">
                      {connectedWalletAddress || "No wallet connected"}
                    </p>
                  </div>
                  <Button
                    onClick={copyWalletAddress}
                    disabled={!connectedWalletAddress}
                    className="w-full h-10 rounded-xl text-black font-semibold border-0"
                    style={{ backgroundColor: "#ccff00" }}
                  >
                    <SendHorizontal className="w-4 h-4 mr-2" />
                    Copy Address
                  </Button>
                </div>
              </>
            ) : (
            <>
            <DialogHeader className="pb-2">
              <DialogTitle className="text-center text-lg font-bold">
                Cash Out
              </DialogTitle>
              <DialogDescription className="sr-only">
                Withdraw funds from your wallet
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-xl">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Available Balance
                </p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatBalance(currentBalance)}
                </p>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="text-center text-base border-0 bg-slate-50 dark:bg-slate-700 rounded-xl h-12"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsWithdrawDialogOpen(false)}
                  className="flex-1 text-sm border-0 bg-slate-50 dark:bg-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleWithdraw}
                  disabled={!withdrawAmount || withdrawMutation.isPending}
                  className="flex-1 text-sm rounded-xl text-black font-semibold"
                  style={{ backgroundColor: '#ccff00' }}
                >
                  {withdrawMutation.isPending ? "Processing..." : "Cash Out"}
                </Button>
              </div>
            </div>
            </>
            )}
          </DialogContent>
        </Dialog>

        {!isOnchainBuild && (
          <Dialog
            open={isPaymentModalOpen}
            onOpenChange={(open) => {
              if (!open && paymentReference) {
                toast({
                  title: "Verifying Payment",
                  description: "Please wait while we verify your payment...",
                });

                (async () => {
                  const parseApiErrorMessage = (err: unknown) => {
                    if (err instanceof Error) {
                      const m = err.message;
                      const idx = m.indexOf(":");
                      if (idx !== -1) {
                        const jsonPart = m.slice(idx + 1).trim();
                        try {
                          const parsed = JSON.parse(jsonPart);
                          return parsed.message || m;
                        } catch {
                          return m;
                        }
                      }
                      return m;
                    }
                    return String(err);
                  };

                  try {
                    const response = await apiRequest(
                      "POST",
                      "/api/wallet/verify-payment",
                      {
                        reference: paymentReference,
                      },
                    );

                    toast({
                      title: "Payment Verified",
                      description:
                        response?.message ||
                        "Your deposit has been credited to your account!",
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
                    setDepositAmount("");
                    setIsDepositDialogOpen(false);
                  } catch (error) {
                    const msg = parseApiErrorMessage(error);
                    const lower = msg.toLowerCase();
                    if (lower.includes("success") || lower.includes("verified")) {
                      toast({
                        title: "Payment Verified",
                        description:
                          "Your deposit has been credited to your account!",
                      });
                      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
                      setDepositAmount("");
                      setIsDepositDialogOpen(false);
                    } else {
                      toast({
                        title: "Payment Pending",
                        description: "We'll verify your payment shortly.",
                      });
                      console.error("Verification error:", error);
                    }
                  }
                })();
              }
              setIsPaymentModalOpen(open);
              if (!open) {
                setPaymentUrl(null);
                setPaymentReference(null);
              }
            }}
          >
            <DialogContent className="max-w-md w-[95vw] sm:w-full h-[600px] sm:h-[650px] p-0 bg-transparent border-0 overflow-hidden">
              <DialogTitle className="sr-only">Payment Checkout</DialogTitle>
              <DialogDescription className="sr-only">
                Complete your payment securely with Paystack
              </DialogDescription>
              {paymentUrl && (
                <iframe
                  src={paymentUrl}
                  className="w-full h-full border-0 rounded-2xl"
                  title="Payment"
                  allow="payment"
                />
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Mobile Footer Navigation */}
      <MobileNavigation />
    </div>
  );
}

