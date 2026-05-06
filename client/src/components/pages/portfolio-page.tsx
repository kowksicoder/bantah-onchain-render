'use client'

import { useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface Position {
  id: string
  market: string
  emoji: string
  token: string
  choice: 'yes' | 'no'
  amount: string
  currentOdds: number
  entryOdds: number
  pnl: string
  pnlRaw: number
  status: 'active' | 'won' | 'lost' | 'pending'
  endsIn: string
}

const MOCK_POSITIONS: Position[] = [
  {
    id: '1',
    market: 'Will BTC break ATH in 30 days?',
    emoji: '₿',
    token: 'BTC',
    choice: 'yes',
    amount: '1,500 BXBT',
    currentOdds: 68,
    entryOdds: 64,
    pnl: '+94 BXBT',
    pnlRaw: 94,
    status: 'active',
    endsIn: '29d 5h',
  },
  {
    id: '2',
    market: 'Will PEPEFUN 2x in 24H?',
    emoji: '🐸',
    token: 'PEPEFUN',
    choice: 'yes',
    amount: '500 BXBT',
    currentOdds: 62,
    entryOdds: 58,
    pnl: '+34 BXBT',
    pnlRaw: 34,
    status: 'active',
    endsIn: '23h 14m',
  },
  {
    id: '3',
    market: 'Will ETH hit $5,000 in May?',
    emoji: '◆',
    token: 'ETH',
    choice: 'no',
    amount: '800 BXBT',
    currentOdds: 43,
    entryOdds: 47,
    pnl: '+33 BXBT',
    pnlRaw: 33,
    status: 'active',
    endsIn: '2d 11h',
  },
  {
    id: '4',
    market: 'Will SOL hit $200 in May?',
    emoji: '◎',
    token: 'SOL',
    choice: 'yes',
    amount: '1,000 BXBT',
    currentOdds: 55,
    entryOdds: 61,
    pnl: '-98 BXBT',
    pnlRaw: -98,
    status: 'active',
    endsIn: '8d 2h',
  },
  {
    id: '5',
    market: 'Will BTC break ATH by April?',
    emoji: '₿',
    token: 'BTC',
    choice: 'yes',
    amount: '2,000 BXBT',
    currentOdds: 100,
    entryOdds: 68,
    pnl: '+1,240 BXBT',
    pnlRaw: 1240,
    status: 'won',
    endsIn: 'Resolved',
  },
  {
    id: '6',
    market: 'Will DOGE hit $1 by March?',
    emoji: '🐕',
    token: 'DOGE',
    choice: 'yes',
    amount: '300 BXBT',
    currentOdds: 0,
    entryOdds: 42,
    pnl: '-300 BXBT',
    pnlRaw: -300,
    status: 'lost',
    endsIn: 'Resolved',
  },
]

const stats = [
  { label: 'Total Balance', value: '8,245 BXBT', icon: '💰', trend: null },
  { label: 'Active Positions', value: '4', icon: '📊', trend: null },
  { label: 'Total P&L', value: '+1,003 BXBT', icon: '📈', trend: 'up' },
  { label: 'Win Rate', value: '66.7%', icon: '🏆', trend: 'up' },
]

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')
  const [isLoading] = useState(false)

  const activePositions = MOCK_POSITIONS.filter((p) => p.status === 'active')
  const historyPositions = MOCK_POSITIONS.filter((p) => p.status !== 'active')

  const displayed = activeTab === 'active' ? activePositions : historyPositions

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="flex-1 flex flex-col bg-card border border-border rounded overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-background px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={18} className="text-primary" />
            <span className="font-bold text-foreground">Portfolio</span>
          </div>

          {/* Stats Row */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-muted/40 border border-border rounded p-2.5">
                  <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                    <span>{stat.icon}</span>
                    <span>{stat.label}</span>
                  </div>
                  <div className={`text-sm font-mono font-bold ${stat.trend === 'up' ? 'text-secondary' : 'text-foreground'}`}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-border bg-background flex">
          {(['active', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold capitalize transition border-b-2 ${
                activeTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'active' ? `⚡ Active (${activePositions.length})` : `📋 History (${historyPositions.length})`}
            </button>
          ))}
        </div>

        {/* Positions */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-border rounded p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-12 rounded" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-20 ml-auto" />
                  </div>
                  <Skeleton className="h-2 w-full rounded" />
                </div>
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
              <Wallet size={40} className="opacity-30" />
              <p className="text-sm">No {activeTab} positions</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {displayed.map((pos) => (
                <div
                  key={pos.id}
                  className={`border rounded p-3 transition hover:bg-muted/20 cursor-pointer ${
                    pos.status === 'won'
                      ? 'border-secondary/40 bg-secondary/5'
                      : pos.status === 'lost'
                      ? 'border-destructive/40 bg-destructive/5'
                      : 'border-border bg-background'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-lg">{pos.emoji}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">{pos.market}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            pos.choice === 'yes' ? 'bg-secondary/20 text-secondary' : 'bg-destructive/20 text-destructive'
                          }`}>
                            {pos.choice.toUpperCase()}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">{pos.amount}</span>
                          {pos.status !== 'active' && (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                              pos.status === 'won' ? 'bg-secondary/20 text-secondary' : 'bg-destructive/20 text-destructive'
                            }`}>
                              {pos.status.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-mono font-bold ${pos.pnlRaw >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                        {pos.pnl}
                      </div>
                      <div className="flex items-center gap-1 justify-end text-xs text-muted-foreground mt-0.5">
                        <Clock size={10} />
                        <span>{pos.endsIn}</span>
                      </div>
                    </div>
                  </div>

                  {pos.status === 'active' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Entry: {pos.entryOdds}%</span>
                        <span>Current: {pos.currentOdds}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded overflow-hidden">
                        <div
                          className={`h-full rounded transition-all ${pos.pnlRaw >= 0 ? 'bg-secondary' : 'bg-destructive'}`}
                          style={{ width: `${pos.currentOdds}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
