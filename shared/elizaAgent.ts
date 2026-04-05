import { z } from "zod";

export const bantahElizaRuntimeEngineValues = ["elizaos"] as const;
export const bantahElizaRuntimeStatusValues = [
  "configured",
  "starting",
  "active",
  "inactive",
  "error",
] as const;

export type BantahElizaRuntimeEngine =
  (typeof bantahElizaRuntimeEngineValues)[number];
export type BantahElizaRuntimeStatus =
  (typeof bantahElizaRuntimeStatusValues)[number];

const evmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Wallet address must be a valid EVM address");

export const bantahElizaStyleSchema = z.object({
  all: z.array(z.string()).default([]),
  chat: z.array(z.string()).default([]),
  post: z.array(z.string()).default([]),
});

export const bantahElizaCharacterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(80),
  username: z.string().min(2).max(80),
  bio: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  system: z.string().min(1),
  adjectives: z.array(z.string().min(1)).default([]),
  topics: z.array(z.string().min(1)).default([]),
  postExamples: z.array(z.string().min(1)).default([]),
  messageExamples: z.array(z.array(z.record(z.string(), z.unknown()))).default([]),
  plugins: z.array(z.string().min(1)).default([]),
  settings: z.record(z.string(), z.unknown()).default({}),
  style: bantahElizaStyleSchema.default({
    all: [],
    chat: [],
    post: [],
  }),
});

export const bantahElizaRuntimeConfigSchema = z.object({
  engine: z.enum(bantahElizaRuntimeEngineValues).default("elizaos"),
  status: z.enum(bantahElizaRuntimeStatusValues).default("configured"),
  runtimeMode: z.enum(["bantah_managed"]).default("bantah_managed"),
  managedBy: z.literal("bantah").default("bantah"),
  agentId: z.string().uuid(),
  endpointUrl: z
    .string()
    .url("Endpoint URL must be a valid URL")
    .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
      message: "Endpoint URL must use http or https",
    }),
  modelProvider: z.string().min(1).default("openrouter"),
  pluginPackages: z.array(z.string().min(1)).default([]),
  skillActions: z.array(z.string().min(1)).default([]),
  chainId: z.number().int().positive(),
  chainName: z.string().min(1),
  walletAddress: evmAddressSchema,
  walletNetworkId: z.string().min(1).max(64),
  walletProvider: z.string().min(1).max(64),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  character: bantahElizaCharacterSchema,
});

export type BantahElizaCharacter = z.infer<typeof bantahElizaCharacterSchema>;
export type BantahElizaRuntimeConfig = z.infer<typeof bantahElizaRuntimeConfigSchema>;
