import { useAuth } from "@/hooks/useAuth";
import React, { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { useWallets } from "@privy-io/react-auth";
import { useLocation } from "wouter";
import { useNotifications } from "@/hooks/useNotifications";
import { useBadges } from "@/hooks/useBadges";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatBalance } from "@/utils/currencyUtils";
import { getAvatarUrl } from "@/utils/avatarUtils";
import { UserAvatar } from "@/components/UserAvatar";
import { useEventsSearch } from "../context/EventsSearchContext"; // Corrected import
import { SmartSearch } from "./SmartSearch";
import { type OnchainRuntimeConfig } from "@/lib/onchainEscrow";
import {
  Bell,
  Settings,
  Users,
  Calendar,
  Trophy,
  Wallet,
  Home,
  Menu,
  X,
  Sun,
  Moon,
  ShoppingCart,
  ArrowLeft,
  User,
  Clock,
  LogOut,
  Award,
  Search,
  Info,
  Network,
} from "lucide-react";
import { Link } from "wouter"; // Import Link from wouter
import { FloatingBantzzButton } from "./FloatingBantzzButton";

export function Navigation() {
  const { user, isLoading, login } = useAuth();
  const { wallets } = useWallets();
  const appModeRaw = String((import.meta as any).env?.VITE_APP_MODE || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();
  const isOnchainBuild = appModeRaw !== "offchain";
  const [showOnchainModal, setShowOnchainModal] = useState(false);

  const { notifications, unreadCount } = useNotifications();
  const { hasProfileBadge } = useBadges();

  const { data: onchainConfig } = useQuery<OnchainRuntimeConfig>({
    queryKey: ["/api/onchain/config"],
    queryFn: async () => await fetch("/api/onchain/config").then((res) => res.json()),
    retry: false,
    staleTime: 1000 * 60 * 5,
    enabled: isOnchainBuild,
  });

  const { data: balance = 0 } = useQuery({
    queryKey: ["/api/wallet/balance"],
    retry: false,
    enabled: !!user,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  const [location, navigate] = useLocation();
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);

  const chainOptions = useMemo(() => {
    const chains = Object.values(onchainConfig?.chains || {});
    return chains.sort((a, b) => Number(a.chainId) - Number(b.chainId));
  }, [onchainConfig]);

  const getStoredChain = () => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem("bantah_onchain_chain_id");
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const isChainLocked = () => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("bantah_onchain_chain_locked") === "true";
  };

  const setChainPreference = (chainId: number, lock: boolean) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("bantah_onchain_chain_id", String(chainId));
    window.localStorage.setItem("bantah_onchain_chain_locked", lock ? "true" : "false");
    setSelectedChainId(chainId);
    window.dispatchEvent(
      new CustomEvent("onchain-chain-changed", { detail: { chainId } }),
    );
  };

  useEffect(() => {
    if (!isOnchainBuild || chainOptions.length === 0) return;
    const stored = getStoredChain();
    if (stored && chainOptions.some((chain) => Number(chain.chainId) === stored)) {
      setSelectedChainId(stored);
      return;
    }
    const fallback = Number(onchainConfig?.defaultChainId || chainOptions[0]?.chainId || 0);
    if (fallback) {
      setChainPreference(fallback, false);
    }
  }, [isOnchainBuild, chainOptions, onchainConfig]);

  useEffect(() => {
    if (!isOnchainBuild || chainOptions.length === 0) return;
    if (isChainLocked()) return;
    const walletChainId = wallets
      ?.map((wallet) => {
        const raw =
          (wallet as any)?.chainId ??
          (wallet as any)?.chain_id ??
          (wallet as any)?.chain?.id ??
          (wallet as any)?.network?.chainId ??
          (wallet as any)?.network?.chain_id;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
      })
      .find((entry) => entry && chainOptions.some((chain) => Number(chain.chainId) === entry));

    if (walletChainId && walletChainId !== selectedChainId) {
      setChainPreference(walletChainId, false);
    }
  }, [wallets, chainOptions, selectedChainId, isOnchainBuild]);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const goToChallenges = () => {
    navigate("/challenges");
  };

  // Show full navigation for both authenticated and unauthenticated users
  // if (!user) {
  //   return (
  //     <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 theme-transition sticky top-0 z-50">
  //       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  //         <div className="flex justify-between items-center h-16">
  //           {/* Logo */}
  //           <div className="flex items-center space-x-3">
  //             <button
  //               className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
  //               onClick={() => (window.location.href = "/")}
  //             >
  //               <img
  //                 src="/assets/bantahblue.svg"
  //                 alt="BetChat Logo"
  //                 className="w-8 h-8"
  //               />
  //               <span className="text-xl font-bold text-slate-900 dark:text-white"></span>
  //             </button>
  //           </div>
  //           {/* Sign In Button */}
  //           <div>
  //             <button
  //               onClick={() => setShowSignIn(true)}
  //               className="bg-primary text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-primary/90 transition-colors"
  //             >
  //               Sign In
  //             </button>
  //           </div>
  //         </div>
  //       </div>
  //       {/* Sign In Modal */}
  //       <Dialog open={showSignIn} onOpenChange={setShowSignIn}>
  //         <DialogContent className="sm:max-w-sm rounded-3xl border-0 shadow-2xl overflow-hidden">
  //           <DialogHeader className="pb-2">
  //             <div className="flex flex-col items-center justify-center w-full">
  //               <img
  //                 src="/assets/bantahblue.svg"
  //                 alt="Bantah Logo"
  //                 className="w-16 h-16 mb-2 drop-shadow-lg"
  //                 style={{ objectFit: "contain" }}
  //               />
  //               <DialogTitle className="text-center text-lg font-bold text-gray-800 dark:text-gray-200">
  //                 Sign in to Bantah
  //               </DialogTitle>
  //             </div>
  //           </DialogHeader>
  //           <div className="flex flex-col items-center space-y-4 py-2">
  //             <button
  //               onClick={() => {
  //                 window.location.href = "/api/login";
  //               }}
  //               className="w-full bg-primary text-white py-2 rounded-lg font-semibold shadow hover:bg-primary/90 transition-colors"
  //             >
  //               Continue with Telegram
  //             </button>
  //             <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
  //               By signing in, you agree to our Terms and Privacy Policy.
  //             </p>
  //           </div>
  //         </DialogContent>
  //       </Dialog>
  //     </nav>
  //   );
  // }

  // Extract challenge ID from URL if viewing a specific challenge
  const challengeIdMatch = useMemo(() => {
    const match = location.match(/^\/challenges\/([^/]+)$/);
    return match ? match[1] : null;
  }, [location]);

  // Fetch challenge data if viewing a specific challenge
  const { data: currentChallenge } = useQuery<any>({
    queryKey: [`/api/challenges/${challengeIdMatch}`],
    enabled: !!challengeIdMatch,
    retry: false,
  });

  // Check if current page should show logo (challenges and home pages)
  const shouldShowLogo =
    location === "/" || location === "/challenges" || location === "/home";

  // Get page title for non-logo pages
  const getPageTitle = () => {
    // If viewing a specific challenge, show challenge title and participant count
    if (challengeIdMatch && currentChallenge) {
      const participantCount = [currentChallenge?.challenger, currentChallenge?.challenged].filter(Boolean).length;
      return `${currentChallenge?.title} (${participantCount} participants)`;
    }

    if (location.startsWith("/events/create")) return "Create Event";
    if (location.startsWith("/events/")) return "Event Chat";
    if (location.startsWith("/challenges")) return "Challenges";
    if (location.startsWith("/wallet")) return "Wallet";
    if (location.startsWith("/profile/edit")) return "Edit Profile";
    if (location.startsWith("/profile/settings")) return "Profile Settings";
    if (location.startsWith("/profile")) return "Profile";
    if (location.startsWith("/friends")) return "Friends";
    if (location.startsWith("/partners")) return "Partners";
    if (location.startsWith("/partner-signup")) return "Partner Signup";
    if (location.startsWith("/leaderboard")) return "Leaderboard";
    if (location.startsWith("/notifications")) return "Notifications";
    if (location.startsWith("/settings")) return "Settings";
    if (location.startsWith("/shop")) return "Coin Shop";
    if (location.startsWith("/history")) return "History";
    if (location.startsWith("/admin")) return "Admin";
    if (location.startsWith("/referrals")) return "Referrals";
    if (location.startsWith("/points")) return "BantCredit & Badges";
    if (location.startsWith("/support-chat")) return "Support Chat";
    if (location.startsWith("/help-support")) return "Help & Support";
    if (location.startsWith("/terms-of-service")) return "Terms of Service";
    if (location.startsWith("/privacy-policy")) return "Privacy Policy";
    if (location.startsWith("/data-deletion-request")) return "Data Deletion";
    return "Bantah";
  };

  const handleBack = () => {
    // Navigate back to challenges page (main page for mobile)
    navigate("/challenges");
  };

  const { searchTerm, setSearchTerm } = useEventsSearch();
  const activeChain =
    chainOptions.find((chain) => Number(chain.chainId) === Number(selectedChainId)) ||
    chainOptions.find((chain) => Number(chain.chainId) === Number(onchainConfig?.defaultChainId)) ||
    chainOptions[0];

  const chainIconByKey: Record<string, { src: string; alt: string }> = {
    base: { src: "/assets/chain-base.svg", alt: "Base" },
    arbitrum: { src: "/assets/chain-arbitrum.svg", alt: "Arbitrum" },
    bsc: { src: "/assets/chain-bsc.svg", alt: "BNB Chain" },
    unichain: { src: "/assets/chain-unichain.svg", alt: "Unichain" },
  };

  const resolveChainIcon = (chain: { key?: string; name?: string } | null | undefined) => {
    if (!chain) return null;
    const key = String(chain.key || "").toLowerCase();
    if (key && chainIconByKey[key]) return chainIconByKey[key];
    const name = String(chain.name || "").toLowerCase();
    if (name.includes("base")) return chainIconByKey.base;
    if (name.includes("arbitrum")) return chainIconByKey.arbitrum;
    if (name.includes("bsc") || name.includes("bnb")) return chainIconByKey.bsc;
    if (name.includes("uni")) return chainIconByKey.unichain;
    return null;
  };

  return (
    <>
      <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 theme-transition sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12 md:h-16">
            {/* Mobile Header Logic - Logo on Events/Home, Back Button + Title on other pages */}
            <div className="flex items-center justify-between md:hidden w-full">
              {user ? (
                /* Authenticated users - existing logic */
                <div className="flex items-center space-x-3">
                  {shouldShowLogo ? (
                    /* Events/Home page - Show logo only */
                    <button
                      onClick={() => handleNavigation("/")}
                      className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                    >
                      <img
                        src="/assets/bantahblue.svg"
                        alt="Bantah Logo"
                        className="w-8 h-8"
                      />
                      <span className="text-2xl font-black text-slate-900 dark:text-white"></span>
                    </button>
                  ) : (
                    /* Other pages - Show back button + page title */
                    <>
                      <button
                        onClick={handleBack}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {getPageTitle()}
                      </h1>
                    </>
                  )}
                </div>
              ) : (
                /* Unauthenticated users - Show logo and signin button */
                <div className="flex items-center justify-between w-full">
                  <button
                    onClick={() => handleNavigation("/")}
                    className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                  >
                    <img
                      src="/assets/bantahblue.svg"
                      alt="Bantah Logo"
                      className="w-8 h-8"
                    />
                    <span className="text-2xl font-black text-slate-900 dark:text-white"></span>
                  </button>
                  <button
                    onClick={() => !isLoading && login()}
                    className="px-4 py-2 text-white rounded-lg font-semibold hover:bg-[#7440ff]/90 transition-colors text-sm"
                    style={{ backgroundColor: "#7440ff" }}
                  >
                    Sign In
                  </button>
                </div>
              )}

              {/* Mobile Right Side Icons - Only for authenticated users */}
              {user && (
                <div className="flex items-center space-x-2">
                      {/* Smart Search - Only show on Events/Home page */}
                      {shouldShowLogo && (
                        <SmartSearch placeholder="Search events, challenges, users..." />
                      )}

                      {/* Search handled by SmartSearch on home/challenges */}

                  {isOnchainBuild && chainOptions.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          aria-label="Select chain"
                        >
                          {(() => {
                            const icon = resolveChainIcon(activeChain);
                            return icon ? (
                              <img
                                src={icon.src}
                                alt={icon.alt}
                                className="h-4 w-4 rounded-full"
                              />
                            ) : (
                              <Network className="h-3.5 w-3.5" />
                            );
                          })()}
                          <span>{activeChain?.name || "Chain"}</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {chainOptions.map((chain) => (
                          <DropdownMenuItem
                            key={chain.chainId}
                            onClick={() => setChainPreference(Number(chain.chainId), true)}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="flex items-center gap-2">
                              {(() => {
                                const icon = resolveChainIcon(chain);
                                return icon ? (
                                  <img
                                    src={icon.src}
                                    alt={icon.alt}
                                    className="h-4 w-4 rounded-full"
                                  />
                                ) : null;
                              })()}
                              {chain.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {chain.nativeSymbol}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* Leaderboard Icon - Always visible on mobile */}
                  <button
                    onClick={() => handleNavigation("/leaderboard")}
                    className="p-2 text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
                  >
                    <img 
                      src="/assets/leaderboard_activity.png" 
                      alt="Leaderboard" 
                      className="w-5 h-5"
                    />
                  </button>

                  {/* Notifications - Always visible on mobile */}
                  <button
                    onClick={() => handleNavigation("/notifications")}
                    className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors"
                    data-tour="notifications"
                  >
                    <img
                      src="/assets/notify22.svg"
                      alt="Notifications"
                      className="w-6 h-6"
                    />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Badge>
                    )}
                  </button>

                  {/* Wallet Coins - Mobile */}
                  <button
                    onClick={() => handleNavigation("/wallet")}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors text-xs"
                    style={{ backgroundColor: "#ccff00", color: "black" }}
                    data-tour="wallet"
                  >
                    <i className="fas fa-coins text-yellow-500 text-xs"></i>
                    <span className="font-medium">
                      {typeof balance === "object" && balance !== null
                        ? ((balance as any).coins || 0).toLocaleString()
                        : "0"}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Desktop Logo */}
            <div className="hidden md:flex items-center space-x-3">
              <button
                onClick={() => handleNavigation("/")}
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
              >
                <img
                  src="/assets/bantahblue.svg"
                  alt="Bantah Logo"
                  className="w-8 h-8"
                />
                <span className="text-2xl font-black text-slate-900 dark:text-white"></span>
              </button>
            </div>
            {/* Navigation Items */}
            <div className="hidden md:flex items-center space-x-6">
              {/* Primary Navigation Group */}
              <div className="flex items-center bg-gray-50 dark:bg-slate-700/50 rounded-xl p-1 border border-gray-200 dark:border-slate-600">
                <button
                  onClick={() => handleNavigation("/challenges")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    location === "/challenges" ||
                    location.startsWith("/challenges")
                      ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-lg"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
                  }`}
                  data-tour="challenges"
                >
                  <Trophy className="w-4 h-4" />
                  Challenges
                </button>
                <button
                  onClick={() => handleNavigation("/friends")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    location === "/friends" || location.startsWith("/friends")
                      ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-lg"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
                  }`}
                  data-tour="friends"
                >
                  <Users className="w-4 h-4" />
                  Friends
                </button>
                <button
                  onClick={() => handleNavigation("/leaderboard")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    location === "/leaderboard" ||
                    location.startsWith("/leaderboard")
                      ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-lg"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
                  }`}
                  data-tour="leaderboard"
                >
                  <Award className="w-4 h-4" />
                  Leaderboard
                </button>
                <button
                  onClick={() => handleNavigation("/about")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    location === "/about"
                      ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-lg"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Info className="w-4 h-4" />
                  About
                </button>
              </div>

              {/* Secondary Navigation Group */}
              <div className="flex items-center bg-gray-50 dark:bg-slate-700/50 rounded-xl p-1 border border-gray-200 dark:border-slate-600"></div>

              {/* Search Bar - Wire to events or challenges depending on page */}
              <div className="ml-2">
                <Input
                  placeholder={location.startsWith("/challenges") ? "Search challenges..." : "Search events.."}
                  value={searchTerm}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (location.startsWith("/challenges")) {
                      window.dispatchEvent(new CustomEvent("challenges-search", { detail: v }));
                    } else {
                      setSearchTerm(v);
                    }
                  }}
                  className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 w-3/4 focus:ring-2 focus:ring-slate-400 focus:ring-offset-0 focus:border-slate-400 focus-visible:ring-slate-400 placeholder:text-slate-400 placeholder:text-sm"
                />
              </div>
              {isOnchainBuild ? (
                <Badge className="ml-2 px-2.5 py-1 text-[10px] tracking-wide uppercase bg-emerald-600 text-white border-0">
                  Onchain
                </Badge>
              ) : (
                <button
                  onClick={() => setShowOnchainModal(true)}
                  className="ml-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                >
                  onchain
                </button>
              )}
            </div>

            {/* Right Side Items - Desktop Only */}
            <div className="hidden md:flex items-center space-x-4">
              {isOnchainBuild && chainOptions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      aria-label="Select chain"
                    >
                      {(() => {
                        const icon = resolveChainIcon(activeChain);
                        return icon ? (
                          <img
                            src={icon.src}
                            alt={icon.alt}
                            className="h-4 w-4 rounded-full"
                          />
                        ) : (
                          <Network className="h-4 w-4" />
                        );
                      })()}
                      <span>{activeChain?.name || "Chain"}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {chainOptions.map((chain) => (
                      <DropdownMenuItem
                        key={chain.chainId}
                        onClick={() => setChainPreference(Number(chain.chainId), true)}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="flex items-center gap-2">
                          {(() => {
                            const icon = resolveChainIcon(chain);
                            return icon ? (
                              <img
                                src={icon.src}
                                alt={icon.alt}
                                className="h-4 w-4 rounded-full"
                              />
                            ) : null;
                          })()}
                          {chain.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {chain.nativeSymbol}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Notifications - Desktop Only */}
              {user && (
                <button
                  onClick={() => handleNavigation("/notifications")}
                  className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors"
                  data-tour="notifications"
                >
                  <img
                    src="/assets/notify22.svg"
                    alt="Notifications"
                    className="w-7 h-7"
                  />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </button>
              )}

              {/* Profile Button - Desktop Only */}
              {user ? (
                <button
                  onClick={() => handleNavigation("/profile")}
                  className="relative hidden md:flex items-center justify-center w-8 h-8 rounded-full overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                >
                  <UserAvatar
                    userId={user.id}
                    username={(user as any).username || (typeof user.email === 'string' ? user.email : (user.email as any)?.address)}
                    size={32}
                    className="w-full h-full"
                  />
                  {hasProfileBadge && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white dark:border-slate-800"></div>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => !isLoading && login()}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-white text-white rounded-lg font-semibold hover:bg-[#7440ff]/90 transition-colors"
                  style={{ backgroundColor: "#7440ff" }}
                >
                  <User className="w-4 h-4" />
                  Sign In
                </button>
              )}

              {/* Wallet Coins */}
              {user && (
                <button
                  onClick={() => handleNavigation("/wallet")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: "#ccff00", color: "black" }}
                  data-tour="wallet"
                >
                  <i className="fas fa-coins text-yellow-500"></i>
                  <span className="text-sm font-medium">
                    {typeof balance === "object" && balance !== null
                      ? ((balance as any).coins || 0).toLocaleString()
                      : "0"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Floating Bantzz AI Button */}
      <FloatingBantzzButton />

      {!isOnchainBuild && (
        <Dialog open={showOnchainModal} onOpenChange={setShowOnchainModal}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Switch to Onchain</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Try the onchain version of Bantah with blockchain-native flow.
            </p>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={() => setShowOnchainModal(false)}>
                Not now
              </Button>
              <Button
                onClick={() => {
                  window.open("https://onchain.bantah.fun", "_blank", "noopener,noreferrer");
                  setShowOnchainModal(false);
                }}
              >
                Go to onchain
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
