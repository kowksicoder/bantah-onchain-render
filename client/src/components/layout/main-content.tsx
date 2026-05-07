'use client';

import { useState } from 'react';
import { LineChart, X } from 'lucide-react';
import TradingChart from '@/components/sections/trading-chart';
import MarketsTable from '@/components/sections/markets-table';
import SignalsSection from '@/components/sections/signals-section';
import type { AppSection } from '@/app/page';

interface MainContentProps {
  selectedToken: string;
  setSelectedToken: (token: string) => void;
  activeSection?: AppSection;
  onNavigate?: (section: AppSection) => void;
}

const TOP_TABS = [
  { id: 'markets', icon: 'B', label: 'BANTAH Onchain', sub: 'P2P Predictions.' },
  { id: 'battles', icon: '⚔', label: 'BATTLES', sub: 'Live battle listings', badge: 'LIVE', badgeColor: 'bg-destructive text-white' },
  { id: 'signals', icon: 'S', label: 'SIGNALS', sub: 'Trending from top platforms', badge: 'NEW', badgeColor: 'bg-secondary text-background' },
] as const;

type TopTab = (typeof TOP_TABS)[number]['id'];

export default function MainContent({ selectedToken, setSelectedToken, onNavigate }: MainContentProps) {
  const [topTab, setTopTab] = useState<TopTab>('markets');
  const [showChart, setShowChart] = useState(false);

  const handleSelectToken = (token: string) => {
    setSelectedToken(token);
    setShowChart(true);
  };

  return (
    <div className="flex-1 flex flex-col gap-0.5 min-w-0 overflow-hidden">
      <div className="bg-card border border-border rounded overflow-hidden shrink-0">
        <div className="flex divide-x divide-border">
          {TOP_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTopTab(tab.id)}
              className={`flex-1 flex items-center gap-2 px-3 py-2.5 transition text-left ${
                topTab === tab.id
                  ? 'bg-primary/10 border-b-2 border-primary'
                  : 'hover:bg-muted/50'
              }`}
            >
              <span className="text-lg shrink-0">{tab.id === 'battles' ? 'BTL' : tab.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-foreground">{tab.label}</span>
                  {'badge' in tab && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${tab.badgeColor}`}>{tab.badge}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground hidden sm:block truncate">{tab.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {showChart && (
        <div className="h-52 md:h-64 bg-card border border-border rounded overflow-hidden flex flex-col shrink-0 relative">
          <button
            onClick={() => setShowChart(false)}
            className="absolute top-2 right-2 z-10 p-1 bg-muted/80 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition"
            title="Hide chart"
          >
            <X size={13} />
          </button>
          <TradingChart token={selectedToken} />
        </div>
      )}

      <div className="flex-1 bg-card border border-border rounded overflow-hidden flex flex-col min-h-0">
        {topTab === 'markets' && !showChart && (
          <div className="border-b border-border bg-background px-3 py-1.5 flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowChart(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
            >
              <LineChart size={13} />
              <span>Show chart for <span className="font-bold text-foreground">{selectedToken}</span></span>
            </button>
          </div>
        )}

        {topTab === 'markets' && (
          <MarketsTable onSelectToken={handleSelectToken} />
        )}
        {topTab === 'battles' && (
          <MarketsTable mode="battles" onSelectToken={handleSelectToken} onSelectBattle={() => onNavigate?.('battles')} />
        )}
        {topTab === 'signals' && (
          <SignalsSection />
        )}
      </div>
    </div>
  );
}
