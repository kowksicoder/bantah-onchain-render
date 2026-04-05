export const BANTAH_SKILL_VERSION = "1.0.0";

export const bantahSkillActionValues = [
  "create_market",
  "join_yes",
  "join_no",
  "read_market",
  "check_balance",
] as const;

export type BantahSkillAction = (typeof bantahSkillActionValues)[number];

export type BantahPluginConfig = {
  endpointUrl?: string;
  apiKey?: string;
  enabledActions?: readonly BantahSkillAction[];
  timeoutMs?: number;
  skillVersion?: string;
  headers?: Record<string, string>;
};

export type BantahActionEnvelope = {
  action: BantahSkillAction;
  skillVersion: string;
  requestId: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

export type BantahSkillSuccessEnvelope = {
  ok: true;
  requestId: string;
  skillVersion: string;
  result: unknown;
};

export type BantahSkillErrorEnvelope = {
  ok: false;
  requestId: string;
  skillVersion: string;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type BantahSkillEnvelope =
  | BantahSkillSuccessEnvelope
  | BantahSkillErrorEnvelope;
