/**
 * 2️⃣ IN-APP NOTIFICATION FEED UI
 * Mobile-first real-time notification component
 * Displays notifications via Pusher
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Bell, X, Check, Zap, Clock, Eye, Flame, Rocket, CheckCircle2, Megaphone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Pusher from 'pusher-js';
import { AgentIcon } from '@/components/AgentIcon';
import { useLocation } from "wouter";

interface Notification {
  id: string;
  event: string;
  title: string;
  body: string;
  priority: 'low' | 'medium' | 'high';
  challengeId?: string;
  timestamp: Date;
  read?: boolean;
}

interface NotificationFeedProps {
  maxDisplay?: number;
}

const isAgentEvent = (event?: string) => {
  const normalized = String(event || "").toLowerCase();
  return normalized.includes("agent");
};

const getEventTitleFallback = (event?: string) => {
  const normalized = String(event || "").toLowerCase();
  if (normalized === "agent_challenge_won") return "Agent won a market";
  if (normalized === "agent_challenge_lost") return "Agent lost a market";
  if (normalized === "challenge_won") return "Market won";
  if (normalized === "challenge_lost") return "Market lost";
  return "Notification";
};

const getEventBodyFallback = (event?: string) => {
  const normalized = String(event || "").toLowerCase();
  if (normalized === "agent_challenge_won") return "Your agent closed a winning market.";
  if (normalized === "agent_challenge_lost") return "Your agent lost this market.";
  if (normalized === "challenge_won") return "You won this market.";
  if (normalized === "challenge_lost") return "You lost this market.";
  return "";
};

export const NotificationFeed: React.FC<NotificationFeedProps> = ({ maxDisplay = 5 }) => {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const normalizeNotification = useCallback((raw: any): Notification => {
    const level = String(raw?.fomoLevel || raw?.fomo_level || "").toLowerCase();
    const priorityValue = Number(raw?.priority || 0);
    const normalizedPriority: 'low' | 'medium' | 'high' =
      level === 'urgent' || level === 'high' || priorityValue >= 3
        ? 'high'
        : level === 'medium' || priorityValue === 2
          ? 'medium'
          : 'low';

    return {
      id: String(raw?.id || `notif_${Date.now()}`),
      event: String(raw?.event || raw?.type || "system"),
      title: String(raw?.title || raw?.messageTitle || getEventTitleFallback(raw?.event || raw?.type)),
      body: String(raw?.body || raw?.message || getEventBodyFallback(raw?.event || raw?.type)),
      priority: normalizedPriority,
      challengeId:
        raw?.challengeId?.toString?.() ||
        raw?.challenge_id?.toString?.() ||
        raw?.data?.challengeId?.toString?.() ||
        undefined,
      timestamp: raw?.timestamp ? new Date(raw.timestamp) : new Date(raw?.createdAt || raw?.created_at || Date.now()),
      read: Boolean(raw?.read),
    };
  }, []);

  // Initialize Pusher on mount
  useEffect(() => {
    if (!user?.id) return;

    const pusherInstance = new Pusher(import.meta.env.VITE_PUSHER_KEY || '', {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER || 'mt1',
    });

    const channel = pusherInstance.subscribe(`user-${user.id}`);
    channel.bind('notification', (data: any) => {
      const normalized = normalizeNotification(data);
      setNotifications((prev) => [normalized, ...prev].slice(0, 50)); // Keep last 50
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      channel.unbind('notification');
      pusherInstance.unsubscribe(`user-${user.id}`);
    };
  }, [normalizeNotification, user?.id]);

  // Load initial notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications?limit=20');
        const data = await res.json();
        setNotifications((data.data || []).map((item: any) => normalizeNotification(item)));

        // Get unread count
        const countRes = await fetch('/api/notifications/unread-count');
        const countData = await countRes.json();
        setUnreadCount(countData.unreadCount || 0);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    if (user?.id) {
      fetchNotifications();
    }
  }, [normalizeNotification, user?.id]);

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
      });
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, []);

  const handleDismiss = useCallback(async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  }, []);

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'medium':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-96 max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl z-50 max-h-96 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-slate-50 dark:bg-slate-700 px-4 py-3 border-b border-slate-200 dark:border-slate-600 flex justify-between items-center">
            <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Notifications List */}
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {notifications.slice(0, maxDisplay).map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 border-l-4 ${getPriorityColor(notif.priority)} cursor-pointer hover:bg-opacity-75 transition-colors`}
                  onClick={() => {
                    if (!notif.read) {
                      handleMarkAsRead(notif.id);
                    }
                    if (notif.challengeId) {
                      navigate(`/challenges/${notif.challengeId}/activity`);
                      setIsOpen(false);
                    }
                  }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center justify-center text-slate-700 dark:text-slate-200">
                          {getIconForEvent(notif.event, "w-4 h-4")}
                        </span>
                        <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                          {notif.title}
                        </h4>
                        {isAgentEvent(notif.event) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                            Agent
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {notif.body}
                      </p>
                      <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">
                        {new Date(notif.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(notif.id);
                      }}
                      className="p-1 hover:bg-slate-300 dark:hover:bg-slate-600 rounded flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {!notif.read && (
                    <div className="mt-2 pt-2 border-t border-slate-300 dark:border-slate-600 flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(notif.id);
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Mark as read
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {notifications.length > maxDisplay && (
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-center">
              <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Standalone Toast Notifications
 * For HIGH priority notifications (bonus expiring, match found, etc.)
 */
export const NotificationToast: React.FC<{ notification: Notification }> = ({ notification }) => {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsVisible(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className={`fixed bottom-4 right-4 max-w-sm p-4 rounded-lg shadow-lg border-l-4 ${
      notification.priority === 'high'
        ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
        : notification.priority === 'medium'
        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
    }`}>
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center justify-center text-slate-700 dark:text-slate-200">
          {getIconForEvent(notification.event, "w-5 h-5")}
        </span>
        <div className="flex-1">
          <h4 className="font-semibold text-slate-900 dark:text-white">{notification.title}</h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{notification.body}</p>
        </div>
      </div>
    </div>
  );
};

function getIconForEvent(event: string, className: string) {
  switch (event) {
    case 'challenge.created':
      return <Zap className={className} />;
    case 'challenge.starting_soon':
    case 'challenge.ending_soon':
    case 'bonus.expiring':
      return <Clock className={className} />;
    case 'challenge.joined.friend':
      return <Eye className={className} />;
    case 'imbalance.detected':
      return <Flame className={className} />;
    case 'bonus.activated':
      return <Rocket className={className} />;
    case 'match.found':
      return <CheckCircle2 className={className} />;
    case 'challenge_won':
    case 'agent_challenge_won':
      return <CheckCircle2 className={className} />;
    case 'challenge_lost':
    case 'agent_challenge_lost':
      return <AgentIcon className={className} alt="Agent outcome notification" />;
    case 'system.joined':
      return <AgentIcon className={className} alt="Agent notification" />;
    default:
      return <Megaphone className={className} />;
  }
}

export default NotificationFeed;
