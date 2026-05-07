'use client';

import AgentBattle from '@/components/sections/agent-battle';
import { ArrowUpRight, Megaphone } from 'lucide-react';
import type { AppSection } from '@/app/page';

interface RightPanelProps {
  selectedToken: string;
  defaultTab?: string;
  onNavigate?: (section: AppSection) => void;
}

function AdsPlacementCard({ onNavigate }: { onNavigate?: (section: AppSection) => void }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border bg-background px-3 py-2 flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-muted-foreground tracking-wider">ADS PLACEMENT</span>
        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-black text-primary">SPONSOR</span>
      </div>

      <button
        type="button"
        onClick={() => onNavigate?.('ads')}
        className="group flex-1 p-3 text-left"
      >
        <div className="relative h-full min-h-[10.5rem] overflow-hidden rounded border border-primary/25 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.28),transparent_42%),linear-gradient(135deg,rgba(9,9,9,0.98),rgba(18,18,18,0.92))] p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex size-9 items-center justify-center rounded bg-primary/20 text-primary">
              <Megaphone size={18} />
            </div>
            <span className="rounded-full border border-primary/35 bg-primary/15 px-2 py-0.5 text-[10px] font-black text-primary">
              SPONSORED
            </span>
          </div>

          <div className="mt-3 max-w-[12.5rem]">
            <div className="text-lg font-black leading-tight text-white">Promote your coin</div>
            <div className="mt-1 text-xs leading-snug text-white/65">
              Sidebar ads, feed boosts, and sponsored battle hosting.
            </div>
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
            <div className="min-w-0 flex-1 rounded border border-white/10 bg-white/10 px-2 py-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-white/50">Battle hosting</div>
              <div className="truncate text-xs font-black text-white">BXBT stake required</div>
            </div>
            <div className="flex size-9 items-center justify-center rounded bg-primary text-primary-foreground transition group-hover:opacity-90">
              <ArrowUpRight size={15} />
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

export default function RightPanel({ onNavigate }: RightPanelProps) {
  return (
    <div className="w-full lg:w-72 flex flex-col gap-0.5 overflow-hidden shrink-0">
      {/* ADS PLACEMENT */}
      <div className="h-auto lg:flex-[5] bg-card border border-border rounded overflow-hidden flex flex-col min-h-0">
        <AdsPlacementCard onNavigate={onNavigate} />
      </div>

      {/* AGENT BATTLE - compact */}
      <div className="h-auto lg:flex-[4] bg-card border border-border rounded overflow-hidden flex flex-col min-h-0">
        <AgentBattle onViewBattle={() => onNavigate?.('battles')} />
      </div>

    </div>
  );
}
