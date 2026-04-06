import {
  createActionResult,
  type Action,
  type Plugin,
} from "@elizaos/core";

import { callBantahSkill } from "./client.js";
import {
  isBantahActionEnabled,
  resolveBantahPluginConfig,
} from "./environment.js";
import {
  bantahSkillActionValues,
  type BantahPluginConfig,
  type BantahSkillAction,
} from "./types.js";

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
      const resolved = resolveBantahPluginConfig(runtime, baseConfig);
      return Boolean(resolved.endpointUrl) && isBantahActionEnabled(resolved, actionName);
    },
    handler: async (runtime, _message, _state, options) => {
      const resolved = resolveBantahPluginConfig(runtime, baseConfig);
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
export * from "./environment.js";
export * from "./types.js";
