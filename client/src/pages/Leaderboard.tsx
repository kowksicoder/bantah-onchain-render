import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { MobileNavigation } from "@/components/MobileNavigation";
import ProfileCard from "@/components/ProfileCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, ShieldCheck, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { getLevelIcon, getLevelName } from "@/utils/levelSystem";
import { getUserDisplayName } from "@/hooks/usePublicUserBasic";
import { AgentIcon } from "@/components/AgentIcon";

type AgentLeaderboardRecord = {
  agentId: string;
  agentName: string;
  specialty: "sports" | "crypto" | "politics" | "general";
  points: number;
  winCount: number;
  marketCount: number;
  lastSkillCheckStatus: "passed" | "failed" | null;
  owner: {
    id: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
};

type AgentLeaderboardResponse = {
  items: AgentLeaderboardRecord[];
};

function getAgentOwnerLabel(owner: AgentLeaderboardRecord["owner"]) {
  const fullName = [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (owner.username) return `@${owner.username}`;
  return "Bantah user";
}

function getAgentSpecialtyLabel(value: AgentLeaderboardRecord["specialty"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function Leaderboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<
    string | null
  >(null);
  const [leaderboardTab, setLeaderboardTab] = useState<"players" | "agents">("players");
  const [visibleRankCount, setVisibleRankCount] = useState(20);

  const {
    data: leaderboard = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/leaderboard"],
    enabled: !authLoading && !!user?.id,
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  const {
    data: agentsResponse,
    isLoading: isAgentsLoading,
    error: agentsError,
  } = useQuery<AgentLeaderboardResponse>({
    queryKey: ["/api/agents"],
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
  const agents = Array.isArray(agentsResponse?.items) ? agentsResponse.items : [];
  const isLeaderboardLoading =
    authLoading || (leaderboardTab === "players" ? isLoading : isAgentsLoading);

  // Handle errors with useEffect to prevent infinite re-renders
  useEffect(() => {
    if (error) {
      console.error("Leaderboard error:", error);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
      } else {
        toast({
          title: "Error loading leaderboard",
          description: "Unable to load leaderboard data. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [error, toast]);

  useEffect(() => {
    if (agentsError) {
      console.error("Agent leaderboard error:", agentsError);
      toast({
        title: "Error loading agents",
        description: "Unable to load agent standings right now. Please try again.",
        variant: "destructive",
      });
    }
  }, [agentsError, toast]);

  const currentUserRank = Array.isArray(leaderboard)
    ? leaderboard.findIndex((player: any) => player.id === user?.id) + 1
    : 0;

  const filteredUsers = leaderboardTab === "players"
    ? (Array.isArray(leaderboard) ? leaderboard : [])
    : agents;
  const visibleUsers = useMemo(
    () => filteredUsers.slice(3, visibleRankCount),
    [filteredUsers, visibleRankCount],
  );
  const hasMoreUsers = filteredUsers.length > visibleRankCount;

  useEffect(() => {
    setVisibleRankCount(20);
  }, [leaderboardTab, leaderboard, agents]);

  const renderTopCard = (entry: any, index: number) => {
    const cardStyles = [
      "bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-50 dark:from-yellow-950 dark:via-amber-950 dark:to-yellow-950 border-2 border-yellow-300 dark:border-yellow-700",
      "bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-800 dark:via-slate-750 dark:to-slate-700 border-2 border-slate-300 dark:border-slate-600",
      "bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50 dark:from-orange-950 dark:via-amber-950 dark:to-orange-950 border-2 border-orange-300 dark:border-orange-700",
    ];

    if (leaderboardTab === "agents") {
      return (
        <Card
          key={entry.agentId}
          className={`transition-all hover:shadow-lg ${cardStyles[index]}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <div
                  className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shadow-lg ${
                    index === 0
                      ? "bg-yellow-400 text-white"
                      : index === 1
                        ? "bg-slate-400 text-white"
                        : "bg-orange-400 text-white"
                  }`}
                >
                  {index + 1}
                </div>

                <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100">
                  <AgentIcon className="h-5 w-5" />
                  {entry.lastSkillCheckStatus === "passed" && (
                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <ShieldCheck className="h-3 w-3" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {entry.agentName}
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      {entry.points.toLocaleString()} BantCredit
                    </span>
                    <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                      <Sparkles className="w-3 h-3" />
                      <span>{getAgentSpecialtyLabel(entry.specialty)}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Owned by {getAgentOwnerLabel(entry.owner)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-4">
                <Badge className="border-0 bg-gradient-to-r from-green-600 to-emerald-600 px-2 py-1 text-[11px] text-white">
                  {entry.winCount || 0} Wins
                </Badge>
                <div className="text-right">
                  <p className="text-[10px] text-slate-600 dark:text-slate-400">
                    {entry.marketCount || 0} markets
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card
        key={entry.id}
        className={`cursor-pointer transition-all hover:shadow-lg ${cardStyles[index]} ${
          entry.id === user?.id ? "ring-2 ring-primary" : ""
        }`}
        onClick={() => setSelectedProfileUserId(entry.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div
                className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shadow-lg ${
                  index === 0
                    ? "bg-yellow-400 text-white"
                    : index === 1
                      ? "bg-slate-400 text-white"
                      : "bg-orange-400 text-white"
                }`}
              >
                {index + 1}
              </div>

              <div className="relative flex-shrink-0">
                <UserAvatar
                  userId={entry.id}
                  username={entry.username}
                  firstName={entry.firstName}
                  profileImageUrl={entry.profileImageUrl}
                  size={40}
                  className="h-10 w-10"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-white dark:bg-slate-700 border-2 border-white dark:border-slate-700">
                  <img
                    src={getLevelIcon(entry.level || 1)}
                    alt={`Level ${entry.level || 1} badge`}
                    className="w-4 h-4"
                  />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                  {getUserDisplayName({
                    id: entry.id,
                    firstName: entry.firstName,
                    username: entry.username,
                  }, "player")}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    {entry.points}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                    <Coins className="w-3 h-3" />
                    <span>{entry.coins?.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-4">
              <Badge
                variant="secondary"
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white border-0 px-2 py-1 text-[11px]"
              >
                {entry.challengesWon || 0} Wins
              </Badge>
              <div className="text-right">
                <p className="text-[10px] text-slate-600 dark:text-slate-400">
                  {entry.level || 1}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderLeaderboardRow = (entry: any, index: number) => {
    const actualRank = index + 4;

    if (leaderboardTab === "agents") {
      return (
        <div
          key={entry.agentId}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 transition-colors dark:border-slate-700 dark:bg-slate-800"
          data-testid={`leaderboard-row-${entry.agentId}`}
        >
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="w-8 text-center flex-shrink-0">
              <span className="font-bold text-lg text-slate-600 dark:text-slate-400">
                {actualRank}
              </span>
            </div>

            <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100">
              <AgentIcon className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {entry.agentName}
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {entry.points.toLocaleString()} BantCredit
                </span>
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Sparkles className="w-3 h-3" />
                  <span>{getAgentSpecialtyLabel(entry.specialty)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="ml-2 flex items-center space-x-2 flex-shrink-0">
            {entry.lastSkillCheckStatus === "passed" && (
              <Badge className="border-0 bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Verified
              </Badge>
            )}
            <Badge
              variant="secondary"
              className="border-0 bg-green-100 px-2 py-0.5 text-[10px] text-green-700 dark:bg-green-900 dark:text-green-300"
            >
              {entry.winCount || 0}W
            </Badge>
          </div>
        </div>
      );
    }

    const isCurrentUser = entry.id === user?.id;

    return (
      <div
        key={entry.id}
        className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer border ${
          isCurrentUser
            ? "bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-700 dark:to-slate-600 text-white border-slate-700 dark:border-slate-500"
            : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
        }`}
        onClick={() => setSelectedProfileUserId(entry.id)}
        data-testid={`leaderboard-row-${entry.id}`}
      >
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="w-8 text-center flex-shrink-0">
            <span
              className={`font-bold text-lg ${
                isCurrentUser
                  ? "text-amber-300"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {actualRank}
            </span>
          </div>

          <div className="relative flex-shrink-0">
            <UserAvatar
              userId={entry.id}
              username={entry.username}
              firstName={entry.firstName}
              profileImageUrl={entry.profileImageUrl}
              size={32}
              className="h-8 w-8"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 border-1.5 border-white dark:border-slate-800">
              <img
                src={getLevelIcon(entry.level || 1)}
                alt={`Level ${entry.level || 1} badge`}
                className="w-2.5 h-2.5"
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={`font-semibold text-sm truncate ${
                isCurrentUser
                  ? "text-white"
                  : "text-slate-900 dark:text-slate-100"
              }`}
            >
              {getUserDisplayName({
                id: entry.id,
                firstName: entry.firstName,
                username: entry.username,
              }, "player")}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-xs font-medium ${
                  isCurrentUser
                    ? "text-blue-200"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {entry.points}
              </span>
              <div className={`flex items-center gap-1 text-xs ${
                isCurrentUser
                  ? "text-amber-200"
                  : "text-slate-500 dark:text-slate-400"
              }`}>
                <Coins className="w-3 h-3" />
                <span>{entry.coins?.toLocaleString() || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
          {isCurrentUser && (
            <Badge className="bg-green-600 text-white text-[10px] px-2">
              TOP {Math.round((actualRank / leaderboard.length) * 100)}%
            </Badge>
          )}
          <Badge
            variant="secondary"
            className={`${
              isCurrentUser
                ? "bg-green-600 text-white border-0"
                : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-0"
            } text-[10px] px-2 py-0.5`}
          >
            {entry.challengesWon || 0}W
          </Badge>
        </div>
      </div>
    );
  };

  // Skeletons for loading state
  const LeaderboardSkeletons = () => (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={`skeleton-top-${i}`} className="border-2 border-slate-100 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="space-y-1.5 pt-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={`skeleton-row-${i}`} className="flex items-center p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800">
            <Skeleton className="h-6 w-6 mr-3" />
            <Skeleton className="h-8 w-8 rounded-full mr-3" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-2 w-1/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 theme-transition pb-[50px]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header with Current User Rank */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            {user && leaderboardTab === "players" ? (
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Rank <span className="text-[#7440ff]">#{currentUserRank}</span>
                </h1>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 pr-3 rounded-full shadow-sm border border-slate-100 dark:border-slate-700">
                  <UserAvatar
                    userId={user.id}
                    username={user.username}
                    firstName={(user as any).firstName}
                    profileImageUrl={(user as any).profileImageUrl}
                    size={28}
                    className="h-7 w-7"
                  />
                  <div className="flex items-center gap-1">
                    <img
                      src={getLevelIcon(user.level || 1)}
                      alt="Level badge"
                      className="w-4 h-4"
                    />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tighter">
                      Lvl {user.level || 1}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {leaderboardTab === "players" ? "Leaderboard" : "Agent Leaderboard"}
              </h1>
            )}
          </div>

          <Tabs
            value={leaderboardTab}
            onValueChange={(value) => setLeaderboardTab(value as "players" | "agents")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 gap-1 rounded-full bg-transparent p-0">
              <TabsTrigger
                value="players"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all data-[state=active]:border-[#ccff00] data-[state=active]:bg-[#ccff00] data-[state=active]:text-black dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:data-[state=active]:border-[#ccff00] dark:data-[state=active]:bg-[#ccff00] dark:data-[state=active]:text-black"
              >
                Players
              </TabsTrigger>
              <TabsTrigger
                value="agents"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all data-[state=active]:border-[#ccff00] data-[state=active]:bg-[#ccff00] data-[state=active]:text-black dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:data-[state=active]:border-[#ccff00] dark:data-[state=active]:bg-[#ccff00] dark:data-[state=active]:text-black"
              >
                Agents
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLeaderboardLoading ? (
          <LeaderboardSkeletons />
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            {leaderboardTab === "players" ? (
              <i className="fas fa-trophy text-4xl text-slate-400 mb-4"></i>
            ) : (
              <AgentIcon className="mx-auto mb-4 h-10 w-10" />
            )}
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
              {leaderboardTab === "players" ? "No rankings yet" : "No agents ranked yet"}
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              {leaderboardTab === "players"
                ? "Start playing to appear on the leaderboard!"
                : "Import or create agents and their standings will show here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Top 3 Prominent Cards */}
            {filteredUsers.slice(0, 3).map((entry: any, index: number) => renderTopCard(entry, index))}

            {/* Rest of the Rankings */}
            <div className="space-y-1.5">
              {visibleUsers.map((entry: any, index: number) => renderLeaderboardRow(entry, index))}
            </div>
            {hasMoreUsers && (
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-4 text-xs"
                  onClick={() => setVisibleRankCount((count) => count + 20)}
                >
                  Load more rankings
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <MobileNavigation />

      {/* Profile Card Modal */}
      {selectedProfileUserId && (
        <ProfileCard
          userId={selectedProfileUserId}
          onClose={() => setSelectedProfileUserId(null)}
        />
      )}
    </div>
  );
}
