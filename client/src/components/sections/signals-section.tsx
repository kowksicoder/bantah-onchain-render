'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface Signal {
  id: string;
  platform: string;
  icon: string;
  description: string;
  tags: string[];
  traders: string;
  timestamp: string;
  sentiment?: string;
}

const MOCK_SIGNALS: Signal[] = [
  {
    id: '1',
    platform: 'Polymarket',
    icon: '🎲',
    description: 'Will SOL hit $200 in May?',
    tags: ['Momentum', 'Whale Accumulation', 'High Volume'],
    traders: '2.1K traders',
    timestamp: 'Vol. $1.2M',
    sentiment: 'Bullish',
  },
  {
    id: '2',
    platform: 'predict.fun',
    icon: '🔮',
    description: 'Will Trump win 2024 election?',
    tags: ['Political'],
    traders: '1.4K traders',
    timestamp: 'Vol. $860K',
  },
  {
    id: '3',
    platform: 'LIMITLESS',
    icon: '♾️',
    description: 'Will AI agents outperform BTC in 2024?',
    tags: ['AI', 'Tech'],
    traders: '987 traders',
    timestamp: 'Vol. $420K',
    sentiment: 'Bullish',
  },
];

export default function SignalsSection() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 750);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-background px-2 py-1.5">
        <div className="text-sm font-bold text-foreground mb-0.5">📡 TOP SIGNALS</div>
        <div className="text-sm text-muted-foreground">Trending platforms - Create market</div>
      </div>

      {/* Signals Grid */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5">
        <div className="space-y-1.5">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border border-border/50 rounded px-2 py-2 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="w-5 h-5 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16 ml-auto" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-16 rounded" />
                    <Skeleton className="h-5 w-20 rounded" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
              ))
            : MOCK_SIGNALS.map((signal) => (
                <div key={signal.id} className="bg-muted/30 border border-border/50 rounded px-2 py-1.5 hover:border-accent hover:bg-muted/50 transition cursor-pointer group">
                  <div className="flex items-start justify-between gap-1.5 mb-0.5">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-base">{signal.icon}</span>
                      <div className="text-sm font-bold text-foreground">{signal.platform}</div>
                      {signal.sentiment && <span className="text-sm text-secondary font-bold">▲ {signal.sentiment}</span>}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-2 mb-0.5">{signal.description}</div>
                  <div className="flex flex-wrap gap-1 mb-0.5">
                    {signal.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>{signal.traders}</span>
                    <button className="text-accent hover:text-accent text-sm font-bold group-hover:opacity-100 opacity-0 transition">
                      + Create
                    </button>
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-background px-2 py-1.5">
        <button className="text-sm text-accent hover:text-accent/80 font-bold">
          View all →
        </button>
      </div>
    </div>
  );
}
