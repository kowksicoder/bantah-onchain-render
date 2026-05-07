'use client'

import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Megaphone,
  MessageSquare,
  Rocket,
  Search,
  Shield,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { AppSection, BantahTool } from '@/app/page'
import type { AgentBattleFeed } from '@/types/agentBattle'

interface SidebarProps {
  activeSection?: AppSection
  activeTool?: BantahTool
  onNavigate?: (section: AppSection) => void
  onToolSelect?: (tool: BantahTool) => void
  onClose?: () => void
}

const menuItems: { icon: typeof BarChart3; label: string; section: AppSection }[] = [
  { icon: BarChart3, label: 'Markets', section: 'dashboard' },
  { icon: Zap, label: 'Agent Battles', section: 'battles' },
  { icon: Bot, label: 'Agents', section: 'agents' },
  { icon: Trophy, label: 'Leaderboard', section: 'leaderboard' },
  { icon: Shield, label: 'Rug Scorer', section: 'rug-scorer' },
  { icon: Rocket, label: 'Launcher', section: 'launcher' },
  { icon: Megaphone, label: 'Advertise', section: 'ads' },
  { icon: MessageSquare, label: 'Chat Agent', section: 'chat' },
]

const toolItems: { icon: typeof Search; label: string; tool: BantahTool; helper: string }[] = [
  { icon: Search, label: 'Analyze Token', tool: 'analyze', helper: 'Quick contract read' },
  { icon: TrendingUp, label: 'Runner Score', tool: 'runner', helper: 'Momentum check' },
  { icon: Bell, label: 'Live Alerts', tool: 'alerts', helper: 'Whale + smart money' },
  { icon: BarChart3, label: 'Live Markets', tool: 'markets', helper: 'Open setups' },
  { icon: Activity, label: 'BXBT Status', tool: 'bxbt', helper: 'System health' },
  { icon: Rocket, label: 'Launch Token', tool: 'launcher', helper: 'Draft + deploy' },
]

const adPlacements = [
  { icon: 'AD', label: 'Hot Ticker Slot', meta: 'Top bar' },
  { icon: 'AD', label: 'Market Spotlight', meta: '24H feature' },
  { icon: 'AD', label: 'Battle Sponsor', meta: '2 slots left' },
  { icon: 'AD', label: 'Sidebar Feature', meta: 'Premium' },
  { icon: 'AD', label: 'Feed Boost', meta: 'Open now' },
]

export default function Sidebar({
  activeSection,
  activeTool,
  onNavigate,
  onToolSelect,
  onClose,
}: SidebarProps) {
  const { data: battleFeed } = useQuery<AgentBattleFeed>({
    queryKey: ['/api/bantahbro/agent-battles/live', { limit: '12' }],
    staleTime: 3_000,
    refetchInterval: 5_000,
  })
  const liveBattleCount = battleFeed?.battles?.length ?? 0

  const handleClick = (section: AppSection) => {
    onNavigate?.(section)
    onClose?.()
  }

  const handleToolClick = (tool: BantahTool) => {
    onToolSelect?.(tool)
    onNavigate?.('chat')
    onClose?.()
  }

  return (
    <div className="w-52 bg-sidebar border-r border-border flex flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="p-2 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <img src="/bantahbrologo.png" alt="BantahBro" width={36} height={36} className="rounded-full object-cover" />
          <div>
            <div className="text-sm font-bold text-primary leading-tight">BantahBro</div>
            <div className="text-xs text-muted-foreground leading-tight">AI DEGEN</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="py-1 px-0">
          <div className="text-xs font-bold text-muted-foreground px-3 py-1 mt-1 tracking-wider">MAIN</div>
          {menuItems.map((item) => {
            const isActive = activeSection === item.section && !(item.section === 'chat' && activeTool && activeTool !== 'assistant')

            return (
              <button
                key={item.label}
                onClick={() => {
                  if (item.section === 'chat') {
                    onToolSelect?.('assistant')
                  }
                  handleClick(item.section)
                }}
                className={`w-full text-left text-sm py-1.5 px-3 transition flex items-center gap-2 ${
                  isActive
                    ? 'bg-primary/20 text-primary font-bold border-r-2 border-primary'
                    : 'hover:bg-sidebar-accent hover:text-accent-foreground text-sidebar-foreground'
                }`}
              >
                <item.icon size={15} />
                <span className="flex-1">{item.label}</span>
                {item.section === 'battles' && (
                  <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
                    {liveBattleCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="py-1 px-0 border-t border-border">
          <div className="text-xs font-bold text-muted-foreground px-3 py-1 mt-1 tracking-wider">BANTAH TOOLS</div>
          <div className="px-3 pb-1 text-[11px] text-muted-foreground leading-tight">
            These open inside Chat Agent as tabs and tools, not separate pages.
          </div>
          {toolItems.map((item) => {
            const isActive = activeSection === 'chat' && activeTool === item.tool

            return (
              <button
                key={item.tool}
                onClick={() => handleToolClick(item.tool)}
                className={`w-full text-left text-sm py-1.5 px-3 transition flex items-start justify-between gap-2 ${
                  isActive
                    ? 'bg-primary/20 text-primary font-bold border-r-2 border-primary'
                    : 'hover:bg-sidebar-accent hover:text-accent-foreground text-sidebar-foreground'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <item.icon size={15} className="mt-0.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className={`shrink-0 text-[10px] ${isActive ? 'text-primary/80' : 'text-muted-foreground'}`}>
                  {item.helper}
                </span>
              </button>
            )
          })}
        </div>

        <div className="py-1 px-0 border-t border-border">
          <div className="text-xs font-bold text-muted-foreground px-3 py-1 mt-1 tracking-wider">ADS PLACEMENT</div>
          <div className="px-3 pb-1 text-[11px] text-muted-foreground leading-tight">
            For coin teams that want visibility across BantahBro.
          </div>
          {adPlacements.map((placement) => (
            <button
              key={placement.label}
              onClick={() => handleClick('ads')}
              className="w-full text-left text-sm py-1 px-3 hover:bg-sidebar-accent hover:text-accent-foreground transition flex items-center justify-between text-sidebar-foreground"
            >
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-primary border border-primary/30 rounded px-1 py-0.5">{placement.icon}</span>
                <span>{placement.label}</span>
              </span>
              <span className="text-muted-foreground text-xs">{placement.meta}</span>
            </button>
          ))}
          <button
            onClick={() => handleClick('ads')}
            className="w-full text-left text-sm py-1 px-3 text-primary hover:underline"
          >
            Advertise your coin
          </button>
        </div>
      </div>

      <div className="border-t border-border p-2 text-center">
        <div className="text-xs font-bold text-primary mb-1">SEE IT.</div>
        <div className="text-xs font-bold text-primary mb-1">CALL IT.</div>
        <div className="text-xs font-bold text-primary mb-2">BET IT.</div>
        <div className="text-xs text-muted-foreground mb-1">WIN BIG.</div>
        <div className="flex items-center justify-center gap-1.5">
          <img src="/bantahbrologo.png" alt="BantahBro" width={18} height={18} className="rounded-full object-cover" />
          <span className="text-xs font-bold text-primary">BantahBro</span>
        </div>
      </div>
    </div>
  )
}
