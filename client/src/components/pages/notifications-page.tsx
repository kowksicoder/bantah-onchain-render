'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, ExternalLink, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/queryClient'

type LiveNotification = {
  id: string
  type: string
  title: string
  message?: string | null
  icon?: string | null
  data?: unknown
  fomoLevel?: string | null
  priority?: number | null
  read?: boolean | null
  createdAt?: string | Date | null
}

type NotificationFilter = 'all' | 'unread'

function parseNotificationData(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function getNotificationBody(notification: LiveNotification) {
  const data = parseNotificationData(notification.data)
  const candidate =
    notification.message ||
    (typeof data.message === 'string' ? data.message : '') ||
    (typeof data.body === 'string' ? data.body : '')

  return candidate || 'Live notification from Bantah.'
}

function getNotificationTime(notification: LiveNotification) {
  if (!notification.createdAt) return 'recently'
  const createdAt = new Date(notification.createdAt)
  if (Number.isNaN(createdAt.getTime())) return 'recently'
  return formatDistanceToNow(createdAt, { addSuffix: true })
}

function getNotificationIcon(notification: LiveNotification) {
  if (notification.icon) return notification.icon

  const type = String(notification.type || '').toLowerCase()
  if (type.includes('agent')) return '🤖'
  if (type.includes('challenge') || type.includes('market')) return '📊'
  if (type.includes('friend') || type.includes('follow')) return '👥'
  if (type.includes('wallet') || type.includes('deposit') || type.includes('withdraw')) return '💳'
  if (type.includes('achievement') || type.includes('rank') || type.includes('win')) return '🏆'
  if (type.includes('daily')) return '📅'
  if (type.includes('telegram')) return '✈'
  return '🔔'
}

function getNotificationTone(notification: LiveNotification) {
  const type = String(notification.type || '').toLowerCase()
  const fomo = String(notification.fomoLevel || '').toLowerCase()

  if (fomo === 'urgent' || type.includes('lost') || type.includes('risk')) return 'border-l-destructive'
  if (type.includes('agent')) return 'border-l-primary'
  if (type.includes('market') || type.includes('challenge')) return 'border-l-secondary'
  if (type.includes('win') || type.includes('achievement') || type.includes('rank')) return 'border-l-accent'
  return 'border-l-muted-foreground'
}

function getActionUrl(notification: LiveNotification) {
  const data = parseNotificationData(notification.data)
  const challengeId = data.challengeId ?? data.challenge_id ?? notification.id
  const agentId = data.agentId ?? data.agent_id

  if (typeof data.scanUrl === 'string') return data.scanUrl
  if (typeof data.explorerUrl === 'string') return data.explorerUrl
  if (typeof agentId === 'string' && agentId) return `/agents/${agentId}`
  if ((String(notification.type || '').includes('challenge') || String(notification.type || '').includes('market')) && challengeId) {
    return `/challenge/${challengeId}`
  }

  return null
}

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<NotificationFilter>('all')

  const {
    data: notifications = [],
    isLoading,
    isError,
    error,
  } = useQuery<LiveNotification[]>({
    queryKey: ['/api/notifications'],
    retry: false,
    refetchInterval: 30_000,
  })

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => apiRequest('PATCH', `/api/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] })
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => apiRequest('PUT', '/api/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] })
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] })
    },
  })

  const safeNotifications = Array.isArray(notifications) ? notifications : []
  const unreadCount = safeNotifications.filter((notification) => !notification.read).length
  const filtered = useMemo(
    () => filter === 'unread' ? safeNotifications.filter((notification) => !notification.read) : safeNotifications,
    [filter, safeNotifications],
  )

  const markRead = (notification: LiveNotification) => {
    if (notification.read || markReadMutation.isPending) return
    markReadMutation.mutate(notification.id)
  }

  const markAllRead = () => {
    if (unreadCount === 0 || markAllReadMutation.isPending) return
    markAllReadMutation.mutate()
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="flex-1 flex flex-col bg-card border border-border rounded overflow-hidden">
        <div className="border-b border-border bg-background px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-primary" />
            <span className="font-bold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded overflow-hidden text-xs font-bold">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 transition ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1.5 transition ${filter === 'unread' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Unread
              </button>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markAllReadMutation.isPending}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 font-bold transition disabled:opacity-50"
              >
                {markAllReadMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3 border border-border rounded">
                  <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16 px-5 text-center">
              <Bell size={40} className="opacity-30" />
              <p className="text-sm font-bold text-foreground">Could not load live notifications</p>
              <p className="text-xs max-w-md">
                {error instanceof Error ? error.message : 'The notification API is unavailable right now.'}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
              <Bell size={40} className="opacity-30" />
              <p className="text-sm">No {filter === 'unread' ? 'unread ' : ''}notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((notification) => {
                const actionUrl = getActionUrl(notification)

                return (
                  <div
                    key={notification.id}
                    onClick={() => markRead(notification)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition hover:bg-muted/30 border-l-2 ${getNotificationTone(notification)} ${!notification.read ? 'bg-primary/5' : 'bg-background'}`}
                  >
                    <div className="text-2xl shrink-0 w-9 h-9 flex items-center justify-center">
                      {getNotificationIcon(notification)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-sm font-bold ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notification.title}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{getNotificationTime(notification)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{getNotificationBody(notification)}</p>
                      {actionUrl && (
                        <a
                          href={actionUrl}
                          target={actionUrl.startsWith('http') ? '_blank' : undefined}
                          rel={actionUrl.startsWith('http') ? 'noreferrer' : undefined}
                          onClick={(event) => event.stopPropagation()}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                          Open
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1.5" />
                    )}
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
