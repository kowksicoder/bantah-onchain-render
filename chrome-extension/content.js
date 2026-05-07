const DEFAULT_BASE = "https://bantah.com";
const DEFAULT_SETTINGS = {
  bantah_base: DEFAULT_BASE,
};
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

function normalizeBaseUrl(value) {
  try {
    return new URL(value || DEFAULT_BASE).origin;
  } catch (_error) {
    return DEFAULT_BASE;
  }
}

function buildUrl(base, path, params) {
  const url = new URL(path, normalizeBaseUrl(base));
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === "string" && value.trim()) {
        url.searchParams.set(key, value.trim());
      }
    });
  }
  return url.toString();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanText(value, limit) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (!limit || normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

class BantahCompanionContent {
  constructor() {
    this.baseUrl = DEFAULT_BASE;
    this.pageSnapshot = null;
    this.init();
  }

  async init() {
    const settings = await getSettings();
    this.baseUrl = normalizeBaseUrl(settings.bantah_base);
    this.pageSnapshot = this.buildPageSnapshot();

    this.setupMessageListener();

    if (!this.isSupportedPage()) {
      return;
    }

    this.addAvailabilityIndicator();
    this.createFloatingButton();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      this.handleMessage(request, sendResponse);
      return true;
    });
  }

  handleMessage(request, sendResponse) {
    const action = request?.action || request?.type;

    switch (action) {
      case "getPageData":
        sendResponse(this.buildPageSnapshot());
        break;

      case "createEventFromPage":
      case "showOverlay":
        this.showBantahOverlay();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: "Unknown action" });
    }
  }

  isSupportedPage() {
    return SUPPORTED_SITES.some((site) => window.location.href.includes(site));
  }

  extractMetadata() {
    const metadata = {};
    const metaTags = document.querySelectorAll("meta");

    metaTags.forEach((tag) => {
      const property = tag.getAttribute("property") || tag.getAttribute("name");
      const content = tag.getAttribute("content");

      if (property && content) {
        metadata[property] = content;
      }
    });

    return metadata;
  }

  extractPageContent() {
    const mainContent =
      document.querySelector("main") ||
      document.querySelector("article") ||
      document.querySelector(".content") ||
      document.querySelector("#content");

    const text = cleanText(mainContent?.innerText || "", 500);
    const headlines = Array.from(document.querySelectorAll("h1, h2, h3"))
      .map((heading) => cleanText(heading.innerText, 120))
      .filter(Boolean)
      .slice(0, 5);

    return {
      text,
      headlines,
    };
  }

  getSuggestedCategory() {
    const host = window.location.hostname.toLowerCase();

    if (host.includes("coindesk")) return "crypto";
    if (host.includes("espn")) return "sports";
    if (host.includes("twitter") || host.includes("x.com")) return "news";

    return "news";
  }

  getSuggestedImageUrl(metadata) {
    const imageUrl =
      metadata["og:image"] ||
      metadata["twitter:image"] ||
      metadata["og:image:url"] ||
      "";

    return typeof imageUrl === "string" ? imageUrl.trim() : "";
  }

  getSuggestedTitle(content) {
    const tweetText = this.extractTweetText();
    if (tweetText) {
      return cleanText(tweetText, 140);
    }

    if (content.headlines.length > 0) {
      return content.headlines[0];
    }

    return cleanText(
      document.title
        .replace(/\s+\|\s+X$/i, "")
        .replace(/\s+\/\s+X$/i, "")
        .replace(/\s+\|\s+Twitter$/i, ""),
      140,
    );
  }

  getSuggestedDescription(content) {
    const tweetText = this.extractTweetText();
    if (tweetText) {
      return cleanText(tweetText, 400);
    }

    if (content.text) {
      return content.text;
    }

    return cleanText(content.headlines.join(" | "), 400);
  }

  extractTweetText() {
    const tweetNodes = Array.from(document.querySelectorAll("article [lang]"));
    const longestTweet = tweetNodes
      .map((node) => cleanText(node.innerText, 400))
      .sort((left, right) => right.length - left.length)[0];

    return longestTweet || "";
  }

  buildPageSnapshot() {
    const metadata = this.extractMetadata();
    const content = this.extractPageContent();

    return {
      title: this.getSuggestedTitle(content),
      url: window.location.href,
      description: this.getSuggestedDescription(content),
      category: this.getSuggestedCategory(),
      imageUrl: this.getSuggestedImageUrl(metadata),
      content,
      metadata,
    };
  }

  createFloatingButton() {
    if (document.getElementById("betchat-floating-button")) {
      return;
    }

    const button = document.createElement("div");
    button.id = "betchat-floating-button";
    button.innerHTML = `
      <div class="betchat-fab">
        <span class="betchat-fab-icon">B</span>
        <span class="betchat-fab-text">Bantah</span>
      </div>
    `;

    button.addEventListener("click", () => {
      this.showBantahOverlay();
    });

    document.body.appendChild(button);
  }

  showEventCreationDialog() {
    this.showBantahOverlay();
  }

  showBetChatOverlay() {
    this.showBantahOverlay();
  }

  showBantahOverlay() {
    const snapshot = this.buildPageSnapshot();
    this.pageSnapshot = snapshot;

    const existingOverlay = document.getElementById("betchat-overlay");
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const overlay = document.createElement("div");
    overlay.id = "betchat-overlay";
    overlay.innerHTML = `
      <div class="betchat-overlay-content">
        <div class="betchat-overlay-header">
          <h3>Bantah Companion</h3>
          <button id="betchat-close-overlay">x</button>
        </div>
        <div class="betchat-overlay-body">
          <div class="betchat-page-info">
            <h4>Current page</h4>
            <p class="betchat-page-title">${escapeHtml(snapshot.title || document.title)}</p>
            <p class="betchat-page-url">${escapeHtml(window.location.href)}</p>
          </div>
          <div class="betchat-event-form">
            <h4>Create Bantah event</h4>
            <input
              type="text"
              id="betchat-event-title"
              placeholder="Event title..."
              value="${escapeHtml(snapshot.title || document.title)}"
            />
            <textarea id="betchat-event-description" placeholder="Event description...">${escapeHtml(snapshot.description)}</textarea>
            <div class="betchat-event-options">
              <label><input type="radio" name="category" value="news" ${snapshot.category === "news" ? "checked" : ""}> News</label>
              <label><input type="radio" name="category" value="sports" ${snapshot.category === "sports" ? "checked" : ""}> Sports</label>
              <label><input type="radio" name="category" value="crypto" ${snapshot.category === "crypto" ? "checked" : ""}> Crypto</label>
              <label><input type="radio" name="category" value="politics" ${snapshot.category === "politics" ? "checked" : ""}> Politics</label>
            </div>
            <div class="betchat-event-actions">
              <button id="betchat-create-event">Open Create Form</button>
              <button id="betchat-share-telegram">Share to Telegram</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.setupOverlayListeners();
  }

  setupOverlayListeners() {
    document.getElementById("betchat-close-overlay")?.addEventListener("click", () => {
      document.getElementById("betchat-overlay")?.remove();
    });

    document.getElementById("betchat-create-event")?.addEventListener("click", () => {
      this.createEventFromForm();
    });

    document.getElementById("betchat-share-telegram")?.addEventListener("click", () => {
      this.shareToTelegram();
    });

    document.getElementById("betchat-overlay")?.addEventListener("click", (event) => {
      if (event.target?.id === "betchat-overlay") {
        document.getElementById("betchat-overlay")?.remove();
      }
    });
  }

  createEventFromForm() {
    const title = cleanText(document.getElementById("betchat-event-title")?.value || "", 140);
    const description = cleanText(
      document.getElementById("betchat-event-description")?.value || "",
      400,
    );
    const category =
      document.querySelector('input[name="category"]:checked')?.value || "news";
    const snapshot = this.pageSnapshot || this.buildPageSnapshot();

    if (!title) {
      window.alert("Please enter an event title.");
      return;
    }

    const eventUrl = buildUrl(this.baseUrl, "/events/create", {
      title,
      description,
      category,
      sourceUrl: window.location.href,
      imageUrl: snapshot.imageUrl || "",
    });

    window.open(eventUrl, "_blank");
    document.getElementById("betchat-overlay")?.remove();
  }

  shareToTelegram() {
    const title =
      cleanText(document.getElementById("betchat-event-title")?.value || "", 140) ||
      this.pageSnapshot?.title ||
      document.title;
    const text = `Check out this page for a Bantah event:\n\n${title}\n\n${window.location.href}`;
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;

    window.open(telegramUrl, "_blank");
    document.getElementById("betchat-overlay")?.remove();
  }

  addAvailabilityIndicator() {
    if (document.getElementById("betchat-page-indicator")) {
      return;
    }

    const indicator = document.createElement("div");
    indicator.id = "betchat-page-indicator";
    indicator.innerHTML = `
      <div class="betchat-indicator">
        <span>B</span>
        <span>Bantah ready</span>
      </div>
    `;

    document.body.appendChild(indicator);

    setTimeout(() => {
      indicator.style.opacity = "0";
      setTimeout(() => {
        indicator.remove();
      }, 500);
    }, 4000);
  }
}

new BantahCompanionContent();
