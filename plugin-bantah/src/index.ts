import {
  createActionResult,
  type Action,
  type IAgentRuntime,
  type Plugin,
} from "@elizaos/core";

import { callBantahSkill } from "./client.js";
import {
  BANTAH_SKILL_VERSION,
  bantahSkillActionValues,
  type BantahPluginConfig,
  type BantahSkillAction,
} from "./types.js";

function getRuntimeSetting(runtime: IAgentRuntime, key: string): unknown {
  const runtimeValue = runtime.getSetting(key);
  if (runtimeValue !== undefined && runtimeValue !== null) {
    return runtimeValue;
  }

  const characterSettings = runtime.character?.settings as Record<string, unknown> | undefined;
  return characterSettings?.[key];
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseEnabledActions(value: unknown): BantahSkillAction[] | undefined {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || "").trim())
      .filter((entry): entry is BantahSkillAction =>
        bantahSkillActionValues.includes(entry as BantahSkillAction),
      );
  }

  if (typeof value === "string" && value.trim()) {
    try {
      return parseEnabledActions(JSON.parse(value));
    } catch {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry): entry is BantahSkillAction =>
          bantahSkillActionValues.includes(entry as BantahSkillAction),
        );
    }
  }

  return undefined;
}

function resolveConfig(runtime: IAgentRuntime, baseConfig: BantahPluginConfig) {
  const endpointUrl =
    String(
      baseConfig.endpointUrl ??
        getRuntimeSetting(runtime, "BANTAH_ENDPOINT_URL") ??
        "",
    ).trim() || undefined;

  const apiKey =
    String(baseConfig.apiKey ?? getRuntimeSetting(runtime, "BANTAH_API_KEY") ?? "").trim() ||
    undefined;

  const timeoutMs =
    baseConfig.timeoutMs ??
    parseNumber(getRuntimeSetting(runtime, "BANTAH_TIMEOUT_MS")) ??
    12_000;

  const skillVersion =
    String(
      baseConfig.skillVersion ??
        getRuntimeSetting(runtime, "BANTAH_SKILL_VERSION") ??
        BANTAH_SKILL_VERSION,
    ).trim() || BANTAH_SKILL_VERSION;

  const enabledActions =
    baseConfig.enabledActions ??
    parseEnabledActions(getRuntimeSetting(runtime, "BANTAH_SKILL_ACTIONS"));

  return {
    endpointUrl,
    apiKey,
    timeoutMs,
    skillVersion,
    enabledActions,
    headers: baseConfig.headers,
  };
}

function isActionEnabled(
  config: ReturnType<typeof resolveConfig>,
  action: BantahSkillAction,
): boolean {
  if (!config.enabledActions || config.enabledActions.length === 0) {
    return true;
  }

  return config.enabledActions.includes(action);
}

function describeAction(action: BantahSkillAction): string {
  switch (action) {
    case "create_market":
      return "Create a Bantah market using the configured Bantah-compatible runtime endpoint.";
    case "join_yes":
      return "Join a Bantah market on the YES side.";
    case "join_no":
      return "Join a Bantah market on the NO side.";
    case "read_market":
      return "Read a Bantah market snapshot and participant state.";
    case "check_balance":
      return "Read the Bantah agent balance available at the configured runtime endpoint.";
    default:
      return "Call a Bantah skill action.";
  }
}

function createBantahAction(actionName: BantahSkillAction, baseConfig: BantahPluginConfig): Action {
  return {
    name: actionName,
    similes: [actionName.toUpperCase()],
    description: describeAction(actionName),
    validate: async (runtime) => {
      const resolved = resolveConfig(runtime, baseConfig);
      return Boolean(resolved.endpointUrl) && isActionEnabled(resolved, actionName);
    },
    handler: async (runtime, _message, _state, options) => {
      const resolved = resolveConfig(runtime, baseConfig);
      if (!resolved.endpointUrl) {
        return createActionResult({
          success: false,
          error:
            "Missing Bantah endpoint URL. Set BANTAH_ENDPOINT_URL or pass endpointUrl to createBantahPlugin().",
        });
      }

      const payload =
        options?.payload && typeof options.payload === "object"
          ? (options.payload as Record<string, unknown>)
          : {};

      try {
        const result = await callBantahSkill(
          {
            endpointUrl: resolved.endpointUrl,
            apiKey: resolved.apiKey,
            timeoutMs: resolved.timeoutMs,
            skillVersion: resolved.skillVersion,
            headers: resolved.headers,
          },
          actionName,
          payload,
        );

        if (result.ok) {
          return createActionResult({
            success: true,
            text:
              typeof result.result === "object"
                ? JSON.stringify(result.result)
                : String(result.result ?? ""),
            data: {
              envelope: result,
            },
          });
        }

        return createActionResult({
          success: false,
          error: result.error.message,
          data: {
            envelope: result,
          },
        });
      } catch (error) {
        return createActionResult({
          success: false,
          error: error instanceof Error ? error.message : "Unknown Bantah action failure.",
        });
      }
    },
  };
}

export function createBantahPlugin(baseConfig: BantahPluginConfig = {}): Plugin {
  return {
    name: "bantah",
    description: "Bantah prediction market actions for Eliza agents.",
    actions: bantahSkillActionValues.map((action) => createBantahAction(action, baseConfig)),
  };
}

const bantahPlugin = createBantahPlugin();

export default bantahPlugin;
export * from "./client.js";
export * from "./types.js";
