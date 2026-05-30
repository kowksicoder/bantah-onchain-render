import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { adminApiRequest } from "@/lib/adminApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Shield, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type RugReportStatus = "open" | "reviewed" | "dismissed";

type RugReport = {
  id: string;
  reporterKey: string;
  tokenKey: string;
  chainId: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  severity: "low" | "medium" | "high";
  reason: string;
  notes: string | null;
  status: RugReportStatus;
  createdAt: string;
};

type ReportsPayload = {
  reports: RugReport[];
  updatedAt: string;
};

function timeAgo(value?: string | null) {
  if (!value) return "just now";
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function shorten(value: string, head = 6, tail = 4) {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function severityClass(severity: RugReport["severity"]) {
  if (severity === "high") return "border-red-700/70 bg-red-950/60 text-red-300";
  if (severity === "medium") return "border-amber-700/70 bg-amber-950/60 text-amber-300";
  return "border-green-700/70 bg-green-950/60 text-green-300";
}

function statusClass(status: RugReportStatus) {
  if (status === "reviewed") return "border-green-700/70 bg-green-950/60 text-green-300";
  if (status === "dismissed") return "border-slate-700 bg-slate-900 text-slate-300";
  return "border-pink-700/70 bg-pink-950/50 text-pink-300";
}

export default function AdminRugScorerReports() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<RugReportStatus | "all">("open");

  const { data, isLoading, isFetching, error, refetch } = useQuery<ReportsPayload>({
    queryKey: ["admin-rug-scorer-reports"],
    queryFn: () => adminApiRequest("/api/bantahbro/rug-v2/reports?limit=100"),
    staleTime: 20_000,
  });

  const reports = Array.isArray(data?.reports) ? data.reports : [];
  const filteredReports = useMemo(() => {
    if (statusFilter === "all") return reports;
    return reports.filter((report) => report.status === statusFilter);
  }, [reports, statusFilter]);

  const counts = useMemo(() => {
    return reports.reduce(
      (acc, report) => {
        acc.total += 1;
        acc[report.status] += 1;
        return acc;
      },
      { total: 0, open: 0, reviewed: 0, dismissed: 0 },
    );
  }, [reports]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RugReportStatus }) =>
      adminApiRequest(`/api/bantahbro/rug-v2/reports/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast({
        title: "Report updated",
        description: "Community scam report status saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-rug-scorer-reports"] });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Update failed",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const filterButtons: Array<{ label: string; value: RugReportStatus | "all"; count: number }> = [
    { label: "Open", value: "open", count: counts.open },
    { label: "Reviewed", value: "reviewed", count: counts.reviewed },
    { label: "Dismissed", value: "dismissed", count: counts.dismissed },
    { label: "All", value: "all", count: counts.total },
  ];

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-950 p-4 text-white md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-800/60 bg-pink-950/30 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-pink-200">
              <Shield className="h-3.5 w-3.5" />
              Rug Scorer
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">Community Scam Reports</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Review reports submitted from BOTA Rug Scorer. No mock reports are shown here.
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            className="border border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-800 bg-slate-900/80">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Open</div>
              <div className="mt-1 text-2xl font-black text-pink-300">{counts.open}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/80">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Reviewed</div>
              <div className="mt-1 text-2xl font-black text-green-300">{counts.reviewed}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/80">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Dismissed</div>
              <div className="mt-1 text-2xl font-black text-slate-300">{counts.dismissed}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/80">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Total</div>
              <div className="mt-1 text-2xl font-black text-white">{counts.total}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-800 bg-slate-900/80">
          <CardHeader className="gap-3 border-b border-slate-800 p-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base font-black text-white">Report Queue</CardTitle>
            <div className="flex flex-wrap gap-2">
              {filterButtons.map((button) => (
                <button
                  key={button.value}
                  type="button"
                  onClick={() => setStatusFilter(button.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-black transition ${
                    statusFilter === button.value
                      ? "border-pink-500 bg-pink-600 text-white"
                      : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  {button.label} {button.count}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-sm text-slate-400">Loading live reports...</div>
            ) : error ? (
              <div className="flex items-start gap-2 p-6 text-sm text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error instanceof Error ? error.message : "Reports failed to load."}
              </div>
            ) : filteredReports.length ? (
              <div className="divide-y divide-slate-800">
                {filteredReports.map((report) => {
                  const rugUrl = `/bantahbro/rug-scorer?chainId=${encodeURIComponent(report.chainId)}&token=${encodeURIComponent(report.tokenAddress)}`;

                  return (
                    <div key={report.id} className="grid gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_15rem]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-base font-black text-white">
                            {report.tokenSymbol ? `$${report.tokenSymbol}` : report.tokenName || "Unknown token"}
                          </div>
                          <Badge className={severityClass(report.severity)}>{report.severity}</Badge>
                          <Badge className={statusClass(report.status)}>{report.status}</Badge>
                          <span className="text-xs text-slate-500">{timeAgo(report.createdAt)}</span>
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-400">
                          {report.chainId} / {shorten(report.tokenAddress, 10, 8)} / reporter {shorten(report.reporterKey, 10, 6)}
                        </div>
                        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
                          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Reason</div>
                          <div className="mt-1 text-sm text-slate-100">{report.reason}</div>
                          {report.notes && <div className="mt-2 text-sm text-slate-400">{report.notes}</div>}
                        </div>
                      </div>

                      <div className="flex flex-wrap content-start gap-2 xl:justify-end">
                        <Button
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: report.id, status: "reviewed" })}
                          disabled={updateStatusMutation.isPending || report.status === "reviewed"}
                          className="bg-green-700 text-white hover:bg-green-600"
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          Reviewed
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: report.id, status: "dismissed" })}
                          disabled={updateStatusMutation.isPending || report.status === "dismissed"}
                          className="bg-slate-800 text-white hover:bg-slate-700"
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5" />
                          Dismiss
                        </Button>
                        {report.status !== "open" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ id: report.id, status: "open" })}
                            disabled={updateStatusMutation.isPending}
                            className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"
                          >
                            Reopen
                          </Button>
                        )}
                        <a
                          href={rugUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center rounded-md border border-slate-700 px-3 text-sm font-bold text-slate-200 hover:bg-slate-800"
                        >
                          Open scan <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-slate-400">
                No {statusFilter === "all" ? "" : statusFilter} community reports yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
