import { z } from "zod";

export const bantahLauncherSupportedChains = [
  {
    chainId: 8453,
    name: "Base",
    networkId: "base-mainnet",
    explorerBaseUrl: "https://basescan.org",
    envKey: "BANTAH_LAUNCH_FACTORY_BASE_ADDRESS",
  },
  {
    chainId: 42161,
    name: "Arbitrum",
    networkId: "arbitrum-mainnet",
    explorerBaseUrl: "https://arbiscan.io",
    envKey: "BANTAH_LAUNCH_FACTORY_ARBITRUM_ADDRESS",
  },
  {
    chainId: 84532,
    name: "Base Sepolia",
    networkId: "base-sepolia",
    explorerBaseUrl: "https://sepolia.basescan.org",
    envKey: "BANTAH_LAUNCH_FACTORY_BASE_SEPOLIA_ADDRESS",
  },
  {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    networkId: "arbitrum-sepolia",
    explorerBaseUrl: "https://sepolia.arbiscan.io",
    envKey: "BANTAH_LAUNCH_FACTORY_ARBITRUM_SEPOLIA_ADDRESS",
  },
] as const;

export const bantahLauncherSupportedChainIds = bantahLauncherSupportedChains.map(
  (chain) => chain.chainId,
);

export const bantahLauncherAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Address must be a valid EVM address");

export const bantahLauncherDraftRequestSchema = z.object({
  tokenName: z.string().trim().min(2).max(80),
  tokenSymbol: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .regex(/^[A-Za-z0-9]+$/, "Symbol can only contain letters and numbers")
    .transform((value) => value.toUpperCase()),
  chainId: z.coerce
    .number()
    .int()
    .refine((value) => (bantahLauncherSupportedChainIds as readonly number[]).includes(value), {
      message: "Unsupported launcher chain",
    }),
  decimals: z.coerce.number().int().min(0).max(18).default(18),
  initialSupply: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Initial supply must be a positive number")
    .refine((value) => Number(value) > 0, "Initial supply must be greater than zero"),
  ownerAddress: bantahLauncherAddressSchema.optional(),
});

export const bantahLauncherDeployRequestSchema = bantahLauncherDraftRequestSchema.extend({
  ownerAddress: bantahLauncherAddressSchema,
  confirm: z.literal(true, {
    errorMap: () => ({ message: "Deployment requires explicit confirmation" }),
  }),
});

export type BantahLauncherDraftRequest = z.input<typeof bantahLauncherDraftRequestSchema>;
export type BantahLauncherDraft = z.output<typeof bantahLauncherDraftRequestSchema>;
export type BantahLauncherDeployRequest = z.input<typeof bantahLauncherDeployRequestSchema>;
