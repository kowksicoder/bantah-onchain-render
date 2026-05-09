'use client'

import { Search, Bell, Crown, Menu, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@/lib/theme-provider'
import { useState, useRef, useEffect } from 'react'
import MobileDrawer from './mobile-drawer'
import type { AppSection, BantahTool } from '@/app/page'
import type { AgentBattle, AgentBattleFeed } from '@/types/agentBattle'

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

const BXBT_CHART_EMBED_URL =
  'https://www.geckoterminal.com/solana/pools/FR9LUaxCwMhWF95QyScdvPbhDrApyFtomXDA38gsuqjE?embed=1&info=1&swaps=1&grayscale=1&light_chart=0&chart_type=price&resolution=30s'

function formatCompact(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '...'
  return new Intl.NumberFormat('en', {
    notation: value >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 100_000 ? 1 : 0,
  }).format(value)
}

function formatBattleDuration(totalSeconds?: number) {
  const safe = Math.max(0, Math.round(totalSeconds || 0))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function battleCardTone(battle: AgentBattle) {
  const [left, right] = battle.sides
  const leader = battle.leadingSideId === right.id ? right : left
  if (leader.direction === 'down') return 'border-red-500/30 bg-red-500/10 text-red-300'
  if (leader.direction === 'up') return 'border-green-500/30 bg-green-500/10 text-green-300'
  return 'border-primary/30 bg-primary/10 text-primary'
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
  { emoji: '👛', name: 'Wallet Ops', type: 'Tool', section: 'chat', tool: 'wallet' },
  { emoji: '🧭', name: 'Discover', type: 'Tool', section: 'chat', tool: 'discover' },
  { emoji: '⚔️', name: 'Battle Desk', type: 'Tool', section: 'chat', tool: 'battle' },
  { emoji: '🛡️', name: 'Rug Score', type: 'Tool', section: 'chat', tool: 'rug' },
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
  const searchRef = useRef<HTMLDivElement>(null)
  const { data: bantCreditStats, isLoading: bantCreditStatsLoading } = useQuery<BantCreditStatsResponse>({
    queryKey: ['/api/bantahbro/stats/bantcredit'],
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const { data: battleStripFeed, isLoading: battleStripLoading } = useQuery<AgentBattleFeed>({
    queryKey: ['/api/bantahbro/agent-battles/live', { limit: '12' }],
    staleTime: 3_000,
    refetchInterval: 15_000,
    retry: 3,
    retryDelay: 1_500,
    placeholderData: (previousData) => previousData,
  })

  const searchResults = searchQuery.trim()
    ? SEARCH_DATA.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.type.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 6)
    : []
  const battleStripBattles = battleStripFeed?.battles || []
  const battleStripSlides = battleStripBattles.length > 0 ? [...battleStripBattles, ...battleStripBattles] : []

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
              className="hidden md:flex p-1.5 hover:bg-sidebar-accent rounded transition"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <span className="text-xl">{theme === 'dark' ? '☀️' : '🌙'}</span>
            </button>
            <button
              onClick={() => onNavigate?.('profile')}
              className="bb-tap flex md:hidden h-8 w-8 items-center justify-center rounded-full bg-input ring-1 ring-border transition hover:bg-sidebar-accent"
              title="Open profile"
              aria-label="Open profile"
            >
              <img src="/bantahbrologo.png" alt="Profile" width={22} height={22} className="rounded-full object-cover" />
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

        <style>{`
          @keyframes bb-battle-strip-slide {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }

          .bb-battle-strip-track {
            animation: bb-battle-strip-slide 52s linear infinite;
          }

          .bb-battle-strip-track:hover {
            animation-play-state: paused;
          }

          @media (prefers-reduced-motion: reduce) {
            .bb-battle-strip-track {
              animation: none;
            }
          }
        `}</style>
        {true && (
          <div className="hidden sm:block overflow-hidden border-t border-border bg-background/50 px-2 py-1.5">
            {battleStripLoading && battleStripBattles.length === 0 && (
              <div className="flex items-center gap-1.5 bg-input px-3 py-1 rounded text-sm whitespace-nowrap text-muted-foreground">
                Loading live battles...
              </div>
            )}
            {battleStripSlides.length > 0 && (
              <div className="bb-battle-strip-track flex w-max items-center gap-2">
                {battleStripSlides.map((battle, displayIndex) => {
                  const index = displayIndex % battleStripBattles.length
                  const [left, right] = battle.sides
                  const leader = battle.leadingSideId === right.id ? right : left
                  const tone = battleCardTone(battle)
                  return (
                    <button
                      key={`${battle.id}-${displayIndex}`}
                      onClick={() => onNavigate?.('battles')}
                      title={`${battle.title} - ${leader.label} leads by ${battle.confidenceSpread}%`}
                      className={`relative inline-flex h-8 min-w-max shrink-0 items-center gap-2 whitespace-nowrap rounded border px-3 pr-7 text-left text-sm transition hover:bg-sidebar-accent ${tone}`}
                    >
                      {index < 3 && (
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-destructive px-1.5 py-0.5 text-[9px] font-black uppercase leading-none text-white shadow-sm">
                          Live
                        </span>
                      )}
                      <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-foreground/80">
                        {index === 0 ? 'Current' : `Next ${index}`}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 font-bold text-foreground">
                        {left.logoUrl ? (
                          <img
                            src={left.logoUrl}
                            alt=""
                            className="h-4 w-4 shrink-0 rounded-full object-cover"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <span>{left.emoji}</span>
                        )}
                        <span>{left.label}</span>
                      </span>
                      <span className="shrink-0 text-[10px] font-black text-muted-foreground">VS</span>
                      <span className="inline-flex shrink-0 items-center gap-1 font-bold text-foreground">
                        {right.logoUrl ? (
                          <img
                            src={right.logoUrl}
                            alt=""
                            className="h-4 w-4 shrink-0 rounded-full object-cover"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <span>{right.emoji}</span>
                        )}
                        <span>{right.label}</span>
                      </span>
                      <span className="shrink-0 rounded bg-background/70 px-1.5 py-0.5 font-mono text-xs text-foreground">
                        {index === 0 ? formatBattleDuration(battle.timeRemainingSeconds) : `${battle.confidenceSpread}% gap`}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {!battleStripLoading && battleStripBattles.length === 0 && (
              <div className="flex items-center gap-1.5 bg-input px-3 py-1 rounded text-sm whitespace-nowrap text-muted-foreground">
                Loading live battles...
              </div>
            )}
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
