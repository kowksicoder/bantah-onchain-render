'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Heart, MessageSquare, Share2, Zap } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

type FeedSource = 'bantah' | 'twitter' | 'telegram'

interface FeedItem {
  id: string
  user: string
  avatar: string
  handle: string
  timestamp: string
  time: string
  content: string
  market?: string
  marketEmoji?: string
  betChoice?: 'yes' | 'no'
  betAmount?: string
  likes: number
  comments: number
  tags: string[]
  liked: boolean
  source: FeedSource
  url?: string
}

interface FeedApiItem extends Omit<FeedItem, 'time' | 'liked'> {
  time?: string
  liked?: boolean
}

const SOURCE_META: Record<FeedSource, { label: string; color: string; bg: string; dot: string }> = {
  bantah: { label: 'BantahBro', color: 'text-primary', bg: 'bg-primary/10', dot: 'bg-primary' },
  twitter: { label: '𝕏 Twitter', color: 'text-sky-400', bg: 'bg-sky-400/10', dot: 'bg-sky-400' },
  telegram: { label: '✈ Telegram', color: 'text-blue-400', bg: 'bg-blue-400/10', dot: 'bg-blue-400' },
}

type FilterKey = 'trending' | 'latest' | 'following' | 'agents' | 'twitter' | 'telegram'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'trending', label: '🔥 Trending' },
  { key: 'latest', label: '⚡ Latest' },
  { key: 'following', label: '👥 Following' },
  { key: 'agents', label: '🤖 Agents' },
  { key: 'twitter', label: '𝕏 Twitter' },
  { key: 'telegram', label: '✈ Telegram' },
]

function formatRelativeTime(timestamp: string) {
  const date = new Date(timestamp)
  const diffMs = Date.now() - date.getTime()
  if (!Number.isFinite(diffMs)) return 'just now'
  if (diffMs < 60_000) return 'just now'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function normalizeFeedItem(item: FeedApiItem): FeedItem {
  return {
    ...item,
    time: item.time || formatRelativeTime(item.timestamp),
    liked: Boolean(item.liked),
    likes: Number.isFinite(item.likes) ? item.likes : 0,
    comments: Number.isFinite(item.comments) ? item.comments : 0,
    tags: Array.isArray(item.tags) ? item.tags : [],
  }
}

function filterFeed(items: FeedItem[], filter: FilterKey): FeedItem[] {
  if (filter === 'twitter') return items.filter(i => i.source === 'twitter')
  if (filter === 'telegram') return items.filter(i => i.source === 'telegram')
  if (filter === 'agents') {
    return items.filter(i => {
      const handle = i.handle.toLowerCase()
      const user = i.user.toLowerCase()
      return handle.includes('ai') || handle.includes('bot') || user.includes('ai') || user.includes('agent')
    })
  }
  if (filter === 'latest') {
    return [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }
  if (filter === 'trending') {
    return [...items].sort((a, b) => b.likes + b.comments - (a.likes + a.comments))
  }
  return items
}

function emptyMessage(filter: FilterKey) {
  if (filter === 'twitter') {
    return 'Twitter sync is not active yet. Once connected, 𝕏 posts will appear here.'
  }
  if (filter === 'telegram') {
    return 'No synced Telegram posts yet. New BantahBro Telegram broadcasts will appear here.'
  }
  return 'Posts from synced sources will appear here once BantahBro receives them.'
}

export default function FeedPage({ compact = false }: { compact?: boolean } = {}) {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('trending')

  const loadFeed = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/bantahbro/feed?limit=75', {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error(`Feed sync failed (${response.status})`)
      }
      const payload = (await response.json()) as { items?: FeedApiItem[] }
      setFeed(Array.isArray(payload.items) ? payload.items.map(normalizeFeedItem) : [])
    } catch (feedError) {
      setError(feedError instanceof Error ? feedError.message : 'Feed sync failed')
      setFeed([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/bantahbro/feed?limit=75', {
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) {
          throw new Error(`Feed sync failed (${response.status})`)
        }
        const payload = (await response.json()) as { items?: FeedApiItem[] }
        if (!cancelled) {
          setFeed(Array.isArray(payload.items) ? payload.items.map(normalizeFeedItem) : [])
        }
      } catch (feedError) {
        if (!cancelled) {
          setError(feedError instanceof Error ? feedError.message : 'Feed sync failed')
          setFeed([])
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    const interval = window.setInterval(load, 30_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const toggleLike = (id: string) => {
    setFeed(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, liked: !item.liked, likes: item.liked ? item.likes - 1 : item.likes + 1 }
          : item
      )
    )
  }

  const displayed = filterFeed(feed, activeFilter)

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="flex-1 flex flex-col bg-card border border-border rounded overflow-hidden">
        {/* Header */}
        <div className={`border-b border-border bg-background shrink-0 ${compact ? 'px-2 py-2' : 'px-4 py-3'}`}>
          <div className={`flex items-center gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
            <TrendingUp size={compact ? 15 : 18} className="text-primary" />
            <span className={`${compact ? 'text-xs' : ''} font-bold text-foreground`}>Activity Feed</span>
            <span className={`text-xs text-muted-foreground ml-auto ${compact ? 'hidden' : ''}`}>
              Synced from BantahBro · 𝕏 Twitter · ✈ Telegram
            </span>
          </div>
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1 text-xs'} rounded font-bold whitespace-nowrap transition shrink-0 ${
                  activeFilter === f.key
                    ? f.key === 'twitter'
                      ? 'bg-sky-400 text-background'
                      : f.key === 'telegram'
                      ? 'bg-blue-500 text-background'
                      : 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-border rounded p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-12 w-full rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
              <span className="text-3xl mb-2">⚠️</span>
              <div className="text-sm font-bold mb-1">Feed sync paused</div>
              <div className="text-xs mb-3">{error}</div>
              <button
                onClick={loadFeed}
                className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-bold"
              >
                Retry
              </button>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
              <span className="text-3xl mb-2">📭</span>
              <div className="text-sm font-bold mb-1">No posts yet</div>
              <div className="text-xs">{emptyMessage(activeFilter)}</div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {displayed.map(item => {
                const src = SOURCE_META[item.source]
                return (
                  <div key={item.id} className={`${compact ? 'px-2 py-2' : 'px-4 py-4'} hover:bg-muted/20 transition`}>
                    {/* User row */}
                    <div className="flex items-start gap-2 mb-2">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-lg shrink-0">
                        {item.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-foreground">{item.user}</span>
                          {(item.handle.toLowerCase().includes('ai') ||
                            item.handle.toLowerCase().includes('bot') ||
                            item.user.toLowerCase().includes('ai')) && (
                            <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">AI</span>
                          )}
                          {/* Source badge */}
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${src.bg} ${src.color}`}>
                            {src.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{item.handle}</span>
                          <span>·</span>
                          <span>{item.time}</span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <p className="text-sm text-foreground mb-3 leading-relaxed whitespace-pre-line">{item.content}</p>

                    {/* Market card */}
                    {item.market && (
                      <div className={`border rounded p-2.5 mb-3 ${
                        item.betChoice === 'yes'
                          ? 'border-secondary/40 bg-secondary/5'
                          : item.betChoice === 'no'
                          ? 'border-destructive/40 bg-destructive/5'
                          : 'border-border bg-muted/30'
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-base">{item.marketEmoji}</span>
                            <span className="text-xs text-muted-foreground truncate">{item.market}</span>
                          </div>
                          {item.betChoice && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                item.betChoice === 'yes' ? 'bg-secondary text-background' : 'bg-destructive text-background'
                              }`}>
                                {item.betChoice.toUpperCase()}
                              </span>
                              {item.betAmount && (
                                <span className="text-xs font-mono text-muted-foreground">{item.betAmount}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {item.tags.map(tag => (
                          <span key={tag} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <button
                        onClick={() => toggleLike(item.id)}
                        className={`flex items-center gap-1 text-xs transition hover:text-destructive ${item.liked ? 'text-destructive' : ''}`}
                      >
                        <Heart size={14} className={item.liked ? 'fill-current' : ''} />
                        <span>{item.likes}</span>
                      </button>
                      <button className="flex items-center gap-1 text-xs transition hover:text-foreground">
                        <MessageSquare size={14} />
                        <span>{item.comments}</span>
                      </button>
                      <button className="flex items-center gap-1 text-xs transition hover:text-foreground">
                        <Share2 size={14} />
                        <span>Share</span>
                      </button>
                      {item.url && (
                        <button
                          onClick={() => {
                            window.location.href = item.url || '#'
                          }}
                          className="flex items-center gap-1 text-xs ml-auto text-primary hover:text-primary/80 font-bold transition"
                        >
                          <Zap size={12} />
                          <span>Bet Same</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
