import type { IAgentRuntime } from "@elizaos/core";

import {
  BANTAH_SKILL_VERSION,
  bantahSkillActionValues,
  type BantahPluginConfig,
  type BantahSkillAction,
} from "./types.js";

type ResolvedBantahPluginConfig = {
  endpointUrl?: string;
  apiKey?: string;
  enabledActions?: readonly BantahSkillAction[];
  timeoutMs: number;
  skillVersion: string;
  headers?: Record<string, string>;
};

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

export function resolveBantahPluginConfig(
  runtime: IAgentRuntime,
  baseConfig: BantahPluginConfig,
): ResolvedBantahPluginConfig {
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

export function isBantahActionEnabled(
  config: Pick<ResolvedBantahPluginConfig, "enabledActions">,
  action: BantahSkillAction,
): boolean {
  if (!config.enabledActions || config.enabledActions.length === 0) {
    return true;
  }

  return config.enabledActions.includes(action);
}
