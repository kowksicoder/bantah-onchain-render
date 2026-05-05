import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";

type SkillEndpoint = {
  method: "GET";
  path: string;
  note?: string;
};

type SkillGroup = {
  title: string;
  description: string;
  endpoints: SkillEndpoint[];
};

function safeOrigin() {
  if (typeof window === "undefined") return "";
  return window.location.origin || "";
}

export default function Skills() {
  const [copied, setCopied] = useState(false);
  const origin = useMemo(() => safeOrigin(), []);

  const groups = useMemo<SkillGroup[]>(
    () => [
      {
        title: "Challenge Discovery",
        description: "Public read endpoints for markets/challenges.",
        endpoints: [
          { method: "GET", path: "/api/challenges?feed=all", note: "Public feed" },
          { method: "GET", path: "/api/challenges/public", note: "Admin-created public challenges" },
          { method: "GET", path: "/api/challenges/:id", note: "Public challenge detail" },
          {
            method: "GET",
            path: "/api/challenges/:id/messages",
            note: "Public messages for admin-created onchain challenges",
          },
        ],
      },
      {
        title: "Leaderboard",
        description: "Global Bantah ranking.",
        endpoints: [{ method: "GET", path: "/api/leaderboard" }],
      },
      {
        title: "Onchain Status",
        description: "Supported chains/tokens + runtime enforcement status.",
        endpoints: [
          { method: "GET", path: "/api/onchain/config" },
          { method: "GET", path: "/api/onchain/status" },
        ],
      },
      {
        title: "Public Profiles",
        description: "Human-readable profile pages for users.",
        endpoints: [
          { method: "GET", path: "/u/:username", note: "Redirects to /@:username profile view" },
          { method: "GET", path: "/@:username", note: "Profile view route" },
        ],
      },
    ],
    [],
  );

  const copyBaseUrl = async () => {
    try {
      await navigator.clipboard.writeText(origin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1100);
    } catch {
      // ignore (clipboard may be blocked)
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6 md:space-y-8">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-7 shadow-sm">
          <div className="flex flex-col gap-4">
            <Badge className="w-fit bg-[#ccff00]/30 text-slate-900 dark:text-slate-100 border border-[#ccff00]/50 hover:bg-[#ccff00]/30">
              Public Bantah skills (safe read endpoints)
            </Badge>

            <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6">
              <div className="space-y-3">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
                  Bantah Skills
                </h1>
                <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                  These endpoints are public and read-only, so third-party agents can discover markets and read state
                  without Bantah sign-in. Protected actions (create, accept, vote, settle) still require Bantah auth.
                </p>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <Button
                    className="h-10 px-5 text-xs font-bold uppercase tracking-wide border-0 bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    onClick={() => window.open("/api/skills", "_blank", "noopener,noreferrer")}
                  >
                    Open JSON
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    className="h-10 px-5 text-xs font-bold uppercase tracking-wide border-0"
                    onClick={() => window.open("/api/challenges?feed=all", "_blank", "noopener,noreferrer")}
                  >
                    Try Feed
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    className="h-10 px-5 text-xs font-bold uppercase tracking-wide border-0 bg-[#ccff00]/70 text-slate-900 hover:bg-[#ccff00]"
                    onClick={copyBaseUrl}
                    disabled={!origin}
                  >
                    {copied ? "Copied" : "Copy Base URL"}
                    <Copy className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                    Base URL
                  </p>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Use in agents
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Your agent can prefix all paths with:
                  </p>
                  <code className="block text-xs md:text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
                    {origin || "(open this page on a deployed domain)"}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {groups.map((group) => (
            <div
              key={group.title}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
                    {group.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {group.description}
                  </p>
                </div>
                <Badge className="bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                  Public
                </Badge>
              </div>

              <div className="space-y-2">
                {group.endpoints.map((ep) => (
                  <div
                    key={`${group.title}:${ep.path}`}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200 px-2 py-0.5 rounded">
                        {ep.method}
                      </span>
                      <code className="text-xs md:text-[13px] font-mono text-slate-900 dark:text-slate-100 break-all">
                        {ep.path}
                      </code>
                    </div>
                    {ep.note ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-snug">{ep.note}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

