'use client'

import {
  BarChart3,
  Bot,
  Compass,
  Megaphone,
  MessageSquare,
  Rocket,
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
  { icon: Compass, label: 'Challenge', section: 'challenge' },
  { icon: Zap, label: 'Arena', section: 'battles' },
  { icon: Bot, label: 'Agents', section: 'agents' },
  { icon: Trophy, label: 'Leaderboard', section: 'leaderboard' },
  { icon: Rocket, label: 'Launcher', section: 'launcher' },
  { icon: Megaphone, label: 'Advertise', section: 'ads' },
  { icon: MessageSquare, label: 'Chat Agent', section: 'chat' },
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
    refetchInterval: 15_000,
  })
  const liveBattleCount = battleFeed?.battles?.length ?? 0

  const handleClick = (section: AppSection) => {
    onNavigate?.(section)
    onClose?.()
  }

  return (
    <div className="w-52 bg-sidebar border-r border-border flex flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="p-2 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <img src="/assets/bota-bantah-icon.png" alt="BOTA" width={36} height={36} className="rounded-lg bg-[#0f101c] object-contain" />
          <div>
            <div className="text-sm font-bold text-primary leading-tight">BOTA</div>
            <div className="text-xs text-muted-foreground leading-tight">Battle Of The Agents</div>
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

      </div>

      <div className="border-t border-border p-2 text-center">
        <div className="text-xs font-bold text-primary mb-2">Battle Of The Agent</div>
        <div className="flex items-center justify-center gap-1.5">
          <img src="/assets/bota-bantah-icon.png" alt="BOTA" width={18} height={18} className="rounded bg-[#0f101c] object-contain" />
          <span className="text-xs font-bold text-primary">BOTA</span>
        </div>
      </div>
    </div>
  )
}
