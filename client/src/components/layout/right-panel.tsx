'use client';

import LivePrediction from '@/components/sections/live-prediction';
import AgentBattle from '@/components/sections/agent-battle';
import TopAgents from '@/components/sections/top-agents';
import type { AppSection } from '@/app/page';

interface RightPanelProps {
  selectedToken: string;
  defaultTab?: string;
  onNavigate?: (section: AppSection) => void;
}

export default function RightPanel({ selectedToken, onNavigate }: RightPanelProps) {
  return (
    <div className="w-full lg:w-72 flex flex-col gap-0.5 overflow-hidden shrink-0">
      {/* LIVE MARKET */}
      <div className="h-auto lg:flex-[5] bg-card border border-border rounded overflow-hidden flex flex-col min-h-0">
        <LivePrediction token={selectedToken} />
      </div>

      {/* AGENT BATTLE - compact */}
      <div className="h-auto lg:flex-[4] bg-card border border-border rounded overflow-hidden flex flex-col min-h-0">
        <AgentBattle onViewBattle={() => onNavigate?.('battles')} />
      </div>

      {/* TOP AGENTS */}
      <div className="h-auto lg:flex-[3] bg-card border border-border rounded overflow-hidden flex flex-col min-h-0">
        <TopAgents />
      </div>
    </div>
  );
}
