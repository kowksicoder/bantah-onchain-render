'use client';

import { useState, useEffect } from 'react';
import { Share2, Star, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface PredictionProps {
  token: string;
}

export default function LivePrediction({ token }: PredictionProps) {
  const [yesPercent, setYesPercent] = useState(62);
  const [noPercent, setNoPercent] = useState(38);
  const totalPool = 12845;
  const [userBet, setUserBet] = useState('500');
  const [selectedChoice, setSelectedChoice] = useState<'yes' | 'no' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const newYes = Math.max(30, Math.min(70, 62 + (Math.random() - 0.5) * 8));
      setYesPercent(Math.round(newYes));
      setNoPercent(Math.round(100 - newYes));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const yesVol = Math.round(totalPool * (yesPercent / 100));
  const noVol = Math.round(totalPool * (noPercent / 100));
  const betAmt = parseInt(userBet) || 0;
  const potentialPayout = selectedChoice === 'yes'
    ? Math.round(betAmt * (totalPool / yesVol))
    : Math.round(betAmt * (totalPool / noVol));

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden p-3 gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-1"><Skeleton className="h-7 w-7 rounded" /><Skeleton className="h-7 w-7 rounded" /></div>
        </div>
        <div className="flex items-start gap-2">
          <Skeleton className="w-12 h-12 rounded-full shrink-0" />
          <Skeleton className="h-12 flex-1" />
        </div>
        <Skeleton className="h-4 w-36" />
        <div className="flex gap-2">
          <Skeleton className="flex-1 h-16 rounded" />
          <Skeleton className="flex-1 h-16 rounded" />
        </div>
        <Skeleton className="h-10 w-full rounded" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-background px-3 py-2 flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-muted-foreground tracking-wider">LIVE MARKET</span>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-muted rounded transition"><Share2 size={13} className="text-muted-foreground" /></button>
          <button className="p-1 hover:bg-muted rounded transition"><Star size={13} className="text-muted-foreground" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Market info */}
        <div className="px-3 pt-3 pb-2 border-b border-border">
          <div className="flex items-start gap-2.5 mb-2">
            <div className="w-11 h-11 rounded-full bg-muted border border-border flex items-center justify-center text-2xl shrink-0">
              🐸
            </div>
            <div>
              <div className="text-sm font-bold text-foreground leading-snug">
                Will ${token} 2x in 24H? 🚀
              </div>
              <span className="inline-block mt-1 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded font-bold">
                Memecoin
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
            <span>Ends in <span className="text-foreground font-bold">23h 14m 32s</span></span>
            <span>Total Pool <span className="text-foreground font-bold">{totalPool.toLocaleString()} BXBT</span></span>
          </div>
        </div>

        {/* YES / NO Big Buttons */}
        <div className="flex gap-2 px-3 py-2.5 border-b border-border">
          <button
            onClick={() => setSelectedChoice('yes')}
            className={`flex-1 rounded-lg py-3 flex flex-col items-center gap-0.5 font-bold transition border-2 ${
              selectedChoice === 'yes'
                ? 'bg-secondary border-secondary text-background'
                : 'bg-secondary/10 border-secondary/40 text-secondary hover:bg-secondary/20'
            }`}
          >
            <span className="text-xs">YES</span>
            <span className="text-lg font-mono">{yesPercent}%</span>
            <span className="text-xs font-normal opacity-80">{yesVol.toLocaleString()} BXBT</span>
          </button>
          <button
            onClick={() => setSelectedChoice('no')}
            className={`flex-1 rounded-lg py-3 flex flex-col items-center gap-0.5 font-bold transition border-2 ${
              selectedChoice === 'no'
                ? 'bg-destructive border-destructive text-background'
                : 'bg-destructive/10 border-destructive/40 text-destructive hover:bg-destructive/20'
            }`}
          >
            <span className="text-xs">NO</span>
            <span className="text-lg font-mono">{noPercent}%</span>
            <span className="text-xs font-normal opacity-80">{noVol.toLocaleString()} BXBT</span>
          </button>
        </div>

        {/* Bet amount + payout */}
        <div className="px-3 py-2.5 space-y-2">
          {selectedChoice && (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Your Bet <span className="font-bold text-foreground uppercase">{selectedChoice}</span></span>
                <span className="font-mono font-bold text-foreground">{userBet} BXBT</span>
              </div>
              <div className="flex gap-1.5 mb-1">
                {['100', '500', '1000', '2000'].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setUserBet(amt)}
                    className={`flex-1 text-xs py-1 rounded border transition ${
                      userBet === amt ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={userBet}
                onChange={e => setUserBet(e.target.value)}
                className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary"
              />
              <div className="flex items-center justify-between bg-muted/50 border border-border rounded px-2.5 py-1.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap size={11} className="text-primary" /> Potential Payout
                </span>
                <span className="text-sm font-mono font-bold text-primary">{potentialPayout.toLocaleString()} BXBT</span>
              </div>
            </>
          )}

          {!selectedChoice && (
            <div className="text-center py-2 text-xs text-muted-foreground">
              Select YES or NO above to place a bet
            </div>
          )}

          <button
            disabled={!selectedChoice || !betAmt}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-40 transition"
          >
            Place Bet
          </button>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="text-secondary">{yesPercent}% YES</span>
              <span className="text-destructive">{noPercent}% NO</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
              <div className="bg-secondary transition-all duration-700" style={{ width: `${yesPercent}%` }} />
              <div className="bg-destructive transition-all duration-700" style={{ width: `${noPercent}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
