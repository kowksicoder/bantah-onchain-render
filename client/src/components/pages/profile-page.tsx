'use client'

import { useState } from 'react'
import { Settings, Copy, Check, TrendingUp, Trophy, Zap } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

const MOCK_ACTIVITY = [
  { id: '1', action: 'Placed bet', detail: 'YES on "Will BTC break ATH?" — 1,500 BXBT', time: '2h ago', type: 'bet' },
  { id: '2', action: 'Won market', detail: '"Will BTC break ATH by April?" — +1,240 BXBT', time: '1d ago', type: 'win' },
  { id: '3', action: 'Placed bet', detail: 'NO on "Will ETH hit $5K?" — 800 BXBT', time: '1d ago', type: 'bet' },
  { id: '4', action: 'Followed agent', detail: 'Now following BullBot AI', time: '2d ago', type: 'follow' },
  { id: '5', action: 'Lost market', detail: '"Will DOGE hit $1 by March?" — -300 BXBT', time: '3d ago', type: 'loss' },
]

const profileStats = [
  { label: 'Markets Joined', value: '34', icon: '📊' },
  { label: 'Win Rate', value: '66.7%', icon: '🏆' },
  { label: 'Total Profit', value: '+1,003 BXBT', icon: '💰' },
  { label: 'Longest Streak', value: '5 Wins', icon: '🔥' },
  { label: 'Rank', value: '#47', icon: '📈' },
  { label: 'Joined', value: 'Jan 2025', icon: '📅' },
]

export default function ProfilePage() {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'activity' | 'settings'>('activity')
  const [isLoading] = useState(false)

  const copyAddress = () => {
    navigator.clipboard.writeText('0xBantah...Bro')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const activityColor: Record<string, string> = {
    bet: 'text-primary',
    win: 'text-secondary',
    loss: 'text-destructive',
    follow: 'text-accent',
  }
  const activityIcon: Record<string, string> = {
    bet: '🎯',
    win: '🏆',
    loss: '💸',
    follow: '🤖',
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="flex-1 flex flex-col bg-card border border-border rounded overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-background px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-3xl shrink-0">
              😊
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-foreground">0xBantah...Bro</h2>
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded font-bold">DEGEN</span>
              </div>
              <button
                onClick={copyAddress}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition mt-0.5"
              >
                {copied ? <Check size={12} className="text-secondary" /> : <Copy size={12} />}
                <span className="font-mono">0xA1B2...C3D4</span>
              </button>
              <p className="text-xs text-muted-foreground mt-1">Crypto degen. Betting on the future. 🚀</p>
            </div>
            <button className="p-2 hover:bg-muted rounded transition shrink-0">
              <Settings size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* Stats Grid */}
          {isLoading ? (
            <div className="grid grid-cols-3 gap-2 mt-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mt-4">
              {profileStats.map((stat) => (
                <div key={stat.label} className="bg-muted/40 border border-border rounded p-2 text-center">
                  <div className="text-base mb-0.5">{stat.icon}</div>
                  <div className="text-sm font-mono font-bold text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-border bg-background flex">
          {(['activity', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold capitalize transition border-b-2 ${
                activeTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'activity' ? '⚡ Activity' : '⚙️ Settings'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'activity' ? (
            isLoading ? (
              <div className="p-3 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-2">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                    <Skeleton className="h-3 w-16 shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {MOCK_ACTIVITY.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm shrink-0">
                      {activityIcon[item.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold ${activityColor[item.type] ?? 'text-foreground'}`}>
                        {item.action}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.detail}</div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{item.time}</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="p-4 space-y-4">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground">Preferences</h3>
                {[
                  { label: 'Email Notifications', desc: 'Receive alerts via email', enabled: true },
                  { label: 'Push Notifications', desc: 'Browser push alerts', enabled: false },
                  { label: 'Agent Signals', desc: 'Get signals from followed agents', enabled: true },
                  { label: 'Market Reminders', desc: 'Remind me before markets close', enabled: true },
                ].map((setting) => (
                  <div key={setting.label} className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded">
                    <div>
                      <div className="text-sm font-bold text-foreground">{setting.label}</div>
                      <div className="text-xs text-muted-foreground">{setting.desc}</div>
                    </div>
                    <div className={`w-10 h-5 rounded-full transition relative cursor-pointer ${setting.enabled ? 'bg-primary' : 'bg-muted'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${setting.enabled ? 'left-5' : 'left-0.5'}`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-foreground">Danger Zone</h3>
                <button className="w-full text-xs font-bold text-destructive border border-destructive/40 rounded px-4 py-2 hover:bg-destructive/10 transition">
                  Disconnect Wallet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
