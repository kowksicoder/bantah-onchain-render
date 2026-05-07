const DEFAULT_BASE = "https://bantah.com";
const DEFAULT_SETTINGS = {
  bantah_base: DEFAULT_BASE,
  bantah_notify: true,
  bantah_interval_minutes: 5,
};
const DEFAULT_LOCAL_STATE = {
  bantah_last_poll_at: 0,
};
const POLL_ALARM_NAME = "bantah_poll_notifications";
const SUPPORTED_SITES = [
  "news.ycombinator.com",
  "reddit.com",
  "twitter.com",
  "x.com",
  "bloomberg.com",
  "cnn.com",
  "bbc.com",
  "techcrunch.com",
  "coindesk.com",
  "espn.com",
];

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => resolve(settings));
  });
}

function getLocalState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_LOCAL_STATE, (state) => resolve(state));
  });
}

function setLocalState(nextState) {
  return new Promise((resolve) => {
    chrome.storage.local.set(nextState, resolve);
  });
}

function normalizeBaseUrl(value) {
  try {
    return new URL(value || DEFAULT_BASE).origin;
  } catch (_error) {
    return DEFAULT_BASE;
  }
}

function buildUrl(base, path) {
  return new URL(path, normalizeBaseUrl(base)).toString();
}

function isSupportedUrl(url) {
  return typeof url === "string" && SUPPORTED_SITES.some((site) => url.includes(site));
}

function toNotificationList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

class BantahCompanionBackground {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setInitialState().catch((error) => {
      console.error("Failed to initialize Bantah Companion background:", error);
    });
  }

  setupEventListeners() {
    chrome.runtime.onInstalled.addListener(() => {
      this.setInitialState().catch((error) => {
        console.error("Failed to initialize extension state on install:", error);
      });
    });

    chrome.runtime.onStartup.addListener(() => {
      this.setInitialState().catch((error) => {
        console.error("Failed to initialize extension state on startup:", error);
      });
    });

    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      this.handleMessage(request, sendResponse);
      return true;
    });

    chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab.url) {
        this.checkPageSupport(tab);
      }
    });

    chrome.notifications.onClicked.addListener((notificationId) => {
      this.handleNotificationClick(notificationId);
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === POLL_ALARM_NAME) {
        this.syncNotifications().catch((error) => {
          console.error("Scheduled notification sync failed:", error);
        });
      }
    });
  }

  async setInitialState() {
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setBadgeBackgroundColor({ color: "#ff4757" });

    await this.configurePolling();

    const user = await this.checkAuthStatus();
    if (!user) {
      await this.updateBadge([]);
      return;
    }

    await this.syncNotifications({ showDesktop: false });
  }

  async configurePolling() {
    const settings = await getSettings();
    const intervalMinutes = Math.max(1, Number(settings.bantah_interval_minutes) || 5);

    if (settings.bantah_notify === false) {
      await chrome.alarms.clear(POLL_ALARM_NAME);
      return;
    }

    chrome.alarms.create(POLL_ALARM_NAME, { periodInMinutes: intervalMinutes });
  }

  async checkAuthStatus() {
    const settings = await getSettings();

    try {
      const response = await fetch(buildUrl(settings.bantah_base, "/api/auth/user"), {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Auth check failed:", error);
      return null;
    }
  }

  async handleMessage(request, sendResponse) {
    const action = request?.action || request?.type;

    try {
      switch (action) {
        case "checkAuth": {
          const user = await this.checkAuthStatus();
          sendResponse({ success: true, user });
          break;
        }

        case "fetchNotifications": {
          const notifications = await this.fetchNotifications();
          sendResponse({ success: true, notifications });
          break;
        }

        case "trigger-poll": {
          const notifications = await this.syncNotifications();
          sendResponse({ success: true, notifications });
          break;
        }

        case "createEvent": {
          const event = await this.createEventFromData(request.data || {});
          sendResponse({ success: true, event });
          break;
        }

        case "shareToTelegram": {
          await this.shareToTelegram(request.data || {});
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ success: false, error: "Unknown action" });
      }
    } catch (error) {
      console.error("Message handling error:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Unknown extension error",
      });
    }
  }

  async fetchNotifications() {
    const settings = await getSettings();

    try {
      const response = await fetch(buildUrl(settings.bantah_base, "/api/notifications"), {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return [];
      }

      const payload = await response.json();
      return toNotificationList(payload);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      return [];
    }
  }

  async updateBadge(notifications) {
    const unreadCount = notifications.filter((notification) => !notification.read).length;

    if (unreadCount > 0) {
      chrome.action.setBadgeText({ text: unreadCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: "#ff4757" });
      return;
    }

    chrome.action.setBadgeText({ text: "" });
  }

  async syncNotifications(options = {}) {
    const settings = await getSettings();
    const notifications = await this.fetchNotifications();
    await this.updateBadge(notifications);

    if (settings.bantah_notify === false || options.showDesktop === false) {
      await setLocalState({ bantah_last_poll_at: Date.now() });
      return notifications;
    }

    const localState = await getLocalState();
    const lastPollAt = Number(localState.bantah_last_poll_at) || 0;
    const now = Date.now();

    if (!lastPollAt) {
      await setLocalState({ bantah_last_poll_at: now });
      return notifications;
    }

    notifications
      .filter((notification) => {
        const createdAtMs = new Date(notification.createdAt).getTime();
        return !notification.read && Number.isFinite(createdAtMs) && createdAtMs > lastPollAt;
      })
      .forEach((notification) => {
        this.showDesktopNotification(notification);
      });

    await setLocalState({ bantah_last_poll_at: now });
    return notifications;
  }

  showDesktopNotification(notification) {
    chrome.notifications.create(`bantah_${notification.id}`, {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: String(notification.title || "Bantah"),
      message: String(notification.message || "You have a new notification."),
      priority: 1,
    });
  }

  async handleNotificationClick(notificationId) {
    const settings = await getSettings();
    chrome.tabs.create({ url: buildUrl(settings.bantah_base, "/notifications") });
    chrome.notifications.clear(notificationId);
  }

  checkPageSupport(tab) {
    if (!tab.id) return;

    if (isSupportedUrl(tab.url)) {
      chrome.action.setBadgeText({ text: "B", tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#48bb78", tabId: tab.id });
      return;
    }

    chrome.action.setBadgeText({ text: "", tabId: tab.id });
  }

  async createEventFromData(data) {
    const settings = await getSettings();
    const response = await fetch(buildUrl(settings.bantah_base, "/api/events"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create event (${response.status})`);
    }

    return await response.json();
  }

  async shareToTelegram(data) {
    const url = String(data.url || "");
    const text = String(data.text || "");
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    chrome.tabs.create({ url: telegramUrl });
  }
}

new BantahCompanionBackground();
