import fs from "fs/promises";
import path from "path";
import { getBantahBroTelegramBot } from "../telegramBot";
import {
  getLiveBantahBroAgentBattles,
  type BantahBroAgentBattle,
} from "./agentBattleService";

type BroadcastConfig = {
  enabled: boolean;
  intervalMs: number;
  limit: number;
  minSecondsLeft: number;
};

type BroadcastState = {
  sent: Record<string, string>;
};

type BroadcasterStatus = {
  enabled: boolean;
  started: boolean;
  intervalMs: number;
  limit: number;
  reason?: string;
};

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_LIMIT = 1;
const DEFAULT_MIN_SECONDS_LEFT = 45;
const MAX_STATE_ENTRIES = 500;
const STATE_PATH = path.resolve(process.cwd(), "cache", "bantahbro-telegram-battle-broadcasts.json");

let timer: NodeJS.Timeout | null = null;
let runPromise: Promise<void> | null = null;

function parseBooleanEnv(name: string, fallback: boolean) {
  const raw = String(process.env[name] || "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

function parseIntegerEnv(name: string, fallback: number) {
  const raw = Number.parseInt(String(process.env[name] || "").trim(), 10);
  return Number.isInteger(raw) && raw > 0 ? raw : fallback;
}

function loadConfig(): BroadcastConfig {
  return {
    // Keep Telegram battle alerts opt-in. Production sends should come from real
    // user/admin usage flows, not from automatic scanner/test loops by default.
    enabled: parseBooleanEnv("BANTAHBRO_TELEGRAM_BATTLE_BROADCAST_ENABLED", false),
    intervalMs: Math.max(
      10_000,
      parseIntegerEnv(
        "BANTAHBRO_TELEGRAM_BATTLE_BROADCAST_INTERVAL_MS",
        DEFAULT_INTERVAL_MS,
      ),
    ),
    limit: Math.max(
      1,
      Math.min(
        3,
        parseIntegerEnv("BANTAHBRO_TELEGRAM_BATTLE_BROADCAST_LIMIT", DEFAULT_LIMIT),
      ),
    ),
    minSecondsLeft: Math.max(
      0,
      Math.min(
        240,
        parseIntegerEnv(
          "BANTAHBRO_TELEGRAM_BATTLE_MIN_SECONDS_LEFT",
          DEFAULT_MIN_SECONDS_LEFT,
        ),
      ),
    ),
  };
}

function broadcastKeyForBattle(battle: BantahBroAgentBattle) {
  return `telegram-agent-battle-${battle.id}-${battle.startsAt}`;
}

async function loadState(): Promise<BroadcastState> {
  try {
    const raw = await fs.readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<BroadcastState>;
    if (parsed && typeof parsed.sent === "object" && parsed.sent) {
      return { sent: parsed.sent };
    }
  } catch {
    // First run or damaged cache: start clean instead of blocking broadcasts.
  }
  return { sent: {} };
}

async function saveState(state: BroadcastState) {
  const sortedEntries = Object.entries(state.sent)
    .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
    .slice(0, MAX_STATE_ENTRIES);

  await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
  await fs.writeFile(
    STATE_PATH,
    JSON.stringify({ sent: Object.fromEntries(sortedEntries) }, null, 2),
    "utf8",
  );
}

export async function broadcastBantahBroLiveBattlesOnce() {
  const config = loadConfig();
  if (!config.enabled) {
    return { sent: 0, skipped: 0, reason: "disabled" };
  }

  const bot = getBantahBroTelegramBot();
  if (!bot) {
    return { sent: 0, skipped: 0, reason: "bot-not-configured" };
  }

  const feed = await getLiveBantahBroAgentBattles(config.limit);
  const state = await loadState();
  let sent = 0;
  let skipped = 0;
  let stateChanged = false;

  for (const battle of feed.battles) {
    const key = broadcastKeyForBattle(battle);
    if (state.sent[key]) {
      skipped += 1;
      continue;
    }

    if (battle.timeRemainingSeconds < config.minSecondsLeft) {
      skipped += 1;
      continue;
    }

    const didSend = await bot.broadcastBantahBroAgentBattle(battle, {
      broadcastId: key,
    });

    if (didSend) {
      state.sent[key] = new Date().toISOString();
      stateChanged = true;
      sent += 1;
    } else {
      skipped += 1;
    }
  }

  if (stateChanged) {
    await saveState(state);
  }

  return { sent, skipped, reason: sent > 0 ? "broadcasted" : "no-new-battles" };
}

async function runBroadcastLoop() {
  if (runPromise) return runPromise;
  runPromise = broadcastBantahBroLiveBattlesOnce()
    .then((result) => {
      if (result.sent > 0) {
        console.log(`[OK] BantahBro Telegram battle broadcasts sent: ${result.sent}`);
      }
    })
    .catch((error) => {
      console.error("[WARN] BantahBro Telegram battle broadcast failed:", error);
    })
    .finally(() => {
      runPromise = null;
    });
  return runPromise;
}

export function startBantahBroAgentBattleTelegramBroadcaster(): BroadcasterStatus {
  const config = loadConfig();
  if (!config.enabled) {
    return {
      enabled: false,
      started: false,
      intervalMs: config.intervalMs,
      limit: config.limit,
      reason: "disabled",
    };
  }

  if (!getBantahBroTelegramBot()) {
    return {
      enabled: true,
      started: false,
      intervalMs: config.intervalMs,
      limit: config.limit,
      reason: "bot-not-configured",
    };
  }

  if (!timer) {
    void runBroadcastLoop();
    timer = setInterval(() => {
      void runBroadcastLoop();
    }, config.intervalMs);
    timer.unref?.();
  }

  return {
    enabled: true,
    started: true,
    intervalMs: config.intervalMs,
    limit: config.limit,
  };
}
