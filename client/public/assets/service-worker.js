// Service Worker for push notifications and safe offline support

const SW_VERSION = "2026-03-05-1";
const CACHE_NAME = `bantah-static-${SW_VERSION}`;
const PRECACHE_URLS = ["/", "/index.html", "/manifest.json"];

function isPrivyRequest(url) {
  return (
    url.includes("privy.io") ||
    url.includes("walletconnect") ||
    url.includes("auth.privy") ||
    url.includes("api.privy") ||
    url.includes("embedded-wallet.privy")
  );
}

function isNavigationRequest(request) {
  const accept = request.headers.get("accept") || "";
  return (
    request.mode === "navigate" ||
    request.destination === "document" ||
    accept.includes("text/html")
  );
}

function isStaticAssetRequest(url, request) {
  return (
    url.pathname.startsWith("/assets/") ||
    ["script", "style", "image", "font"].includes(request.destination)
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (isPrivyRequest(request.url) || url.pathname.startsWith("/api/")) {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          await cache.put("/index.html", networkResponse.clone());
          return networkResponse;
        } catch (_error) {
          const cachedHtml = await caches.match("/index.html");
          if (cachedHtml) {
            return cachedHtml;
          }
          return caches.match(request);
        }
      })()
    );
    return;
  }

  if (isStaticAssetRequest(url, request)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        const networkPromise = fetch(request)
          .then(async (response) => {
            if (response && response.status === 200) {
              const cache = await caches.open(CACHE_NAME);
              await cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => null);

        return cached || networkPromise || fetch(request);
      })()
    );
    return;
  }

  event.respondWith(fetch(request));
});

self.addEventListener("push", (event) => {
  let notificationData = {};

  try {
    notificationData = event.data.json();
  } catch (_error) {
    notificationData = {
      title: "New Notification",
      body: "You have a new notification",
      icon: "/assets/bantahlogo.png",
      badge: "/assets/notification.svg",
      data: {
        url: "/notifications",
      },
    };
  }

  const title = notificationData.title || "New Notification";
  const options = {
    body: notificationData.body || "You have a new notification",
    icon: notificationData.icon || "/assets/bantahlogo.png",
    badge: notificationData.badge || "/assets/notification.svg",
    data: notificationData.data || {},
    vibrate: [100, 50, 100],
    requireInteraction: true,
    actions: [
      {
        action: "view",
        title: "View",
        icon: "/assets/icons/view.png",
      },
      {
        action: "close",
        title: "Close",
        icon: "/assets/icons/close.png",
      },
    ],
    silent: false,
    tag: notificationData.type || "general",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const notificationData = event.notification.data;

  if (notificationData && notificationData.url) {
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === notificationData.url && "focus" in client) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(notificationData.url);
        }

        return undefined;
      })
    );
  }
});
