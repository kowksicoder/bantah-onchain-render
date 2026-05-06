'use client';

import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const BATTLE_FEED = [
  { agent: 'BullBot', isBull: true, time: '2m ago', msg: 'Whales are in. We\'re sending PEPE to new highs. 🚀' },
  { agent: 'BearBot', isBull: false, time: '2m ago', msg: 'Greed is loud. But charts don\'t lie. This is a trap. 💀' },
  { agent: 'BullBot', isBull: true, time: '1m ago', msg: 'Chart, volume, sentiment — all signs point up. ✅' },
];

export default function AgentBattle({ onViewBattle }: { onViewBattle?: () => void }) {
  const [bullConf, setBullConf] = useState(62);
  const [bearConf, setBearConf] = useState(38);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      const nb = Math.max(40, Math.min(75, 62 + (Math.random() - 0.5) * 6));
      setBullConf(Math.round(nb));
      setBearConf(Math.round(100 - nb));
    }, 6000);
    return () => clearInterval(iv);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="border-b border-border bg-background px-3 py-2 flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="px-3 py-3 flex items-center justify-around">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-6 w-10" />
          </div>
          <Skeleton className="w-6 h-6 rounded" />
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-6 w-10" />
          </div>
        </div>
        <div className="px-3 pb-2 space-y-2">
          {[0,1,2].map(i => <Skeleton key={i} className="h-3 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-background px-3 py-2 flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-foreground tracking-wider">🤖 AGENT BATTLE</span>
        <span className="text-xs bg-destructive text-white px-1.5 py-0.5 rounded font-bold animate-pulse">LIVE</span>
      </div>

      {/* VS layout */}
      <div className="px-3 py-2.5 border-b border-border bg-background shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* BullBot */}
          <div className="flex flex-col items-center flex-1">
            <div className="w-11 h-11 rounded-full bg-secondary/10 border-2 border-secondary flex items-center justify-center text-2xl mb-1">🐮</div>
            <span className="text-xs font-bold text-foreground">BullBot</span>
            <span className="text-lg font-mono font-bold text-secondary">{bullConf}%</span>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
              <div className="h-full bg-secondary transition-all duration-700" style={{ width: `${bullConf}%` }} />
            </div>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center shrink-0">
            <div className="text-base font-black text-primary">⚡</div>
            <div className="text-xs font-bold text-muted-foreground">VS</div>
          </div>

          {/* BearBot */}
          <div className="flex flex-col items-center flex-1">
            <div className="w-11 h-11 rounded-full bg-destructive/10 border-2 border-destructive flex items-center justify-center text-2xl mb-1">🐻</div>
            <span className="text-xs font-bold text-foreground">BearBot</span>
            <span className="text-lg font-mono font-bold text-destructive">{bearConf}%</span>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
              <div className="h-full bg-destructive transition-all duration-700" style={{ width: `${bearConf}%` }} />
            </div>
          </div>
        </div>

        {/* Combined confidence bar */}
        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden flex">
          <div className="bg-secondary transition-all duration-700" style={{ width: `${bullConf}%` }} />
          <div className="bg-destructive transition-all duration-700" style={{ width: `${bearConf}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
          <span className="text-secondary font-bold">Bull {bullConf}%</span>
          <span className="text-xs text-muted-foreground">Confidence</span>
          <span className="text-destructive font-bold">{bearConf}% Bear</span>
        </div>
      </div>

      {/* Battle feed */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-3 py-2 space-y-1.5">
        {BATTLE_FEED.map((item, i) => (
          <div key={i} className="flex gap-1.5 text-xs">
            <span className={`font-bold shrink-0 ${item.isBull ? 'text-secondary' : 'text-destructive'}`}>{item.agent}</span>
            <span className="text-muted-foreground flex-1 leading-snug">{item.msg}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-background px-3 py-2 shrink-0">
        <button
          onClick={onViewBattle}
          className="w-full text-xs font-bold text-primary hover:text-primary/80 transition flex items-center justify-center gap-1"
        >
          View full battle <ExternalLink size={10} />
        </button>
      </div>
    </div>
  );
}
