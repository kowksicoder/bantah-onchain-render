'use client'

import { useState } from 'react'
import { Check, Copy, Settings } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'

function getWalletAddress(user: unknown) {
  const candidate = user as any
  const walletAddress =
    candidate?.wallet?.address ||
    candidate?.walletAddress ||
    candidate?.wallet_address ||
    candidate?.linkedAccounts?.find?.((account: any) => account?.type === 'wallet')?.address ||
    candidate?.linked_accounts?.find?.((account: any) => account?.type === 'wallet')?.address

  return typeof walletAddress === 'string' && walletAddress.trim() ? walletAddress.trim() : null
}

function shortenAddress(address: string | null) {
  if (!address) return 'Wallet connected'
  if (address.length <= 14) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth()
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'activity' | 'settings'>('activity')
  const walletAddress = getWalletAddress(user)
  const displayAddress = shortenAddress(walletAddress)

  const copyAddress = () => {
    if (!walletAddress) return
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  if (authLoading) {
    return (
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="rounded border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="rounded border border-border bg-card p-3">
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-md border border-dashed border-primary/30 bg-primary/5 px-4 text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-background text-2xl">
              :)
            </div>
            <h2 className="text-base font-black text-foreground">Sign in to view your profile</h2>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              Your real battle history, payouts, and BXBT profile stats will show here after you connect.
            </p>
            <button
              type="button"
              onClick={() => login()}
              className="bb-tap mt-4 rounded-md border border-primary/50 bg-primary px-4 py-2 text-xs font-black text-primary-foreground transition hover:bg-primary/90 active:translate-y-0.5"
            >
              Sign in with Privy
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden rounded border border-border bg-card">
        <div className="border-b border-border bg-background px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-lg">
              :)
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-sm font-black text-foreground">{displayAddress}</h2>
                <span className="rounded bg-secondary/15 px-1.5 py-0.5 text-[10px] font-black uppercase text-secondary">
                  Connected
                </span>
              </div>
              <button
                type="button"
                onClick={copyAddress}
                disabled={!walletAddress}
                className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {copied ? <Check size={11} className="text-secondary" /> : <Copy size={11} />}
                <span className="font-mono">{displayAddress}</span>
              </button>
            </div>
            <button className="bb-tap rounded border border-border bg-muted/30 p-2 transition hover:bg-muted">
              <Settings size={14} className="text-muted-foreground" />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {[
              ['Wallet', 'Live'],
              ['Battles', 'Syncing'],
              ['BXBT', 'Tracked'],
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-border/70 bg-muted/25 px-2 py-1.5">
                <div className="truncate text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
                <div className="truncate text-xs font-black text-foreground">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex border-b border-border bg-background px-2">
          {(['activity', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-3 py-2 text-[11px] font-black uppercase tracking-wide transition ${
                activeTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'activity' ? (
            <div className="rounded-md border border-border bg-background/60 p-3">
              <div className="text-xs font-black uppercase tracking-wide text-foreground">No activity yet</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Real escrow-backed battle joins, prediction wins, and payouts will appear here once you start using BantahBro.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-md border border-border bg-background/60 p-3">
                <div className="text-xs font-black uppercase tracking-wide text-foreground">Account</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Wallet auth is handled through Privy. Profile preferences can plug into the live user dashboard next.
                </p>
              </div>
              <button
                type="button"
                className="bb-tap w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-black text-foreground transition hover:bg-muted"
              >
                Manage profile settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
