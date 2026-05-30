import type { Express, Request, Response } from "express";

type CronRunner = () => Promise<unknown> | unknown;

function getAuthorizationHeader(req: Request) {
  const raw = req.get("authorization");
  return Array.isArray(raw) ? raw[0] : raw || "";
}

function isAuthorizedCronRequest(req: Request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

  if (!secret) {
    return !isProduction;
  }

  return getAuthorizationHeader(req) === `Bearer ${secret}`;
}

async function runCronJob(req: Request, res: Response, jobName: string, runner: CronRunner) {
  if (!isAuthorizedCronRequest(req)) {
    return res.status(401).json({
      ok: false,
      job: jobName,
      error: "unauthorized",
    });
  }

  const startedAt = Date.now();
  res.setHeader("Cache-Control", "no-store");

  try {
    const result = await runner();
    return res.status(200).json({
      ok: true,
      job: jobName,
      durationMs: Date.now() - startedAt,
      result,
    });
  } catch (error) {
    console.error(`[cron] ${jobName} failed:`, error);
    return res.status(500).json({
      ok: false,
      job: jobName,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function registerCronRoutes(app: Express) {
  app.get("/api/cron/health", (req, res) =>
    runCronJob(req, res, "health", () => ({
      status: "ok",
      runtime: process.env.VERCEL === "1" ? "vercel" : "node",
      timestamp: new Date().toISOString(),
    })),
  );

  app.get("/api/cron/onchain-indexer", (req, res) =>
    runCronJob(req, res, "onchain-indexer", async () => {
      const { runOnchainIndexerOnce } = await import("./onchainIndexer");
      return runOnchainIndexerOnce();
    }),
  );

  app.get("/api/cron/notifications", (req, res) =>
    runCronJob(req, res, "notifications", async () => {
      const { storage } = await import("./storage");
      const { NotificationAlgorithmService } = await import("./notificationAlgorithm");
      const service = new NotificationAlgorithmService(storage);
      await service.executeNotificationAlgorithm();
      return { completed: true };
    }),
  );

  app.get("/api/cron/challenge-lifecycle", (req, res) =>
    runCronJob(req, res, "challenge-lifecycle", async () => {
      const { ChallengeScheduler } = await import("./challengeScheduler");
      await ChallengeScheduler.getInstance().runOnce();
      return { completed: true };
    }),
  );

  app.get("/api/cron/event-lifecycle", (req, res) =>
    runCronJob(req, res, "event-lifecycle", async () => {
      const { EventScheduler } = await import("./eventScheduler");
      await EventScheduler.getInstance().runOnce();
      return { completed: true };
    }),
  );

  app.get("/api/cron/payouts", (req, res) =>
    runCronJob(req, res, "payouts", async () => {
      const { payoutWorker } = await import("./payoutWorker");
      await payoutWorker.processPendingBatchesOnce();
      return { completed: true };
    }),
  );

  app.get("/api/cron/bantahbro-settlement", (req, res) =>
    runCronJob(req, res, "bantahbro-settlement", async () => {
      const { runBantahBroAgentBattleSettlementOnce } = await import(
        "./bantahBro/agentBattleSettlementWorker"
      );
      return runBantahBroAgentBattleSettlementOnce();
    }),
  );

  app.get("/api/cron/bantahbro-automation", (req, res) =>
    runCronJob(req, res, "bantahbro-automation", async () => {
      const { runBantahBroAutomationOnce } = await import("./bantahBro/automationService");
      return runBantahBroAutomationOnce();
    }),
  );

  app.get("/api/cron/bantahbro-battle-broadcast", (req, res) =>
    runCronJob(req, res, "bantahbro-battle-broadcast", async () => {
      const { broadcastBantahBroLiveBattlesOnce } = await import(
        "./bantahBro/agentBattleTelegramBroadcaster"
      );
      return broadcastBantahBroLiveBattlesOnce();
    }),
  );

  app.get("/api/cron/telegram-link-cleanup", (req, res) =>
    runCronJob(req, res, "telegram-link-cleanup", async () => {
      const { TelegramLinkingService } = await import("./telegramLinking");
      TelegramLinkingService.cleanupExpiredTokens();
      return { completed: true };
    }),
  );
}
