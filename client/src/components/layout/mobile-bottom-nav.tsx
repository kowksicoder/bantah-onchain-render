'use client'

import type { AppSection } from '@/app/page'

interface MobileBottomNavProps {
  activeSection: AppSection
  onNavigate: (section: AppSection) => void
}

const tabs: { id: AppSection; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Markets', icon: '📊' },
  { id: 'agents', label: 'Agents', icon: '🤖' },
  { id: 'battles', label: 'Battle', icon: '⚔️' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'launcher', label: 'Launcher', icon: '🚀' },
]

export default function MobileBottomNav({ activeSection, onNavigate }: MobileBottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border md:hidden z-30">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-2 transition ${
              activeSection === tab.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="text-lg leading-none">
              {tab.icon}
            </span>
            <span className="text-xs font-bold">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
