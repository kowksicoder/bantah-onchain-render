import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { and, eq, isNotNull } from "drizzle-orm";
import {
  AgentRuntime,
  asUUID,
  createMessageMemory,
  messageHandlerTemplate,
  type State,
} from "@elizaos/core";
import { bootstrapPlugin } from "@elizaos/plugin-bootstrap";
import { openrouterPlugin } from "@elizaos/plugin-openrouter";
import telegramPlugin from "@elizaos/plugin-telegram";
import { agents } from "@shared/schema";
import {
  bantahElizaRuntimeConfigSchema,
  type BantahElizaRuntimeConfig,
} from "@shared/elizaAgent";
import {
  type AgentActionEnvelope,
  type SkillErrorResponse,
  type SkillSuccessEnvelope,
} from "@shared/agentSkill";
import { db } from "./db";
import { storage } from "./storage";
import { createBantahElizaSkillsPlugin } from "./bantahElizaSkillsPlugin";
import { BantahElizaRuntimeMemoryAdapter } from "./bantahElizaRuntimeMemoryAdapter";
import { buildSkillErrorEnvelope } from "./agentProvisioning";
import { bantahOpenRouterEmbeddingsPlugin } from "./bantahOpenRouterEmbeddingsPlugin";
import { bantahBroTelegramBannerPlugin } from "./bantahBroTelegramBannerPlugin";
import { bantahBroLiveMarketPlugin } from "./bantahBroLiveMarketPlugin";

const LOCAL_AGENT_ENV_PATH = path.resolve(
  process.cwd(),
  "../Agent/typescript/examples/vercel-ai-sdk-smart-wallet-chatbot/.env",
);
type ManagedRuntimeEntry = {
  agentId: string;
  runtime: AgentRuntime;
  config: BantahElizaRuntimeConfig;
  startedAt: string;
};

const managedRuntimes = new Map<string, ManagedRuntimeEntry>();
let shutdownHooksRegistered = false;

function ensureElizaEnvFallback() {
  if (process.env.OPENROUTER_API_KEY?.trim()) return;
  if (!fs.existsSync(LOCAL_AGENT_ENV_PATH)) return;

  dotenv.config({
    path: LOCAL_AGENT_ENV_PATH,
    override: false,
  });

  const openAiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!process.env.OPENROUTER_API_KEY?.trim() && openAiKey.startsWith("sk-or-")) {
    process.env.OPENROUTER_API_KEY = openAiKey;
  }
}

function ensureRuntimeEnv() {
  ensureElizaEnvFallback();

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(
      "OPENROUTER_API_KEY is required to start Bantah Eliza runtimes.",
    );
  }
}

function withRuntimeStatus(
  config: BantahElizaRuntimeConfig,
  status: BantahElizaRuntimeConfig["status"],
): BantahElizaRuntimeConfig {
  return {
    ...config,
    status,
    updatedAt: new Date().toISOString(),
  };
}

function buildBantahBroTelegramMessageHandlerTemplate(baseTemplate?: unknown) {
  const base =
    typeof baseTemplate === "string" && baseTemplate.trim()
      ? baseTemplate
      : messageHandlerTemplate;

  return `${base}

<bantahbro_live_market_rules>
- If the user asks for a current coin or token price, including phrases like "price of", "how much is", "what is btc at", or "<token> price", you MUST include LOOKUP_LIVE_MARKET in actions.
- Never answer a live price question from memory.
- If you include REPLY before LOOKUP_LIVE_MARKET, the REPLY text must only acknowledge that you are checking the live market now. Do not include any guessed or stale price number in that first reply.
- After LOOKUP_LIVE_MARKET runs, use the returned live market result as the actual answer.
</bantahbro_live_market_rules>`;
}

async function persistRuntimeState(
  agentId: string,
  config: BantahElizaRuntimeConfig,
) {
  await db
    .update(agents)
    .set({
      runtimeEngine: config.engine,
      runtimeStatus: config.status,
      runtimeConfig: config,
      updatedAt: new Date(),
    })
    .where(eq(agents.agentId, agentId));
}

function buildRuntimeCharacter(config: BantahElizaRuntimeConfig) {
  const isBantahBro =
    config.character.name === String(process.env.BANTAHBRO_AGENT_NAME || "BantahBro").trim();
  const existingTemplates = ((config.character as any).templates || {}) as Record<string, unknown>;
  const existingMessageExamples = Array.isArray(config.character.messageExamples)
    ? config.character.messageExamples
    : [];
  const bantahBroMessageExamples = isBantahBro
    ? [
        [
          {
            user: "{{user1}}",
            content: {
              text: "price of bitcoin",
            },
          },
          {
            user: config.character.name,
            content: {
              text: "Checking the live BTC market now.",
              actions: ["REPLY", "LOOKUP_LIVE_MARKET"],
            },
          },
        ],
        [
          {
            user: "{{user1}}",
            content: {
              text: "how much is eth on base",
            },
          },
          {
            user: config.character.name,
            content: {
              text: "Pulling the live ETH/Base market before I answer.",
              actions: ["REPLY", "LOOKUP_LIVE_MARKET"],
            },
          },
        ],
      ]
    : [];

  return {
    ...config.character,
    system: [
      config.character.system,
      isBantahBro
        ? "For live token or coin price questions, never answer from memory. Use the live market provider context when available. If live market context is unavailable, explicitly say you could not verify the current price."
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    messageExamples: [...existingMessageExamples, ...bantahBroMessageExamples],
    templates: {
      ...existingTemplates,
      ...(isBantahBro
        ? {
            telegramMessageHandlerTemplate:
              buildBantahBroTelegramMessageHandlerTemplate(
                existingTemplates.telegramMessageHandlerTemplate,
              ),
          }
        : {}),
    },
    settings: {
      ...config.character.settings,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    },
  };
}

function resolveManagedRuntimePlugins(config: BantahElizaRuntimeConfig) {
  const configured = new Set(
    (config.pluginPackages || []).map((entry) => String(entry || "").trim()).filter(Boolean),
  );
  const isBantahBro =
    config.character.name === String(process.env.BANTAHBRO_AGENT_NAME || "BantahBro").trim();

  const plugins = [];

  if (
    configured.size === 0 ||
    configured.has("@elizaos/plugin-bootstrap")
  ) {
    plugins.push(bootstrapPlugin);
  }

  if (
    configured.size === 0 ||
    configured.has("@elizaos/plugin-openrouter")
  ) {
    plugins.push(openrouterPlugin);
    plugins.push(bantahOpenRouterEmbeddingsPlugin);
  }

  if (isBantahBro) {
    plugins.push(bantahBroLiveMarketPlugin);
  }

  if (
    configured.has("@elizaos/plugin-telegram") ||
    (config.character.clients || []).includes("telegram")
  ) {
    plugins.push(telegramPlugin);
    if (isBantahBro) {
      plugins.push(bantahBroTelegramBannerPlugin);
    }
  }

  plugins.push(createBantahElizaSkillsPlugin(config.skillActions));
  return plugins;
}

function ensureShutdownHooks() {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;

  const shutdown = async () => {
    await stopAllManagedBantahAgentRuntimes({ persist: true });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

export function getManagedBantahAgentRuntime(agentId: string) {
  return managedRuntimes.get(agentId) || null;
}

export function listManagedBantahAgentRuntimes() {
  return Array.from(managedRuntimes.values()).map((entry) => ({
    agentId: entry.agentId,
    startedAt: entry.startedAt,
    runtimeStatus: entry.config.status,
    runtimeEngine: entry.config.engine,
    chainId: entry.config.chainId,
    chainName: entry.config.chainName,
    walletAddress: entry.config.walletAddress,
    walletNetworkId: entry.config.walletNetworkId,
  }));
}

export async function startManagedBantahAgentRuntime(
  agentId: string,
): Promise<BantahElizaRuntimeConfig> {
  ensureRuntimeEnv();
  ensureShutdownHooks();

  const existing = managedRuntimes.get(agentId);
  if (existing) {
    return existing.config;
  }

  const storedAgent = await storage.getAgentById(agentId);
  if (!storedAgent) {
    throw new Error(`Bantah agent ${agentId} not found.`);
  }
  if (storedAgent.agentType !== "bantah_created") {
    throw new Error("Only Bantah-created agents can start a managed Eliza runtime.");
  }
  if (!storedAgent.runtimeConfig) {
    throw new Error("This Bantah agent does not have Eliza runtime metadata.");
  }

  const parsedConfig = bantahElizaRuntimeConfigSchema.parse(storedAgent.runtimeConfig);
  const startingConfig = withRuntimeStatus(parsedConfig, "starting");
  await persistRuntimeState(agentId, startingConfig);

  try {
    const runtime = new AgentRuntime({
      character: buildRuntimeCharacter(startingConfig) as any,
      plugins: resolveManagedRuntimePlugins(startingConfig),
    });
    runtime.registerDatabaseAdapter(new BantahElizaRuntimeMemoryAdapter() as any);
    await runtime.initialize();

    const activeConfig = withRuntimeStatus(startingConfig, "active");
    managedRuntimes.set(agentId, {
      agentId,
      runtime,
      config: activeConfig,
      startedAt: new Date().toISOString(),
    });
    await persistRuntimeState(agentId, activeConfig);

    return activeConfig;
  } catch (error: any) {
    const errorConfig = withRuntimeStatus(startingConfig, "error");
    await persistRuntimeState(agentId, errorConfig);
    throw new Error(error?.message || "Failed to start Bantah Eliza runtime.");
  }
}

export async function stopManagedBantahAgentRuntime(
  agentId: string,
  options: { persist?: boolean } = {},
) {
  const entry = managedRuntimes.get(agentId);
  if (!entry) {
    if (options.persist !== false) {
      const storedAgent = await storage.getAgentById(agentId);
      if (storedAgent?.runtimeConfig) {
        const parsedConfig = bantahElizaRuntimeConfigSchema.parse(storedAgent.runtimeConfig);
        const inactiveConfig = withRuntimeStatus(parsedConfig, "inactive");
        await persistRuntimeState(agentId, inactiveConfig);
      }
    }
    return false;
  }

  managedRuntimes.delete(agentId);

  try {
    await entry.runtime.stop();
  } finally {
    if (options.persist !== false) {
      const inactiveConfig = withRuntimeStatus(entry.config, "inactive");
      await persistRuntimeState(agentId, inactiveConfig);
    }
  }

  return true;
}

export async function restartManagedBantahAgentRuntime(
  agentId: string,
): Promise<BantahElizaRuntimeConfig> {
  if (managedRuntimes.has(agentId)) {
    await stopManagedBantahAgentRuntime(agentId, { persist: false });
  }

  return startManagedBantahAgentRuntime(agentId);
}

export async function stopAllManagedBantahAgentRuntimes(
  options: { persist?: boolean } = {},
) {
  const agentIds = Array.from(managedRuntimes.keys());
  await Promise.allSettled(
    agentIds.map((agentId) => stopManagedBantahAgentRuntime(agentId, options)),
  );
}

export async function restoreManagedBantahAgentRuntimes() {
  ensureRuntimeEnv();
  ensureShutdownHooks();

  const rows = await db
    .select({
      agentId: agents.agentId,
    })
    .from(agents)
    .where(
      and(
        eq(agents.agentType, "bantah_created"),
        eq(agents.status, "active"),
        eq(agents.runtimeEngine, "elizaos"),
        isNotNull(agents.runtimeConfig),
      ),
    );

  const results = await Promise.allSettled(
    rows.map((row) => startManagedBantahAgentRuntime(row.agentId)),
  );

  return {
    attempted: rows.length,
    started: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}

export async function executeManagedBantahAgentRuntimeAction(
  agentId: string,
  envelope: AgentActionEnvelope,
): Promise<{
  status: number;
  envelope: SkillSuccessEnvelope | SkillErrorResponse;
}> {
  const entry =
    managedRuntimes.get(agentId) ||
    (await startManagedBantahAgentRuntime(agentId).then(() => managedRuntimes.get(agentId) || null));

  if (!entry) {
    return {
      status: 500,
      envelope: buildSkillErrorEnvelope(
        envelope.requestId,
        "internal_error",
        "Managed Bantah Eliza runtime is unavailable.",
      ),
    };
  }

  const action = entry.runtime.actions.find((candidate) => candidate.name === envelope.action);
  if (!action) {
    return {
      status: 501,
      envelope: buildSkillErrorEnvelope(
        envelope.requestId,
        "unsupported_action",
        `Action ${envelope.action} is not registered on this Bantah Eliza runtime.`,
      ),
    };
  }

  const message = createMessageMemory({
    entityId: asUUID(agentId),
    agentId: asUUID(agentId),
    roomId: asUUID(agentId),
    content: {
      text: JSON.stringify(envelope.payload ?? {}),
      source: "bantah_runtime",
      actions: [envelope.action],
      requestId: envelope.requestId,
      timestamp: envelope.timestamp ?? new Date().toISOString(),
    },
  });
  const state: State = {
    values: {
      bantahAgentId: agentId,
      bantahRequestId: envelope.requestId,
      bantahAction: envelope.action,
    },
    data: {
      payload: envelope.payload,
    },
    text: JSON.stringify(envelope.payload ?? {}),
  };

  const isValid = await action.validate(entry.runtime, message, state);
  if (!isValid) {
    return {
      status: 501,
      envelope: buildSkillErrorEnvelope(
        envelope.requestId,
        "unsupported_action",
        `Action ${envelope.action} is not enabled for this Bantah Eliza runtime.`,
      ),
    };
  }

  const actionResult = await action.handler(entry.runtime, message, state, {
    requestId: envelope.requestId,
    payload: envelope.payload,
    action: envelope.action,
    skillVersion: envelope.skillVersion,
  });
  const actionData =
    actionResult && typeof actionResult === "object" && actionResult.data && typeof actionResult.data === "object"
      ? (actionResult.data as Record<string, unknown>)
      : null;
  const status =
    typeof actionData?.status === "number" && Number.isInteger(actionData.status)
      ? actionData.status
      : actionResult?.success === false
        ? 500
        : 200;
  const runtimeEnvelope = actionData?.envelope;

  if (
    runtimeEnvelope &&
    typeof runtimeEnvelope === "object" &&
    typeof (runtimeEnvelope as Record<string, unknown>).requestId === "string"
  ) {
    return {
      status,
      envelope: runtimeEnvelope as SkillSuccessEnvelope | SkillErrorResponse,
    };
  }

  return {
    status: 500,
    envelope: buildSkillErrorEnvelope(
      envelope.requestId,
      "internal_error",
      `Eliza runtime did not return a valid Bantah envelope for ${envelope.action}.`,
    ),
  };
}
