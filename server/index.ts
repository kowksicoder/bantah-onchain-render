import "dotenv/config";

// Suppress gramJS/telegram library logging
if (typeof window === "undefined") {
  const originalLog = console.log;
  console.log = function (...args: any[]) {
    const message = args.join(" ");
    if (
      !message.includes("[INFO]") &&
      !message.includes("gramJS") &&
      !message.includes("Running gramJS") &&
      !message.includes("Connecting to") &&
      !message.includes("Connection to") &&
      !message.includes("Using LAYER")
    ) {
      originalLog.apply(console, args);
    }
  };
}

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { registerRoutes } from "./routes";
import { addAuthTestRoutes } from "./authTest";
import { createBantahBroTelegramBot, createTelegramBot } from "./telegramBot";
import { NotificationAlgorithmService } from "./notificationAlgorithm";
import { seedAdmin } from "./seedAdmin";
import { initializeDatabase } from "./initDb";
import {
  ensureBantahBroTelegramRuntimeStarted,
  isBantahBroElizaTelegramEnabled,
} from "./bantahBro/systemAgent";
import { startBantahBroAutomationService } from "./bantahBro/automationService";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function log(message: string) {
  console.log(message);
}

function resolveConfiguredTelegramWebhookUrl(explicitEnvName: string, routePath: string) {
  const explicit = String(process.env[explicitEnvName] || "").trim();
  if (explicit) return explicit;

  const externalBase = String(process.env.RENDER_EXTERNAL_URL || "").trim();
  if (!externalBase) return null;

  try {
    return new URL(routePath, externalBase).toString();
  } catch {
    return null;
  }
}

function resolveTelegramWebhookUrl() {
  return resolveConfiguredTelegramWebhookUrl(
    "TELEGRAM_BOT_WEBHOOK_URL",
    "/api/telegram/bot-webhook",
  );
}

function resolveBantahBroTelegramWebhookUrl() {
  return resolveConfiguredTelegramWebhookUrl(
    "BANTAHBRO_TELEGRAM_BOT_WEBHOOK_URL",
    "/api/telegram/bantahbro-webhook",
  );
}

async function initializeTelegramBotRuntime(options: {
  bot: {
    testConnection: () => Promise<unknown>;
    setupWebhook: (webhookUrl: string) => Promise<boolean>;
    startPolling?: () => Promise<void>;
  } | null;
  label: string;
  webhookUrl: string | null;
  enableWebhook: boolean;
  allowPollingFallback: boolean;
}) {
  const { bot, label, webhookUrl, enableWebhook, allowPollingFallback } = options;

  if (!bot) return;

  try {
    await bot.testConnection();

    if (enableWebhook && webhookUrl) {
      await bot.setupWebhook(webhookUrl);
      return;
    }

    if (allowPollingFallback && typeof bot.startPolling === "function") {
      console.log(`[INIT] ${label} Telegram bot starting in polling mode`);
      await bot.startPolling();
      return;
    }

    console.warn(
      `[WARN] ${label} Telegram bot connected but is not listening. ` +
        `Set a public webhook URL or enable local polling.`,
    );
  } catch (err) {
    console.error(`[WARN] ${label} Telegram bot connection test failed:`, err);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------------------------------------------
// App setup
// -------------------------------------------------------------------

const app = express();

// Multer config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "coverImage" || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});

// Webhooks & parsers
app.use("/api/webhook/paystack", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// File uploads
app.use("/api/admin/", upload.any());

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
  })
);

// Cache control
app.use((_req, res, next) => {
  res.header("Cache-Control", "no-cache, no-store, must-revalidate");
  res.header("Pragma", "no-cache");
  res.header("Expires", "0");
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;

  res.on("finish", () => {
    if (reqPath.startsWith("/api")) {
      const duration = Date.now() - start;
      log(`${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// -------------------------------------------------------------------
// Main bootstrap
// -------------------------------------------------------------------

(async () => {
  // Routes
  const server = await registerRoutes(app, upload);
  addAuthTestRoutes(app);

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ message: err.message || "Internal Server Error" });
  });

  // -----------------------------------------------------------------
  // Frontend handling
  // -----------------------------------------------------------------

  const distPublicPath = path.resolve(__dirname, "../dist/public");

  // On Windows, npm scripts often run without NODE_ENV; default to dev unless explicitly production.
  if (process.env.NODE_ENV !== "production") {
    // Dev only: dynamic Vite import
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    // Production: serve static files
    if (fs.existsSync(distPublicPath)) {
      const clientPublicPath = path.resolve(__dirname, "../client/public");
      const rootPublicPath = path.resolve(__dirname, "../public");
      const mapPublicPath = path.resolve(__dirname, "../map");

      // Serve source public assets first so runtime files like service workers/fonts
      // are available even when omitted from dist by the build pipeline.
      app.use("/assets", express.static(path.join(clientPublicPath, "assets")));
      app.use("/fonts", express.static(path.join(clientPublicPath, "fonts")));
      app.use("/map", express.static(mapPublicPath));
      app.use(express.static(clientPublicPath));
      app.use(express.static(rootPublicPath));

      app.use(express.static(distPublicPath));

      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPublicPath, "index.html"));
      });
    }
  }

  // -----------------------------------------------------------------
  // Start server (hosting providers inject PORT)
  // -----------------------------------------------------------------

  const port = Number(process.env.PORT || 5000);

  server.listen(
    {
      port,
      host: "0.0.0.0",
      // Windows does not support SO_REUSEPORT on Node HTTP servers.
      reusePort: process.platform !== "win32"
    },
    () => {
      log(`[OK] Server running on port ${port}`);
    }
  );
  // Run slow/non-critical startup tasks in the background so deploy healthchecks pass quickly.
  void (async () => {
    // Telegram bot (safe in production)
    await initializeTelegramBotRuntime({
      bot: createTelegramBot(),
      label: "Platform",
      webhookUrl: resolveTelegramWebhookUrl(),
      enableWebhook:
        String(process.env.TELEGRAM_BOT_ENABLE_WEBHOOK || "true").trim().toLowerCase() !==
        "false",
      allowPollingFallback: true,
    });

    // Initialize database
    try {
      await initializeDatabase();
    } catch (err) {
      console.error("[ERROR] Failed to initialize database:", err);
    }

    try {
      const { restoreManagedBantahAgentRuntimes } = await import("./bantahElizaRuntimeManager");
      const restored = await restoreManagedBantahAgentRuntimes();
      console.log(`[OK] Bantah Eliza runtimes restored: ${restored.started}/${restored.attempted}`);
    } catch (err) {
      console.error("[WARN] Failed to restore Bantah Eliza runtimes:", err);
    }

    const bantahBroTelegramBot = createBantahBroTelegramBot();
    if (bantahBroTelegramBot) {
      try {
        await bantahBroTelegramBot.syncBantahBroProfile();
      } catch (err) {
        console.error("[WARN] Failed to sync BantahBro Telegram profile:", err);
      }
    }

    if (isBantahBroElizaTelegramEnabled()) {
      try {
        const result = await ensureBantahBroTelegramRuntimeStarted();
        console.log(
          `[OK] BantahBro Eliza Telegram runtime ready: ${result.systemAgent.agentId} (${result.runtime?.status || "no-runtime"})`,
        );
      } catch (err) {
        console.error("[WARN] Failed to start BantahBro Eliza Telegram runtime:", err);
      }
    } else {
      await initializeTelegramBotRuntime({
        bot: bantahBroTelegramBot,
        label: "BantahBro",
        webhookUrl: resolveBantahBroTelegramWebhookUrl(),
        enableWebhook:
          String(process.env.BANTAHBRO_TELEGRAM_BOT_ENABLE_WEBHOOK || "true")
            .trim()
            .toLowerCase() !== "false",
        allowPollingFallback: true,
      });
    }

    try {
      const automationStatus = await startBantahBroAutomationService();
      console.log(
        `[OK] BantahBro automation ready: enabled=${automationStatus.enabled} watchlist=${automationStatus.watchlistSize}`,
      );
    } catch (err) {
      console.error("[WARN] Failed to start BantahBro automation:", err);
    }

    // Onchain indexer (optional)
    try {
      const { startOnchainIndexer } = await import("./onchainIndexer");
      startOnchainIndexer();
    } catch (err) {
      console.error("[WARN] Failed to start onchain indexer:", err);
    }

    // Notification service
    try {
      const { storage } = await import("./storage");
      const notificationAlgorithm = new NotificationAlgorithmService(storage);
      notificationAlgorithm.startNotificationScheduler();
    } catch (err) {
      console.error("[WARN] Failed to start notification scheduler:", err);
    }

    // Seed admin users
    try {
      await seedAdmin();
    } catch (err) {
      console.error("[ERROR] Failed to seed admin users:", err);
    }
  })();
})();

// -------------------------------------------------------------------
// Serverless export
// -------------------------------------------------------------------

export async function initAppForServerless() {
  try {
    console.log("[INIT] Initializing serverless app...");

    // Telegram bot (safe in production)
    const telegramBot = createTelegramBot();
    await initializeTelegramBotRuntime({
      bot: telegramBot,
      label: "Platform",
      webhookUrl: resolveTelegramWebhookUrl(),
      enableWebhook:
        String(process.env.TELEGRAM_BOT_ENABLE_WEBHOOK || "true").trim().toLowerCase() !==
        "false",
      allowPollingFallback: false,
    });
    if (telegramBot) {
      console.log("[OK] Telegram bot connected");
    }

    const bantahBroTelegramBot = createBantahBroTelegramBot();
    if (bantahBroTelegramBot) {
      try {
        await bantahBroTelegramBot.syncBantahBroProfile();
      } catch (err) {
        console.error("[WARN] Failed to sync BantahBro Telegram profile:", err);
      }
    }
    if (isBantahBroElizaTelegramEnabled()) {
      try {
        const result = await ensureBantahBroTelegramRuntimeStarted();
        console.log(
          `[OK] BantahBro Eliza Telegram runtime ready: ${result.systemAgent.agentId} (${result.runtime?.status || "no-runtime"})`,
        );
      } catch (err) {
        console.error("[WARN] BantahBro Eliza Telegram runtime failed (non-critical)", err);
      }
    } else {
      await initializeTelegramBotRuntime({
        bot: bantahBroTelegramBot,
        label: "BantahBro",
        webhookUrl: resolveBantahBroTelegramWebhookUrl(),
        enableWebhook:
          String(process.env.BANTAHBRO_TELEGRAM_BOT_ENABLE_WEBHOOK || "true")
            .trim()
            .toLowerCase() !== "false",
        allowPollingFallback: false,
      });
      if (bantahBroTelegramBot) {
        console.log("[OK] BantahBro Telegram bot connected");
      }
    }

    try {
      const automationStatus = await startBantahBroAutomationService();
      console.log(
        `[OK] BantahBro automation ready: enabled=${automationStatus.enabled} watchlist=${automationStatus.watchlistSize}`,
      );
    } catch (err) {
      console.error("[WARN] BantahBro automation failed (non-critical)", err);
    }

    // Initialize database
    try {
      await initializeDatabase();
      console.log("[OK] Database initialized");
    } catch (err) {
      console.error("[ERROR] Failed to initialize database:", err);
    }

    // Register routes
    console.log("[INIT] Registering routes...");
    const server = await registerRoutes(app, upload);
    console.log("[OK] Routes registered");

    addAuthTestRoutes(app);

    // Notification service
    try {
      const { storage } = await import("./storage");
      const notificationAlgorithm = new NotificationAlgorithmService(storage);
      notificationAlgorithm.startNotificationScheduler();
      console.log("[OK] Notification service started");
    } catch (err) {
      console.error("[WARN] Notification service failed:", err);
    }

    // Seed admin users
    try {
      await seedAdmin();
      console.log("[OK] Admin users seeded");
    } catch (err) {
      console.error("[WARN] Admin seed failed:", err);
    }

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      res.status(status).json({ message: err.message || "Internal Server Error" });
    });

    console.log("[OK] Serverless app initialized successfully");
    return app;
  } catch (err) {
    console.error("[ERROR] Error initializing serverless app:", err);
    throw err;
  }
}
