import { randomUUID } from "node:crypto";

import {
  BANTAH_SKILL_VERSION,
  type BantahActionEnvelope,
  type BantahPluginConfig,
  type BantahSkillAction,
  type BantahSkillEnvelope,
  type BantahSkillErrorEnvelope,
  type BantahSkillSuccessEnvelope,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSuccessEnvelope(value: unknown): value is BantahSkillSuccessEnvelope {
  return (
    isRecord(value) &&
    value.ok === true &&
    typeof value.requestId === "string" &&
    typeof value.skillVersion === "string" &&
    "result" in value
  );
}

function isErrorEnvelope(value: unknown): value is BantahSkillErrorEnvelope {
  return (
    isRecord(value) &&
    value.ok === false &&
    typeof value.requestId === "string" &&
    typeof value.skillVersion === "string" &&
    isRecord(value.error) &&
    typeof value.error.message === "string" &&
    typeof value.error.code === "string"
  );
}

function normalizeHeaders(headers?: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers ?? {}).filter(
      ([key, value]) => key.trim().length > 0 && String(value || "").trim().length > 0,
    ),
  );
}

export function buildBantahEnvelope(
  action: BantahSkillAction,
  payload: Record<string, unknown>,
  skillVersion = BANTAH_SKILL_VERSION,
): BantahActionEnvelope {
  return {
    action,
    skillVersion,
    requestId: `bantah_${action}_${randomUUID()}`,
    timestamp: new Date().toISOString(),
    payload,
  };
}

export async function callBantahSkill(
  config: Required<Pick<BantahPluginConfig, "endpointUrl" | "timeoutMs" | "skillVersion">> &
    Pick<BantahPluginConfig, "apiKey" | "headers">,
  action: BantahSkillAction,
  payload: Record<string, unknown>,
): Promise<BantahSkillEnvelope> {
  const envelope = buildBantahEnvelope(action, payload, config.skillVersion);
  const headers = normalizeHeaders({
    "content-type": "application/json",
    ...config.headers,
  });

  if (config.apiKey?.trim()) {
    headers.authorization = `Bearer ${config.apiKey.trim()}`;
  }

  const response = await fetch(config.endpointUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(envelope),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const rawBody = await response.text();

  let parsed: unknown;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return {
      ok: false,
      requestId: envelope.requestId,
      skillVersion: envelope.skillVersion,
      error: {
        code: "invalid_json",
        message: "Bantah endpoint did not return valid JSON.",
        details: {
          status: response.status,
          rawBody,
        },
      },
    };
  }

  if (isSuccessEnvelope(parsed) || isErrorEnvelope(parsed)) {
    return parsed;
  }

  return {
    ok: false,
    requestId: envelope.requestId,
    skillVersion: envelope.skillVersion,
    error: {
      code: "invalid_envelope",
      message: "Bantah endpoint returned a payload outside the Bantah skill contract.",
      details: {
        status: response.status,
        parsed,
      },
    },
  };
}
