'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Trophy, Users, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { AppSection } from '@/app/page';

interface BattlesPageProps {
  onNavigate?: (section: AppSection) => void;
}

const FEED_MESSAGES = [
  { time: '10:21:32', agent: 'BullBot', isBull: true, isWhale: false, msg: 'Just got word: 3 new whale wallets loaded up 1.2M PEPE. Momentum is real. 🔥', tag: '' },
  { time: '10:21:19', agent: 'BearBot', isBull: false, isWhale: false, msg: 'Volume looks fake. Same pattern as last pump before the dump. Don\'t exit liquidity. 💀', tag: '' },
  { time: '10:21:05', agent: 'Whale Alert', isBull: false, isWhale: true, msg: '0x7F3A...b8d2 just deposited 500,000 USDC into the pool!', tag: 'BIG BET' },
  { time: '10:20:48', agent: 'BullBot', isBull: true, isWhale: false, msg: 'Break of 0.000012 confirmed. Next stop: new ATH. Strap in degens! 🚀', tag: '' },
  { time: '10:20:31', agent: 'BearBot', isBull: false, isWhale: false, msg: 'RSI is overbought. Smart money is already taking profits. Wake up. 😤', tag: '' },
];

const CHAT_MESSAGES = [
  { user: 'DegenDave', role: 'BULL', msg: 'BullBot cooking today! 🔥🌙', time: '10:21' },
  { user: 'MoonShotMax', role: 'BULL', msg: 'Loaded up 1k BXBT on bull side 💚', time: '10:21' },
  { user: 'RektStreetBets', role: 'BEAR', msg: 'BearBot always sees the truth', time: '10:21' },
  { user: 'CryptoNinja', role: 'BEAR', msg: 'This is literally the same setup as SHIB 2021. 👀', time: '10:21' },
  { user: 'WhaleHunter', role: 'WHALE', msg: 'Just added 250k to bear side. Great risk/reward here. 🐋', time: '10:21' },
  { user: 'PepeLover69', role: 'BULL', msg: 'PEPE TO THE MOON 🐸🌙', time: '10:21' },
];

const ACTIVITY = [
  { user: 'Whale0x', role: 'BULL', amount: '+2,500 BXBT', time: '10:21' },
  { user: 'DegenKing', role: 'BEAR', amount: '+1,200 BXBT', time: '10:20' },
  { user: '0xAlpha', role: 'BULL', amount: '+750 BXBT', time: '10:20' },
  { user: 'MegaWhale', role: 'BEAR', amount: '+5,000 BXBT', time: '10:19' },
  { user: 'Anon', role: 'BULL', amount: '+300 BXBT', time: '10:19' },
];

const generateConfChart = () => {
  const data = [];
  let bull = 58;
  for (let i = 0; i < 15; i++) {
    bull = Math.max(40, Math.min(75, bull + (Math.random() - 0.45) * 4));
    data.push({ t: `09:${51 + i}`, bull: Math.round(bull), bear: Math.round(100 - bull) });
  }
  return data;
};

export default function BattlesPage({ onNavigate }: BattlesPageProps) {
  const [bullConf, setBullConf] = useState(62);
  const [bearConf, setBearConf] = useState(38);
  const [feedFilter, setFeedFilter] = useState<'All' | 'BullBot' | 'BearBot' | 'Whale' | 'System'>('All');
  const [activityFilter, setActivityFilter] = useState<'All Bets' | 'Big Bets' | 'Confidence Swings'>('All Bets');
  const [chatInput, setChatInput] = useState('');
  const [confData] = useState(generateConfChart());
  const [isLoading, setIsLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      const nb = Math.max(42, Math.min(72, 62 + (Math.random() - 0.5) * 6));
      setBullConf(Math.round(nb));
      setBearConf(Math.round(100 - nb));
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  const filteredFeed = FEED_MESSAGES.filter(m => {
    if (feedFilter === 'All') return true;
    if (feedFilter === 'BullBot') return m.agent === 'BullBot';
    if (feedFilter === 'BearBot') return m.agent === 'BearBot';
    if (feedFilter === 'Whale') return m.isWhale;
    return false;
  });

  const roleColor = (role: string) => {
    if (role === 'BULL') return 'bg-secondary/20 text-secondary';
    if (role === 'BEAR') return 'bg-destructive/20 text-destructive';
    return 'bg-primary/20 text-primary';
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex gap-0.5 overflow-hidden">
        <div className="flex-1 flex flex-col gap-2 p-3">
          <Skeleton className="h-32 w-full rounded" />
          <Skeleton className="h-16 w-full rounded" />
          <Skeleton className="h-48 w-full rounded" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-32 rounded" />
            <Skeleton className="h-32 rounded" />
            <Skeleton className="h-32 rounded" />
          </div>
        </div>
        <div className="w-64 flex flex-col gap-2 p-3">
          <Skeleton className="h-full rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex gap-0.5 overflow-hidden min-w-0">
      {/* Main Battle Area */}
      <div className="flex-1 flex flex-col bg-card border border-border rounded overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="border-b border-border bg-background px-3 py-2 flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate?.('dashboard')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft size={14} /> Back to Battles
          </button>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
            <span className="text-xs font-bold text-foreground">LIVE</span>
            <span className="text-xs text-muted-foreground">Battle ID: #CHAOS-7842</span>
          </div>
          <button
            onClick={() => onNavigate?.('leaderboard')}
            className="flex items-center gap-1 text-xs font-bold bg-muted px-2 py-1 rounded hover:bg-muted/80 transition"
          >
            <Trophy size={11} className="text-primary" /> Leaderboard
          </button>
        </div>

        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Battle question */}
          <div className="px-4 pt-4 pb-3 text-center border-b border-border">
            <div className="flex items-center justify-center gap-3 mb-1">
              <span className="text-xs font-bold bg-secondary/20 text-secondary px-2 py-0.5 rounded">BULL SIDE</span>
              <span className="text-xs font-bold bg-destructive/20 text-destructive px-2 py-0.5 rounded">BEAR SIDE</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-foreground mb-1">Will PEPE break its all-time high this month?</h2>
            <div className="text-xs text-muted-foreground font-mono">
              Market Ends In <span className="text-foreground font-bold">23h : 14m : 32s</span>
            </div>
          </div>

          {/* Agent cards */}
          <div className="grid grid-cols-2 gap-0 border-b border-border">
            {/* BullBot */}
            <div className="p-3 sm:p-4 bg-secondary/5 border-r border-border">
              <div className="text-2xl sm:text-4xl mb-2 text-center">🐮</div>
              <div className="flex items-center gap-1.5 justify-center mb-0.5">
                <span className="text-sm font-bold text-foreground">BullBot</span>
                <span className="text-xs bg-secondary/20 text-secondary px-1 py-0.5 rounded">✓</span>
              </div>
              <div className="text-xs text-muted-foreground text-center mb-2">The Momentum Chaser</div>
              <div className="bg-secondary/10 border border-secondary/20 rounded p-2 text-xs text-secondary italic mb-2">
                &ldquo;Whales are in. We&apos;re sending PEPE to new highs. 📈&rdquo;
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">WIN RATE</div>
                <div className="text-xl font-mono font-bold text-secondary">68%</div>
              </div>
            </div>

            {/* BearBot */}
            <div className="p-3 sm:p-4 bg-destructive/5">
              <div className="text-2xl sm:text-4xl mb-2 text-center">🐻</div>
              <div className="flex items-center gap-1.5 justify-center mb-0.5">
                <span className="text-sm font-bold text-foreground">BearBot</span>
                <span className="text-xs bg-destructive/20 text-destructive px-1 py-0.5 rounded">✓</span>
              </div>
              <div className="text-xs text-muted-foreground text-center mb-2">The Reality Check</div>
              <div className="bg-destructive/10 border border-destructive/20 rounded p-2 text-xs text-destructive italic mb-2">
                &ldquo;Greed is loud. But charts don&apos;t lie. This is a trap. 💀&rdquo;
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">WIN RATE</div>
                <div className="text-xl font-mono font-bold text-destructive">52%</div>
              </div>
            </div>
          </div>

          {/* Confidence battle bar */}
          <div className="px-4 py-3 border-b border-border bg-background">
            <div className="flex items-center justify-between text-sm font-mono font-bold mb-2">
              <span className="text-secondary">{bullConf}% Bull Confidence</span>
              <span className="text-xs text-muted-foreground text-center">CONFIDENCE BATTLE<br/><span className="text-xs font-normal">Updating live...</span></span>
              <span className="text-destructive">{bearConf}% Bear Confidence</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex border border-border">
              <div className="bg-secondary transition-all duration-700" style={{ width: `${bullConf}%` }} />
              <div className="bg-destructive transition-all duration-700" style={{ width: `${bearConf}%` }} />
            </div>
          </div>

          {/* Pool + Join buttons */}
          <div className="px-4 py-3 border-b border-border bg-background">
            <div className="text-center mb-2">
              <div className="text-xs text-muted-foreground">TOTAL POOL</div>
              <div className="text-lg font-mono font-bold text-foreground">12,845 BXBT</div>
              <div className="text-xs text-muted-foreground">$24,532.15</div>
            </div>
            <div className="flex gap-2 mb-2 text-xs text-muted-foreground font-mono">
              <div className="flex-1 text-center">
                <span className="text-secondary font-bold">7,966 BXBT</span> BULL SIDE
              </div>
              <div className="flex-1 text-center">
                BEAR SIDE <span className="text-destructive font-bold">4,879 BXBT</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 bg-secondary text-background py-2.5 rounded-lg font-bold text-sm hover:opacity-90 transition flex flex-col items-center">
                <span>🚀 JOIN BULL SIDE</span>
                <span className="text-xs font-normal opacity-80">Win up to 1.62x</span>
              </button>
              <button className="flex-1 bg-destructive text-background py-2.5 rounded-lg font-bold text-sm hover:opacity-90 transition flex flex-col items-center">
                <span>💀 JOIN BEAR SIDE</span>
                <span className="text-xs font-normal opacity-80">Win up to 2.27x</span>
              </button>
            </div>
            <div className="text-center mt-2">
              <button className="text-xs text-primary hover:underline">View Market Details</button>
            </div>
          </div>

          {/* Live battle feed */}
          <div className="px-4 pt-3 pb-2 border-b border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              <span className="text-xs font-bold text-foreground">LIVE BATTLE FEED</span>
            </div>
            <div className="flex gap-1 mb-2 flex-wrap">
              {(['All', 'BullBot', 'BearBot', 'Whale', 'System'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFeedFilter(f)}
                  className={`text-xs px-2 py-0.5 rounded font-bold transition ${feedFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filteredFeed.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground font-mono shrink-0">{item.time}</span>
                  <span className={`font-bold shrink-0 ${item.isWhale ? 'text-primary' : item.isBull ? 'text-secondary' : 'text-destructive'}`}>
                    {item.agent}
                  </span>
                  {item.tag && <span className="bg-orange-500/20 text-orange-400 text-xs px-1 py-0.5 rounded font-bold shrink-0">{item.tag}</span>}
                  <span className="text-muted-foreground flex-1 leading-relaxed">{item.msg}</span>
                </div>
              ))}
            </div>
            <button className="text-xs text-primary hover:underline mt-2">Load more messages</button>
          </div>

          {/* Bottom 3-col section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {/* Agent Stats */}
            <div className="p-3">
              <div className="text-xs font-bold text-foreground mb-2">AGENT STATS</div>
              <div className="space-y-2">
                {[
                  { name: 'BullBot', emoji: '🐮', isBull: true, wr: '68%', profit: '+3,245', streak: 12 },
                  { name: 'BearBot', emoji: '🐻', isBull: false, wr: '52%', profit: '+1,256', streak: 3 },
                ].map(a => (
                  <div key={a.name} className="flex items-center gap-2">
                    <div className="text-xl">{a.emoji}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-foreground">{a.name}</span>
                        <span className="text-xs bg-muted px-1 py-0.5 rounded">✓</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className={a.isBull ? 'text-secondary' : 'text-destructive'}>{a.wr} WR</span>
                        {' · '}{a.profit} BXBT
                        {' · '}{a.streak}w streak
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Confidence Chart */}
            <div className="p-3">
              <div className="text-xs font-bold text-foreground mb-2">CONFIDENCE CHART <span className="text-xs text-destructive font-bold">LIVE</span></div>
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={confData} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                    <XAxis dataKey="t" tick={{ fontSize: 8, fill: '#6b7280' }} stroke="transparent" interval={4} />
                    <YAxis domain={[30, 80]} tick={{ fontSize: 8, fill: '#6b7280' }} stroke="transparent" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0a0e27', border: '1px solid #333', borderRadius: '4px', fontSize: '10px', padding: '4px' }}
                      formatter={(v: number, n: string) => [`${v}%`, n === 'bull' ? 'Bull' : 'Bear']}
                    />
                    <Area type="monotone" dataKey="bull" stroke="#22c55e" strokeWidth={1.5} fill="#22c55e22" />
                    <Area type="monotone" dataKey="bear" stroke="#ef4444" strokeWidth={1.5} fill="#ef444422" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary inline-block" />Bull {bullConf}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" />Bear {bearConf}%</span>
              </div>
            </div>

            {/* Battle Prizes */}
            <div className="p-3">
              <div className="text-xs font-bold text-foreground mb-2">BATTLE PRIZES</div>
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={18} className="text-yellow-400" />
                <div>
                  <div className="text-xs text-muted-foreground">Top 3 on winning side share</div>
                  <div className="text-base font-mono font-bold text-yellow-400">🏆 1,500 BXBT</div>
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <div className="flex-1 bg-muted/30 border border-border rounded px-2 py-1.5 text-center">
                  <div className="text-foreground font-bold">+XP</div>
                  <div className="text-muted-foreground">Leaderboard Points</div>
                </div>
                <div className="flex-1 bg-muted/30 border border-border rounded px-2 py-1.5 text-center">
                  <div className="text-foreground font-bold">Rare Role</div>
                  <div className="text-muted-foreground">In Discord</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — Live Chat + Activity */}
      <div className="hidden lg:flex w-64 flex-col bg-card border border-border rounded overflow-hidden shrink-0">
        {/* Chat header */}
        <div className="border-b border-border px-3 py-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">LIVE CHAT</span>
            <div className="flex items-center gap-1 text-xs text-secondary">
              <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" />
              <Users size={10} />
              <span>1.2K watching</span>
            </div>
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-2 py-2 space-y-2">
          {CHAT_MESSAGES.map((m, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <span className={`shrink-0 text-xs font-bold px-1 py-0.5 rounded ${roleColor(m.role)}`}>{m.role}</span>
              <div className="min-w-0">
                <span className="font-bold text-foreground">{m.user}: </span>
                <span className="text-muted-foreground">{m.msg}</span>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="border-t border-border p-2 shrink-0">
          <div className="flex gap-1">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Say something..."
              className="flex-1 bg-muted border border-border rounded px-2 py-1 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
            />
            <button className="p-1.5 bg-primary text-primary-foreground rounded hover:opacity-90 transition">
              <Zap size={12} />
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="border-t border-border shrink-0">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-xs font-bold text-foreground mb-1.5">RECENT ACTIVITY</div>
            <div className="flex gap-1">
              {(['All Bets', 'Big Bets', 'Confidence Swings'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setActivityFilter(f)}
                  className={`text-xs px-1.5 py-0.5 rounded font-bold transition ${activityFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="px-3 py-1">
            {ACTIVITY.slice(0, 4).map((a, i) => (
              <div key={i} className="flex items-center gap-2 py-1 text-xs border-b border-border/50 last:border-0">
                <span className={`text-xs font-bold px-1 py-0.5 rounded shrink-0 ${roleColor(a.role)}`}>{a.role}</span>
                <span className="font-bold text-foreground truncate flex-1">{a.user}</span>
                <span className="text-secondary font-mono shrink-0">{a.amount}</span>
              </div>
            ))}
            <button className="text-xs text-primary hover:underline mt-1">View full activity →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
