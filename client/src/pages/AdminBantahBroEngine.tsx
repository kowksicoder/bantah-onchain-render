import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { adminApiRequest } from "@/lib/adminApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Activity, Database, RefreshCw, ShieldCheck, SlidersHorizontal, Swords, Zap } from "lucide-react";

type BattleTokenProfile = {
  id: string;
  emoji: string;
  logoUrl: string | null;
  displaySymbol: string;
  actualSymbol: string | null;
  tokenName: string | null;
  narrative: string;
  chainLabel: string | null;
  chainId: string | null;
  priceDisplay: string;
  change: string;
  volumeH24: number | null;
  liquidityUsd: number | null;
  marketCap: number | null;
  pairUrl: string | null;
};

type BattleCandidate = {
  id: string;
  title: string;
  category: string;
  score: number;
  safetyLabel: string;
  winnerRule: string;
  durationSeconds: number;
  sides: [BattleTokenProfile, BattleTokenProfile];
  scoreBreakdown: Record<string, number>;
  rationale: string[];
  rules: string[];
  adminOverride?: {
    hidden: boolean;
    pinned: boolean;
    featured: boolean;
    note: string | null;
    updatedAt: string;
  };
  officialListing?: {
    id: string;
    status: "listed";
    source: string;
    listedAt: string;
    updatedAt: string;
  };
};

type BattleEngineFeed = {
  updatedAt: string;
  scanner: {
    rawScanPool: number;
    analyzedTokens: number;
    battleCandidates: number;
    selectedLiveBattles: number;
    featuredBattles: number;
    scanLimit: number;
  };
  filters: {
    minLiquidityUsd: number;
    minVolumeH24: number;
    minAgeMinutes: number;
    note: string;
  };
  candidates: BattleCandidate[];
  selectedBattles: BattleCandidate[];
  featuredBattles: BattleCandidate[];
  rejectedTokens: Array<{
    symbol: string | null;
    chainId: string | null;
    tokenAddress: string | null;
    reason: string;
  }>;
  sources: {
    dexscreener: { active: boolean; message: string };
    virtuals: { active: false; message: string };
    bankr: { active: false; message: string };
  };
};

function formatUsd(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (numeric <= 0) return "n/a";
  if (numeric >= 1_000_000_000) return `$${(numeric / 1_000_000_000).toFixed(2)}B`;
  if (numeric >= 1_000_000) return `$${(numeric / 1_000_000).toFixed(2)}M`;
  if (numeric >= 1_000) return `$${(numeric / 1_000).toFixed(1)}K`;
  return `$${numeric.toFixed(2)}`;
}

function shortChange(value: string | null | undefined) {
  const cleaned = String(value || "0%").replace("+", "");
  const numeric = Number.parseFloat(cleaned);
  if (!Number.isFinite(numeric)) return value || "0%";
  if (Math.abs(numeric) >= 1000) return `${Math.round(numeric)}%`;
  if (Math.abs(numeric) >= 100) return `${numeric.toFixed(0)}%`;
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(1)}%`;
}

function changeClass(value: string | null | undefined) {
  return String(value || "").trim().startsWith("-") ? "text-red-300" : "text-green-300";
}

function safetyClass(label: string) {
  if (label === "safe") return "border-green-700/70 bg-green-950/50 text-green-300";
  if (label === "experimental") return "border-amber-700/70 bg-amber-950/50 text-amber-300";
  return "border-red-700/70 bg-red-950/50 text-red-300";
}

function InputBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 border-slate-800 bg-slate-950 px-2 text-xs text-white"
      />
    </label>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-black ${tone}`}>{value}</div>
    </div>
  );
}

type OverridePatch = Partial<Pick<NonNullable<BattleCandidate["adminOverride"]>, "hidden" | "pinned" | "featured">>;

function BattleName({ battle }: { battle: BattleCandidate }) {
  const [left, right] = battle.sides;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="relative h-8 w-10 shrink-0">
        {left.logoUrl && (
          <img
            src={left.logoUrl}
            alt={`${left.displaySymbol} logo`}
            className="absolute left-0 top-1 h-7 w-7 rounded-full object-cover ring-1 ring-slate-950"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        )}
        {right.logoUrl && (
          <img
            src={right.logoUrl}
            alt={`${right.displaySymbol} logo`}
            className="absolute right-0 top-1 h-7 w-7 rounded-full object-cover ring-1 ring-slate-950"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        )}
      </div>
      <div className="min-w-0">
      <div className="truncate text-sm font-bold text-white">
        {left.displaySymbol} <span className="text-slate-500">vs</span> {right.displaySymbol}
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <span className="truncate text-[11px] text-slate-500">
          {left.tokenName || left.narrative} / {right.tokenName || right.narrative}
        </span>
        {battle.adminOverride?.pinned && <span className="rounded bg-purple-950 px-1 text-[9px] text-purple-200">PIN</span>}
        {battle.adminOverride?.featured && <span className="rounded bg-amber-950 px-1 text-[9px] text-amber-200">FEATURE</span>}
        {battle.adminOverride?.hidden && <span className="rounded bg-red-950 px-1 text-[9px] text-red-200">HIDDEN</span>}
        {battle.officialListing && <span className="rounded bg-green-950 px-1 text-[9px] text-green-200">LISTED</span>}
      </div>
      </div>
    </div>
  );
}

function OverrideButtons({
  battle,
  onOverride,
}: {
  battle: BattleCandidate;
  onOverride: (battle: BattleCandidate, patch: OverridePatch) => void;
}) {
  const hidden = Boolean(battle.adminOverride?.hidden);
  const pinned = Boolean(battle.adminOverride?.pinned);
  const featured = Boolean(battle.adminOverride?.featured);

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={() => onOverride(battle, { pinned: !pinned })}
        className={`h-6 border-slate-700 px-2 text-[10px] ${pinned ? "bg-purple-900 text-purple-100" : "bg-slate-950 text-slate-300"}`}
      >
        {pinned ? "Unpin" : "Pin"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => onOverride(battle, { featured: !featured })}
        className={`h-6 border-slate-700 px-2 text-[10px] ${featured ? "bg-amber-900 text-amber-100" : "bg-slate-950 text-slate-300"}`}
      >
        {featured ? "Unfeature" : "Feature"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => onOverride(battle, { hidden: !hidden })}
        className={`h-6 border-slate-700 px-2 text-[10px] ${hidden ? "bg-green-900 text-green-100" : "bg-red-950 text-red-200"}`}
      >
        {hidden ? "Unhide" : "Hide"}
      </Button>
    </div>
  );
}

function FeaturedRow({
  battle,
  index,
  selected,
  onToggleSelected,
  onOverride,
}: {
  battle: BattleCandidate;
  index: number;
  selected: boolean;
  onToggleSelected: (battle: BattleCandidate) => void;
  onOverride: (battle: BattleCandidate, patch: OverridePatch) => void;
}) {
  const [left, right] = battle.sides;
  const combinedVolume = (left.volumeH24 || 0) + (right.volumeH24 || 0);
  const reason = battle.rationale[0] || `${battle.category.replace(/_/g, " ")} candidate`;

  return (
    <tr className="border-t border-slate-800/80 text-xs text-slate-300">
      <td className="py-2 pr-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelected(battle)}
          disabled={Boolean(battle.officialListing)}
          className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 accent-purple-600 disabled:opacity-40"
        />
      </td>
      <td className="py-2 pr-2 text-slate-500">{index + 1}</td>
      <td className="min-w-[190px] py-2 pr-3">
        <BattleName battle={battle} />
      </td>
      <td className="py-2 pr-3">
        <Badge variant="outline" className={safetyClass(battle.safetyLabel)}>
          {battle.safetyLabel}
        </Badge>
      </td>
      <td className="py-2 pr-3 text-base font-black text-green-300">{battle.score}</td>
      <td className={`py-2 pr-3 font-bold ${changeClass(left.change)}`}>{shortChange(left.change)}</td>
      <td className={`py-2 pr-3 font-bold ${changeClass(right.change)}`}>{shortChange(right.change)}</td>
      <td className="py-2 pr-3">{formatUsd(combinedVolume)}</td>
      <td className="max-w-[320px] py-2 text-slate-500">
        <span className="line-clamp-1">{reason}</span>
      </td>
      <td className="py-2">
        <OverrideButtons battle={battle} onOverride={onOverride} />
      </td>
    </tr>
  );
}

function CandidateRow({
  battle,
  selected,
  onToggleSelected,
  onOverride,
}: {
  battle: BattleCandidate;
  selected: boolean;
  onToggleSelected: (battle: BattleCandidate) => void;
  onOverride: (battle: BattleCandidate, patch: OverridePatch) => void;
}) {
  return (
    <tr className="border-t border-slate-800/80 text-xs text-slate-300">
      <td className="py-2 pr-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelected(battle)}
          disabled={Boolean(battle.officialListing)}
          className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 accent-purple-600 disabled:opacity-40"
        />
      </td>
      <td className="min-w-[190px] py-2 pr-3">
        <BattleName battle={battle} />
      </td>
      <td className="py-2 pr-3">{battle.category.replace(/_/g, " ")}</td>
      <td className="py-2 pr-3">
        <Badge variant="outline" className={safetyClass(battle.safetyLabel)}>
          {battle.safetyLabel}
        </Badge>
      </td>
      <td className="py-2 pr-3 font-bold text-green-300">{battle.score}</td>
      <td className="py-2 pr-3">{battle.winnerRule.replace(/_/g, " ")}</td>
      <td className="py-2 pr-3">{battle.sides.map((side) => side.chainLabel || side.chainId || "Unknown").join(" / ")}</td>
      <td className="py-2">
        <OverrideButtons battle={battle} onOverride={onOverride} />
      </td>
    </tr>
  );
}

export default function AdminBantahBroEngine() {
  const queryClient = useQueryClient();
  const [scanLimit, setScanLimit] = useState("24");
  const [candidateLimit, setCandidateLimit] = useState("50");
  const [selectedLimit, setSelectedLimit] = useState("16");
  const [featuredLimit, setFeaturedLimit] = useState("5");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedBattleIds, setSelectedBattleIds] = useState<string[]>([]);

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams({
      scanLimit,
      candidateLimit,
      selectedLimit,
      featuredLimit,
      refresh: refreshNonce > 0 ? "true" : "false",
    });
    return `/api/admin/bantahbro/battle-engine/live?${params.toString()}`;
  }, [candidateLimit, featuredLimit, refreshNonce, scanLimit, selectedLimit]);

  const { data, isFetching, error } = useQuery<BattleEngineFeed>({
    queryKey: ["admin-bantahbro-battle-engine", queryUrl],
    queryFn: () => adminApiRequest(queryUrl),
    retry: false,
    staleTime: 15_000,
  });

  const overrideMutation = useMutation({
    mutationFn: ({ battle, patch }: { battle: BattleCandidate; patch: OverridePatch }) =>
      adminApiRequest(`/api/admin/bantahbro/battle-engine/battles/${encodeURIComponent(battle.id)}/override`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bantahbro-battle-engine"] });
    },
  });

  const allSelectableBattles = useMemo(() => {
    const byId = new Map<string, BattleCandidate>();
    for (const battle of data?.featuredBattles || []) byId.set(battle.id, battle);
    for (const battle of data?.candidates || []) byId.set(battle.id, battle);
    return byId;
  }, [data?.candidates, data?.featuredBattles]);

  const selectedBattles = useMemo(
    () =>
      selectedBattleIds
        .map((id) => allSelectableBattles.get(id))
        .filter((battle): battle is BattleCandidate => Boolean(battle && !battle.officialListing)),
    [allSelectableBattles, selectedBattleIds],
  );

  const publishMutation = useMutation({
    mutationFn: (battles: BattleCandidate[]) =>
      adminApiRequest("/api/admin/bantahbro/battle-engine/listed", {
        method: "POST",
        body: JSON.stringify({ battles }),
      }),
    onSuccess: () => {
      setSelectedBattleIds([]);
      queryClient.invalidateQueries({ queryKey: ["admin-bantahbro-battle-engine"] });
    },
  });

  const autoListMutation = useMutation({
    mutationFn: (limit: number) =>
      adminApiRequest("/api/admin/bantahbro/battle-engine/listed/autolist", {
        method: "POST",
        body: JSON.stringify({ limit }),
      }),
    onSuccess: () => {
      setSelectedBattleIds([]);
      queryClient.invalidateQueries({ queryKey: ["admin-bantahbro-battle-engine"] });
    },
  });

  const handleOverride = (battle: BattleCandidate, patch: OverridePatch) => {
    overrideMutation.mutate({ battle, patch });
  };

  const toggleSelectedBattle = (battle: BattleCandidate) => {
    if (battle.officialListing) return;
    setSelectedBattleIds((current) =>
      current.includes(battle.id) ? current.filter((id) => id !== battle.id) : [...current, battle.id],
    );
  };

  const selectVisibleCandidates = () => {
    const visible = (data?.candidates || [])
      .filter((battle) => !battle.officialListing && !battle.adminOverride?.hidden)
      .slice(0, 18)
      .map((battle) => battle.id);
    setSelectedBattleIds(visible);
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">BantahBro Engine</h1>
              <Badge variant="outline" className="border-purple-700/70 bg-purple-950/50 text-purple-200">
                Admin
              </Badge>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500">
              Scanner controls, battle scoring, and curated arena queue. Public users only see selected outputs.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
            <Button
              type="button"
              onClick={() => publishMutation.mutate(selectedBattles)}
              disabled={!selectedBattles.length || publishMutation.isPending || autoListMutation.isPending}
              className="h-8 bg-green-700 px-3 text-xs hover:bg-green-600 disabled:opacity-40"
            >
              List selected ({selectedBattles.length})
            </Button>
            <Button
              type="button"
              onClick={() => autoListMutation.mutate(30)}
              disabled={publishMutation.isPending || autoListMutation.isPending}
              className="h-8 bg-amber-700 px-3 text-xs hover:bg-amber-600 disabled:opacity-40"
            >
              {autoListMutation.isPending ? "Listing..." : "Auto-list 30"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={selectVisibleCandidates}
              disabled={!data?.candidates?.length}
              className="h-8 border-slate-700 bg-slate-950 px-3 text-xs text-slate-200"
            >
              Select visible
            </Button>
            <InputBox label="Scan" value={scanLimit} onChange={setScanLimit} />
            <InputBox label="Candidates" value={candidateLimit} onChange={setCandidateLimit} />
            <InputBox label="Selected" value={selectedLimit} onChange={setSelectedLimit} />
            <InputBox label="Featured" value={featuredLimit} onChange={setFeaturedLimit} />
            <Button
              onClick={() => setRefreshNonce((value) => value + 1)}
              disabled={isFetching}
              className="h-8 bg-purple-700 px-3 text-xs hover:bg-purple-600"
            >
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Scan
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-red-800 bg-red-950/40">
            <CardContent className="p-3 text-xs text-red-200">
              {(error as Error).message || "Battle Engine scan failed"}
            </CardContent>
          </Card>
        )}

        {publishMutation.isError && (
          <Card className="border-red-800 bg-red-950/40">
            <CardContent className="p-3 text-xs text-red-200">
              {(publishMutation.error as Error).message || "Failed to list selected battles"}
            </CardContent>
          </Card>
        )}

        {publishMutation.isSuccess && (
          <Card className="border-green-800 bg-green-950/30">
            <CardContent className="p-3 text-xs text-green-200">
              Selected battles are now officially listed and will appear before normal auto-rotating battles.
            </CardContent>
          </Card>
        )}

        {autoListMutation.isError && (
          <Card className="border-red-800 bg-red-950/40">
            <CardContent className="p-3 text-xs text-red-200">
              {(autoListMutation.error as Error).message || "Failed to auto-list live engine battles"}
            </CardContent>
          </Card>
        )}

        {autoListMutation.isSuccess && (
          <Card className="border-green-800 bg-green-950/30">
            <CardContent className="p-3 text-xs text-green-200">
              The top 30 live Battle Engine candidates are now officially listed from the database.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <StatPill label="Raw" value={data?.scanner.rawScanPool ?? "..."} tone="text-blue-300" />
          <StatPill label="Analyzed" value={data?.scanner.analyzedTokens ?? "..."} tone="text-cyan-300" />
          <StatPill label="Candidates" value={data?.scanner.battleCandidates ?? "..."} tone="text-purple-300" />
          <StatPill label="Selected" value={data?.scanner.selectedLiveBattles ?? "..."} tone="text-green-300" />
          <StatPill label="Featured" value={data?.scanner.featuredBattles ?? "..."} tone="text-amber-300" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <Card className="border-slate-800 bg-slate-900">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="flex items-center justify-between text-sm text-white">
                  <span className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-300" />
                    Featured Queue
                  </span>
                  <span className="text-xs font-normal text-slate-500">
                    {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : "waiting"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left">
                    <thead className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th className="py-2 pr-2">Select</th>
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2 pr-3">Battle</th>
                        <th className="py-2 pr-3">Safety</th>
                        <th className="py-2 pr-3">Score</th>
                        <th className="py-2 pr-3">A 24H</th>
                        <th className="py-2 pr-3">B 24H</th>
                        <th className="py-2 pr-3">Volume</th>
                        <th className="py-2">Reason</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.featuredBattles.length ? (
                        data.featuredBattles.map((battle, index) => (
                          <FeaturedRow
                            key={battle.id}
                            battle={battle}
                            index={index}
                            selected={selectedBattleIds.includes(battle.id)}
                            onToggleSelected={toggleSelectedBattle}
                            onOverride={handleOverride}
                          />
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-xs text-slate-500">
                            {isFetching ? "Scanning live sources..." : "No featured battles selected."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-white">
                  <Swords className="h-4 w-4 text-purple-300" />
                  Candidate Table
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left">
                    <thead className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th className="py-2 pr-2">Select</th>
                        <th className="py-2 pr-3">Battle</th>
                        <th className="py-2 pr-3">Category</th>
                        <th className="py-2 pr-3">Safety</th>
                        <th className="py-2 pr-3">Score</th>
                        <th className="py-2 pr-3">Rule</th>
                        <th className="py-2 pr-3">Chains</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.candidates || []).slice(0, 18).map((battle) => (
                        <CandidateRow
                          key={battle.id}
                          battle={battle}
                          selected={selectedBattleIds.includes(battle.id)}
                          onToggleSelected={toggleSelectedBattle}
                          onOverride={handleOverride}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <Card className="border-slate-800 bg-slate-900">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-white">
                  <Activity className="h-4 w-4 text-green-300" />
                  Sources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0 text-xs">
                <div className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2">
                  <span className="text-slate-300">Dexscreener</span>
                  <Badge variant="outline" className={data?.sources.dexscreener.active ? "border-green-700 text-green-300" : "border-red-700 text-red-300"}>
                    {data?.sources.dexscreener.active ? "Live" : "Off"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2">
                  <span className="text-slate-300">Virtuals ACP</span>
                  <span className="text-slate-500">Planned</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2">
                  <span className="text-slate-300">Bankr Agents</span>
                  <span className="text-slate-500">Planned</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-white">
                  <ShieldCheck className="h-4 w-4 text-cyan-300" />
                  Safety
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0 text-xs">
                <div className="flex justify-between rounded-lg bg-slate-950 px-3 py-2">
                  <span className="text-slate-500">Liquidity</span>
                  <span className="text-white">{formatUsd(data?.filters.minLiquidityUsd)}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-950 px-3 py-2">
                  <span className="text-slate-500">24H volume</span>
                  <span className="text-white">{formatUsd(data?.filters.minVolumeH24)}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-950 px-3 py-2">
                  <span className="text-slate-500">Age</span>
                  <span className="text-white">{data?.filters.minAgeMinutes || 0} min</span>
                </div>
              </CardContent>
            </Card>

            <details className="rounded-xl border border-slate-800 bg-slate-900">
              <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm font-semibold text-white">
                <Database className="h-4 w-4 text-blue-300" />
                Rejected Tokens
              </summary>
              <div className="space-y-2 p-3 pt-0">
                {(data?.rejectedTokens || []).slice(0, 10).map((token, index) => (
                  <div key={`${token.chainId}-${token.tokenAddress}-${index}`} className="rounded-lg bg-slate-950 px-3 py-2">
                    <div className="text-xs font-semibold text-white">{token.symbol || "Unknown"}</div>
                    <div className="text-[11px] text-slate-500">{token.reason}</div>
                  </div>
                ))}
                {!data?.rejectedTokens.length && <div className="text-xs text-slate-500">No rejected tokens in this scan.</div>}
              </div>
            </details>

            <details className="rounded-xl border border-slate-800 bg-slate-900">
              <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm font-semibold text-white">
                <SlidersHorizontal className="h-4 w-4 text-purple-300" />
                Next Controls
              </summary>
              <div className="space-y-2 p-3 pt-0 text-xs text-slate-500">
                <p className="rounded-lg bg-slate-950 p-2">Pair-link creation: Dexscreener A + B.</p>
                <p className="rounded-lg bg-slate-950 p-2">Sponsored hosting packages + BXBT stake.</p>
                <p className="rounded-lg bg-slate-950 p-2">Virtuals/Bankr import queue.</p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
