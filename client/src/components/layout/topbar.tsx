'use client'

import { Search, Bell, Crown, Menu, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { arenaAgentAvatar } from '@/lib/arenaAgentAvatars'
import { getBattleTimeRemainingSeconds } from '@/lib/bantahbro/battleTiming'
import { useTheme } from '@/lib/theme-provider'
import { useState, useRef, useEffect } from 'react'
import MobileDrawer from './mobile-drawer'
import type { AppSection, BantahTool } from '@/app/page'
import type { AgentBattle, AgentBattleFeed } from '@/types/agentBattle'
import type { BattleArenaStatus, BattleExperienceMode } from '@/components/bantahbro/FightingGameArenaEmbed'

interface TopBarProps {
  onNavigate?: (section: AppSection) => void
  onOpenBattle?: (battleId: string) => void
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

type FighterStripAccent = 'blue' | 'purple' | 'green' | 'amber' | 'rose' | 'cyan'

type FighterStripCard = {
  id: string
  sourceBattleId?: string
  mode: BattleExperienceMode
  slotLabel: string
  status: BattleArenaStatus
  statusLabel: string
  startsInSeconds?: number
  leftName: string
  rightName: string
  leftTag: string
  rightTag: string
  leftAvatar: string
  rightAvatar: string
  meta: string
  arena: string
  accent: FighterStripAccent
}

function stripAgentAvatar(seed: string) {
  return arenaAgentAvatar(seed)
}

const MOCK_FIGHTER_STRIP_CARDS: FighterStripCard[] = [
  {
    id: 'mock-frostline',
    mode: 'arena',
    slotLabel: 'Next 1',
    status: 'queued',
    statusLabel: 'Queue',
    startsInSeconds: 30,
    leftName: 'ChaosAgent_88',
    rightName: 'GuardianPrime',
    leftTag: 'Berserker',
    rightTag: 'Sentinel',
    leftAvatar: stripAgentAvatar('mock-frostline:left'),
    rightAvatar: stripAgentAvatar('mock-frostline:right'),
    meta: '00:30',
    arena: 'Frostline',
    accent: 'purple',
  },
  {
    id: 'mock-glacier',
    mode: 'arena',
    slotLabel: 'Next 2',
    status: 'queued',
    statusLabel: 'Queue',
    startsInSeconds: 60,
    leftName: 'ArenaKing',
    rightName: 'SignalRider',
    leftTag: 'Champion',
    rightTag: 'Counter',
    leftAvatar: stripAgentAvatar('mock-glacier:left'),
    rightAvatar: stripAgentAvatar('mock-glacier:right'),
    meta: '01:00',
    arena: 'Glacier Ring',
    accent: 'cyan',
  },
  {
    id: 'mock-crown',
    mode: 'arena',
    slotLabel: 'Next 3',
    status: 'rematch',
    statusLabel: 'Rematch',
    leftName: 'VaultRunner',
    rightName: 'OraclePrime',
    leftTag: 'Runner',
    rightTag: 'Oracle',
    leftAvatar: stripAgentAvatar('mock-crown:left'),
    rightAvatar: stripAgentAvatar('mock-crown:right'),
    meta: 'Best of 3',
    arena: 'Crown Court',
    accent: 'amber',
  },
  {
    id: 'mock-nova',
    mode: 'arena',
    slotLabel: 'Next 4',
    status: 'cancelled',
    statusLabel: 'Cancelled',
    leftName: 'RiskBreaker',
    rightName: 'AlphaGuard',
    leftTag: 'Rush',
    rightTag: 'Guard',
    leftAvatar: stripAgentAvatar('mock-nova:left'),
    rightAvatar: stripAgentAvatar('mock-nova:right'),
    meta: 'Round 1',
    arena: 'Nova Ice',
    accent: 'green',
  },
  {
    id: 'mock-apex',
    mode: 'arena',
    slotLabel: 'Next 5',
    status: 'queued',
    statusLabel: 'Queue',
    startsInSeconds: 120,
    leftName: 'MomentumMax',
    rightName: 'TacticNode',
    leftTag: 'Momentum',
    rightTag: 'Tactics',
    leftAvatar: stripAgentAvatar('mock-apex:left'),
    rightAvatar: stripAgentAvatar('mock-apex:right'),
    meta: 'Warm-up',
    arena: 'Apex Arena',
    accent: 'rose',
  },
]

function fighterStripTone(accent: FighterStripAccent) {
  switch (accent) {
    case 'purple':
      return 'border-violet-400/35 bg-violet-500/10 text-violet-200'
    case 'green':
      return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
    case 'amber':
      return 'border-amber-400/35 bg-amber-500/10 text-amber-200'
    case 'rose':
      return 'border-rose-400/35 bg-rose-500/10 text-rose-200'
    case 'cyan':
      return 'border-cyan-400/35 bg-cyan-500/10 text-cyan-200'
    default:
      return 'border-sky-400/35 bg-sky-500/10 text-sky-200'
  }
}

function avatarStripTone(accent: FighterStripAccent) {
  switch (accent) {
    case 'purple':
      return 'border-violet-300 bg-violet-500/20'
    case 'green':
      return 'border-emerald-300 bg-emerald-500/20'
    case 'amber':
      return 'border-amber-300 bg-amber-500/20'
    case 'rose':
      return 'border-rose-300 bg-rose-500/20'
    case 'cyan':
      return 'border-cyan-300 bg-cyan-500/20'
    default:
      return 'border-sky-300 bg-sky-500/20'
  }
}

function stripSideName(side: AgentBattle['sides'][number] | undefined, fallback: string) {
  return side?.agentName || side?.tokenName || side?.label || fallback
}

function stripSideTag(side: AgentBattle['sides'][number] | undefined, fallback: string) {
  return side?.label || side?.tokenSymbol || side?.chainLabel || fallback
}

function stripSideAvatar(side: AgentBattle['sides'][number] | undefined, fallbackSeed: string) {
  return stripAgentAvatar(side ? `${side.agentName}:${side.id}` : fallbackSeed)
}

function buildCurrentFighterStripCard(battle: AgentBattle | undefined): FighterStripCard {
  const timeRemainingSeconds = battle
    ? getBattleTimeRemainingSeconds(battle.endsAt, battle.timeRemainingSeconds)
    : 0
  const left = battle?.sides?.[0]
  const right = battle?.sides?.[1]

  return {
    id: battle?.id || 'current-fighter-battle',
    sourceBattleId: battle?.id,
    mode: 'arena',
    slotLabel: 'Current',
    status: 'live',
    statusLabel: battle ? 'Live' : 'Live',
    leftName: stripSideName(left, 'BOTA Agent Alpha'),
    rightName: stripSideName(right, 'BOTA Agent Beta'),
    leftTag: stripSideTag(left, 'Alpha'),
    rightTag: stripSideTag(right, 'Beta'),
    leftAvatar: stripSideAvatar(left, 'current-fighter-battle:left'),
    rightAvatar: stripSideAvatar(right, 'current-fighter-battle:right'),
    meta: battle ? formatBattleDuration(timeRemainingSeconds) : 'Open',
    arena: 'Main Arena',
    accent: 'blue',
  }
}

const ARENA_PREVIEW_EVENT = 'bantahbro:arena-preview-change'
const ARENA_PREVIEW_PARAMS = [
  'battleLayer',
  'arenaState',
  'arenaStartsAt',
  'arenaMatchup',
  'arenaLabel',
  'arenaPreviewId',
]

function updateArenaPreviewParams(card: FighterStripCard) {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  params.set('section', 'battles')
  params.delete('battle')
  params.set('battleLayer', card.mode)
  params.set('arenaState', card.status)
  params.set('arenaPreviewId', card.id)
  params.set('arenaMatchup', `${card.leftName} VS ${card.rightName}`)
  params.set('arenaLabel', card.arena)

  if (card.status === 'queued' && card.startsInSeconds) {
    params.set('arenaStartsAt', String(Date.now() + card.startsInSeconds * 1000))
  } else {
    params.delete('arenaStartsAt')
  }

  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
  window.dispatchEvent(new Event(ARENA_PREVIEW_EVENT))
}

function clearArenaPreviewParams() {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams(window.location.search)
  ARENA_PREVIEW_PARAMS.forEach((param) => params.delete(param))
  params.set('battleLayer', 'arena')
  const queryString = params.toString()
  window.history.replaceState({}, '', `${window.location.pathname}${queryString ? `?${queryString}` : ''}`)
  window.dispatchEvent(new Event(ARENA_PREVIEW_EVENT))
}

const SEARCH_DATA: SearchItem[] = [
  { emoji: '₿', name: 'BTC', type: 'Token', section: 'challenge' },
  { emoji: '◆', name: 'ETH', type: 'Token', section: 'challenge' },
  { emoji: '◎', name: 'SOL', type: 'Token', section: 'challenge' },
  { emoji: '⚪', name: 'BASE', type: 'Ecosystem', section: 'challenge' },
  { emoji: 'S', name: 'TAO', type: 'Token', section: 'challenge' },
  { emoji: '🤖', name: 'Agents', type: 'Page', section: 'agents' },
  { emoji: '🤖', name: 'BullBot', type: 'Agent', section: 'battles' },
  { emoji: '🎭', name: 'ChaosBot', type: 'Agent', section: 'battles' },
  { emoji: 'B', name: 'BOTA', type: 'Agent', section: 'battles' },
  { emoji: '📊', name: 'Challenge', type: 'Page', section: 'challenge' },
  { emoji: '🏆', name: 'Leaderboard', type: 'Page', section: 'leaderboard' },
  { emoji: '🛡️', name: 'Rug Scorer', type: 'Page', section: 'rug-scorer' },
  { emoji: '🚀', name: 'Launcher', type: 'Page', section: 'launcher' },
  { emoji: '📡', name: 'Signals', type: 'Page', section: 'challenge' },
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

export default function TopBar({ onNavigate, onOpenBattle, activeSection, activeTool, onToolSelect }: TopBarProps) {
  const { theme, toggleTheme } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
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
  const battleStripBattles = (battleStripFeed?.battles || []).filter(
    (battle) => getBattleTimeRemainingSeconds(battle.endsAt, battle.timeRemainingSeconds) > 0,
  )
  const fighterStripCards = [
    buildCurrentFighterStripCard(battleStripBattles[0]),
    ...MOCK_FIGHTER_STRIP_CARDS,
  ]
  const fighterStripSlides = [...fighterStripCards, ...fighterStripCards]
  const isBattlesPage = activeSection === 'battles'

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
        {!isBattlesPage && (
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
              <img src="/bantahbrologo.png" alt="BOTA" width={20} height={20} className="rounded-full object-cover" />
              <span>BOTA</span>
              <span className="text-muted-foreground">▼</span>
            </button>
          </div>
        </div>
        )}

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
          <div className={`hidden sm:block overflow-hidden border-border bg-background/50 px-2 py-1.5 ${isBattlesPage ? '' : 'border-t'}`}>
            {fighterStripSlides.length > 0 && (
              <div className="bb-battle-strip-track flex w-max items-center gap-2">
                {fighterStripSlides.map((battle, displayIndex) => {
                  const tone = fighterStripTone(battle.accent)
                  const avatarTone = avatarStripTone(battle.accent)
                  return (
                    <button
                      key={`${battle.id}-${displayIndex}`}
                      onClick={() => {
                        if (battle.sourceBattleId) {
                          clearArenaPreviewParams()
                          onOpenBattle?.(battle.sourceBattleId) ?? onNavigate?.('battles')
                          window.setTimeout(() => {
                            window.dispatchEvent(new Event(ARENA_PREVIEW_EVENT))
                          }, 0)
                        } else {
                          updateArenaPreviewParams(battle)
                          onNavigate?.('battles')
                        }
                      }}
                      title={`${battle.leftName} vs ${battle.rightName} - ${battle.arena}`}
                      className={`relative inline-flex min-h-11 min-w-max shrink-0 items-center gap-2 whitespace-nowrap rounded border px-2.5 py-1.5 pr-10 text-left text-sm transition hover:bg-sidebar-accent ${tone}`}
                    >
                      <span className="absolute right-1 top-1 rounded bg-destructive px-1.5 py-0.5 text-[9px] font-black uppercase leading-none text-white shadow-sm">
                        {battle.statusLabel}
                      </span>
                      <span className="mr-1 shrink-0 text-[10px] font-black uppercase tracking-wide text-foreground/80">
                        {battle.slotLabel}
                      </span>
                      <span className="shrink-0 rounded border border-sky-300/35 bg-sky-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-sky-100">
                        Arena
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5">
                        <span className={`h-8 w-8 shrink-0 overflow-hidden rounded-md border-2 p-0.5 ${avatarTone}`}>
                          <img
                            src={battle.leftAvatar}
                            alt=""
                            className="h-full w-full rounded object-cover"
                            loading="lazy"
                          />
                        </span>
                        <span className="grid leading-tight">
                          <span className="text-xs font-black text-foreground">{battle.leftName}</span>
                          <span className="text-[9px] font-bold uppercase text-muted-foreground">{battle.leftTag}</span>
                        </span>
                      </span>
                      <span className="shrink-0 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-black text-muted-foreground">VS</span>
                      <span className="inline-flex shrink-0 items-center gap-1.5">
                        <span className={`h-8 w-8 shrink-0 overflow-hidden rounded-md border-2 p-0.5 ${avatarTone}`}>
                          <img
                            src={battle.rightAvatar}
                            alt=""
                            className="h-full w-full rounded object-cover"
                            loading="lazy"
                          />
                        </span>
                        <span className="grid leading-tight">
                          <span className="text-xs font-black text-foreground">{battle.rightName}</span>
                          <span className="text-[9px] font-bold uppercase text-muted-foreground">{battle.rightTag}</span>
                        </span>
                      </span>
                      <span className="shrink-0 rounded bg-background/70 px-1.5 py-0.5 font-mono text-xs text-foreground">
                        {battle.meta}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {battle.arena}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
