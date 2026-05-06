'use client'

import { Search, Bell, Crown, Menu, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@/lib/theme-provider'
import { useState, useRef, useEffect } from 'react'
import MobileDrawer from './mobile-drawer'
import type { AppSection, BantahTool } from '@/app/page'

interface TopBarProps {
  onNavigate?: (section: AppSection) => void
  activeSection?: AppSection
  activeTool?: BantahTool
  onToolSelect?: (tool: BantahTool) => void
}

type SearchItem = {
  emoji: string
  name: string
  type: string
  section: AppSection
  tool?: BantahTool
}

type HotTickerEntry = {
  id: string
  emoji: string
  displaySymbol: string
  actualSymbol: string | null
  tokenName: string | null
  change: string
  direction: 'up' | 'down' | 'flat'
  priceChangeH24: number
  priceUsd: number | null
  priceDisplay: string
  chainId: string | null
  chainLabel: string | null
  marketCap: number | null
  liquidityUsd: number | null
  volumeH24: number | null
  tokenAddress: string | null
  pairUrl: string | null
  source: 'dexscreener'
  status: 'live'
  holderEnriched: boolean
  replacedQuery: string | null
  reason: string | null
}

type HotTickerResponse = {
  entries: HotTickerEntry[]
  updatedAt: string
  sources: {
    dexscreener: {
      available: boolean
      active: boolean
      count: number
      message?: string
    }
    moralis: {
      available: boolean
      active: boolean
      count: number
      message?: string
    }
  }
}

type BantCreditStatsResponse = {
  token: 'BantCredit'
  lifetimeEarned: number
  currentAggregate: number
  currentUserPoints: number
  currentAgentPoints: number
  earnedFromTransactions: number
  userCount: number
  agentCount: number
  rewardTransactionCount: number
  basis: string
  updatedAt: string
}

type PriceFlashState = 'up' | 'down' | 'refresh'

const BXBT_CHART_EMBED_URL =
  'https://www.geckoterminal.com/solana/pools/FR9LUaxCwMhWF95QyScdvPbhDrApyFtomXDA38gsuqjE?embed=1&info=1&swaps=1&grayscale=1&light_chart=0&chart_type=price&resolution=30s'

function formatCompact(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '...'
  return new Intl.NumberFormat('en', {
    notation: value >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 100_000 ? 1 : 0,
  }).format(value)
}

const SEARCH_DATA: SearchItem[] = [
  { emoji: '🐸', name: 'PEPEFUN', type: 'Token', section: 'dashboard' },
  { emoji: '₿', name: 'BTC', type: 'Token', section: 'dashboard' },
  { emoji: '◆', name: 'ETH', type: 'Token', section: 'dashboard' },
  { emoji: '◎', name: 'SOL', type: 'Token', section: 'dashboard' },
  { emoji: '⚪', name: 'BASE', type: 'Ecosystem', section: 'dashboard' },
  { emoji: 'S', name: 'TAO', type: 'Token', section: 'dashboard' },
  { emoji: '🤖', name: 'Agents', type: 'Page', section: 'agents' },
  { emoji: '🤖', name: 'BullBot', type: 'Agent', section: 'battles' },
  { emoji: '🎭', name: 'ChaosBot', type: 'Agent', section: 'battles' },
  { emoji: '😊', name: 'BantahBro', type: 'Agent', section: 'battles' },
  { emoji: '📊', name: 'Markets', type: 'Page', section: 'dashboard' },
  { emoji: '🏆', name: 'Leaderboard', type: 'Page', section: 'leaderboard' },
  { emoji: '🛡️', name: 'Rug Scorer', type: 'Page', section: 'rug-scorer' },
  { emoji: '🚀', name: 'Launcher', type: 'Page', section: 'launcher' },
  { emoji: '📡', name: 'Signals', type: 'Page', section: 'dashboard' },
  { emoji: '🧠', name: 'Analyze Token', type: 'Tool', section: 'chat', tool: 'analyze' },
  { emoji: '📈', name: 'Runner Score', type: 'Tool', section: 'chat', tool: 'runner' },
  { emoji: '🔔', name: 'Live Alerts', type: 'Tool', section: 'chat', tool: 'alerts' },
  { emoji: '📊', name: 'Live Markets', type: 'Tool', section: 'chat', tool: 'markets' },
  { emoji: 'AD', name: 'Advertise', type: 'Page', section: 'ads' },
  { emoji: 'AD', name: 'Ads Placement', type: 'Page', section: 'ads' },
]

export default function TopBar({ onNavigate, activeSection, activeTool, onToolSelect }: TopBarProps) {
  const { theme, toggleTheme } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [chartOpen, setChartOpen] = useState(false)
  const [priceFlashes, setPriceFlashes] = useState<Record<string, PriceFlashState>>({})
  const searchRef = useRef<HTMLDivElement>(null)
  const previousPricesRef = useRef<Record<string, number | null>>({})
  const { data: bantCreditStats, isLoading: bantCreditStatsLoading } = useQuery<BantCreditStatsResponse>({
    queryKey: ['/api/bantahbro/stats/bantcredit'],
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const { data: hotTickerFeed, isLoading: hotTickersLoading } = useQuery<HotTickerResponse>({
    queryKey: ['/api/bantahbro/hot-tickers', { limit: '5' }],
    enabled: activeSection !== 'chat',
    staleTime: 5_000,
    refetchInterval: 5_000,
  })

  const searchResults = searchQuery.trim()
    ? SEARCH_DATA.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.type.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 6)
    : []
  const hotMarkets = hotTickerFeed?.entries || []

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (activeSection === 'chat' || !hotTickerFeed?.entries?.length) return

    const nextPrices: Record<string, number | null> = {}
    const nextFlashes: Record<string, PriceFlashState> = {}
    const previousPrices = previousPricesRef.current

    hotTickerFeed.entries.forEach((entry) => {
      const currentPrice = typeof entry.priceUsd === 'number' && Number.isFinite(entry.priceUsd) ? entry.priceUsd : null
      const previousPrice = previousPrices[entry.id]
      nextPrices[entry.id] = currentPrice

      if (previousPrice === undefined || previousPrice === null || currentPrice === null) {
        nextFlashes[entry.id] = 'refresh'
      } else if (currentPrice > previousPrice) {
        nextFlashes[entry.id] = 'up'
      } else if (currentPrice < previousPrice) {
        nextFlashes[entry.id] = 'down'
      } else {
        nextFlashes[entry.id] = 'refresh'
      }
    })

    previousPricesRef.current = nextPrices
    setPriceFlashes(nextFlashes)

    const timer = window.setTimeout(() => setPriceFlashes({}), 900)
    return () => window.clearTimeout(timer)
  }, [activeSection, hotTickerFeed?.updatedAt])

  const priceFlashClass = (flash?: PriceFlashState) => {
    if (flash === 'up') return 'animate-pulse bg-green-500/15 text-green-300 ring-1 ring-green-400/40'
    if (flash === 'down') return 'animate-pulse bg-red-500/15 text-red-300 ring-1 ring-red-400/40'
    if (flash === 'refresh') return 'animate-pulse bg-primary/15 text-primary ring-1 ring-primary/30'
    return 'text-foreground'
  }

  const handleSearchSelect = (item: SearchItem) => {
    if (item.tool) {
      onToolSelect?.(item.tool)
    }
    onNavigate?.(item.section)
    setSearchQuery('')
    setSearchFocused(false)
  }

  return (
    <>
      <MobileDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeSection={activeSection}
        activeTool={activeTool}
        onNavigate={onNavigate}
        onToolSelect={onToolSelect}
      />
      <div className="border-b border-border bg-card">
        <div className="flex items-center justify-between px-2 py-1.5 gap-2">
          <button onClick={() => setDrawerOpen(true)} className="md:hidden p-1.5 hover:bg-sidebar-accent rounded transition">
            <Menu size={20} />
          </button>

          <div ref={searchRef} className="flex-1 relative">
            <div className="flex items-center bg-input rounded px-3 py-1.5">
              <Search size={16} className="text-muted-foreground shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                placeholder="Search token, topic or market..."
                className="flex-1 bg-transparent text-sm outline-none pl-2 placeholder-muted-foreground"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground transition ml-1">
                  <X size={14} />
                </button>
              )}
              <span className="text-xs text-muted-foreground hidden sm:block ml-1">/</span>
            </div>

            {searchFocused && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-xl z-50 overflow-hidden">
                {searchResults.map((item) => (
                  <button
                    key={`${item.type}-${item.name}`}
                    onClick={() => handleSearchSelect(item)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition text-left"
                  >
                    <span className="text-base w-6 text-center">{item.emoji}</span>
                    <span className="text-sm font-bold text-foreground flex-1">{item.name}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.type}</span>
                  </button>
                ))}
              </div>
            )}

            {searchFocused && searchQuery && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-xl z-50 p-3 text-sm text-muted-foreground text-center">
                No results for &ldquo;{searchQuery}&rdquo;
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              title={bantCreditStats?.basis || 'Total BantCredit earned across Bantah ecosystem'}
              className="hidden md:flex text-sm px-3 py-1.5 bg-input rounded items-center gap-1.5 hover:bg-sidebar-accent transition"
            >
              <Crown size={15} className="text-primary" />
              <span>BantCredit earned</span>
              <span className="text-primary font-bold">
                {bantCreditStatsLoading ? '...' : formatCompact(bantCreditStats?.lifetimeEarned)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setChartOpen(true)}
              className="hidden sm:flex text-sm px-3 py-1.5 bg-input rounded items-center gap-1.5 hover:bg-sidebar-accent transition"
              title="Open BANTAH / SOL chart"
            >
              <img src="/bantahbrologo.png" alt="BantahBro" width={16} height={16} className="rounded-full object-cover" />
              <span>BXBT</span>
              <span className="text-primary font-bold">1,245.50</span>
            </button>
            <button className="p-1.5 hover:bg-sidebar-accent rounded transition hidden sm:flex">
              <Crown size={18} className="text-primary" />
            </button>
            <button onClick={() => onNavigate?.('notifications')} className="p-1.5 hover:bg-sidebar-accent rounded transition relative">
              <Bell size={18} />
              <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-destructive rounded-full"></span>
            </button>
            <button
              onClick={toggleTheme}
              className="p-1.5 hover:bg-sidebar-accent rounded transition"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <span className="text-xl">{theme === 'dark' ? '☀️' : '🌙'}</span>
            </button>
            <button
              onClick={() => onNavigate?.('profile')}
              className="hidden sm:flex items-center gap-1.5 text-sm px-2 py-1.5 hover:bg-sidebar-accent rounded transition"
            >
              <img src="/bantahbrologo.png" alt="BantahBro" width={20} height={20} className="rounded-full object-cover" />
              <span>BantahBro</span>
              <span className="text-muted-foreground">▼</span>
            </button>
          </div>
        </div>

        {activeSection !== 'chat' && (
        <div className="hidden sm:flex items-center gap-2 px-2 py-1.5 overflow-x-auto border-t border-border bg-background/50">
          {hotTickersLoading && hotMarkets.length === 0 && (
            <div className="flex items-center gap-1.5 bg-input px-3 py-1 rounded text-sm whitespace-nowrap text-muted-foreground">
              Loading live prices...
            </div>
          )}
          {hotMarkets.map((market) => (
            <button
              key={market.id}
              onClick={() => onNavigate?.('dashboard')}
              title={
                `${market.displaySymbol} ${market.priceDisplay}${market.chainLabel ? ` on ${market.chainLabel}` : ''}${market.tokenName ? ` - ${market.tokenName}` : ''}${market.replacedQuery ? ` - Trending replacement for ${market.replacedQuery}` : ''}`
              }
              className="flex items-center gap-1.5 bg-input px-3 py-1 rounded text-sm hover:bg-sidebar-accent transition whitespace-nowrap"
            >
              <span className="text-lg">{market.emoji}</span>
              <span className="font-bold">{market.displaySymbol}</span>
              <span className={`font-mono rounded px-1 transition-colors duration-150 ${priceFlashClass(priceFlashes[market.id])}`}>
                {market.priceDisplay}
              </span>
              <span className={market.direction === 'up' ? 'text-green-400' : market.direction === 'down' ? 'text-red-400' : 'text-muted-foreground'}>
                {market.change}
              </span>
            </button>
          ))}
          <button onClick={() => onNavigate?.('dashboard')} className="text-sm text-primary hover:underline px-2">
            View all →
          </button>
        </div>
        )}
      </div>

      {chartOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center">
          <div className="w-full max-w-6xl h-[82vh] bg-card border border-border rounded overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-3 shrink-0">
              <img src="/bantahbrologo.png" alt="BantahBro" width={22} height={22} className="rounded-full object-cover" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground">BANTAH / SOL</div>
                <div className="text-xs text-muted-foreground">GeckoTerminal live chart</div>
              </div>
              <button
                type="button"
                onClick={() => setChartOpen(false)}
                className="ml-auto p-1.5 rounded hover:bg-sidebar-accent transition"
                aria-label="Close chart"
              >
                <X size={18} />
              </button>
            </div>
            <iframe
              height="100%"
              width="100%"
              id="geckoterminal-embed"
              title="Embed BANTAH / SOL"
              src={BXBT_CHART_EMBED_URL}
              frameBorder="0"
              allow="clipboard-write"
              allowFullScreen
              className="flex-1 bg-background"
            />
          </div>
        </div>
      )}
    </>
  )
}
