import { z } from "zod";

export const bantahBroWalletTokenSchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  address: z.string().trim().min(2).max(128).nullable(),
  decimals: z.number().int().min(0).max(36),
  isNative: z.boolean(),
  label: z.string().trim().min(1).max(120),
  priceUsd: z.string().trim().min(1).max(80).optional().nullable(),
});

export const bantahBroWalletActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("send"),
    chainId: z.number().int().positive(),
    chainLabel: z.string().trim().min(1).max(80),
    amount: z.string().trim().min(1).max(80),
    tokenQuery: z.string().trim().min(1).max(120),
    recipientAddress: z.string().trim().min(1).max(128),
    recipientLabel: z.string().trim().min(1).max(120),
    summary: z.string().trim().min(1).max(240),
  }),
  z.object({
    kind: z.literal("approve"),
    chainId: z.number().int().positive(),
    chainLabel: z.string().trim().min(1).max(80),
    amount: z.string().trim().min(1).max(80),
    tokenQuery: z.string().trim().min(1).max(120),
    spender: z.string().trim().min(8).max(128),
    summary: z.string().trim().min(1).max(240),
  }),
  z.object({
    kind: z.literal("revoke"),
    chainId: z.number().int().positive(),
    chainLabel: z.string().trim().min(1).max(80),
    tokenQuery: z.string().trim().min(1).max(120),
    spender: z.string().trim().min(8).max(128),
    summary: z.string().trim().min(1).max(240),
  }),
  z.object({
    kind: z.literal("swap"),
    chainId: z.number().int().positive(),
    chainLabel: z.string().trim().min(1).max(80),
    mode: z.enum(["buy", "sell", "swap"]),
    sellTokenQuery: z.string().trim().min(1).max(120),
    buyTokenQuery: z.string().trim().min(1).max(120),
    sellAmount: z.string().trim().min(1).max(80).optional(),
    notionalUsd: z.string().trim().min(1).max(80).optional(),
    sellPercent: z.number().positive().max(100).optional(),
    summary: z.string().trim().min(1).max(240),
  }),
  z.object({
    kind: z.literal("bridge"),
    fromChainId: z.number().int().positive(),
    fromChainLabel: z.string().trim().min(1).max(80),
    toChainId: z.number().int().positive(),
    toChainLabel: z.string().trim().min(1).max(80),
    amount: z.string().trim().min(1).max(80),
    tokenQuery: z.string().trim().min(1).max(120),
    toTokenQuery: z.string().trim().min(1).max(120).optional(),
    summary: z.string().trim().min(1).max(240),
  }),
]);

export type BantahBroWalletAction = z.infer<typeof bantahBroWalletActionSchema>;

export const bantahBroWalletPrepareRequestSchema = z.object({
  action: bantahBroWalletActionSchema,
  walletAddress: z.string().trim().min(8).max(128).optional().nullable(),
});

export const bantahBroPreparedWalletActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("send"),
    chainId: z.number().int().positive(),
    chainLabel: z.string().trim().min(1).max(80),
    amount: z.string().trim().min(1).max(80),
    amountAtomic: z.string().trim().min(1).max(120),
    token: bantahBroWalletTokenSchema,
    recipientAddress: z.string().trim().min(8).max(128),
    recipientLabel: z.string().trim().min(1).max(120),
    summary: z.string().trim().min(1).max(240),
  }),
  z.object({
    kind: z.literal("approve"),
    chainId: z.number().int().positive(),
    chainLabel: z.string().trim().min(1).max(80),
    amount: z.string().trim().min(1).max(80),
    amountAtomic: z.string().trim().min(1).max(120),
    token: bantahBroWalletTokenSchema,
    spender: z.string().trim().min(8).max(128),
    summary: z.string().trim().min(1).max(240),
  }),
  z.object({
    kind: z.literal("revoke"),
    chainId: z.number().int().positive(),
    chainLabel: z.string().trim().min(1).max(80),
    amountAtomic: z.string().trim().min(1).max(120),
    token: bantahBroWalletTokenSchema,
    spender: z.string().trim().min(8).max(128),
    summary: z.string().trim().min(1).max(240),
  }),
  z.object({
    kind: z.literal("swap"),
    chainId: z.number().int().positive(),
    chainLabel: z.string().trim().min(1).max(80),
    mode: z.enum(["buy", "sell", "swap"]),
    summary: z.string().trim().min(1).max(240),
    sellToken: bantahBroWalletTokenSchema,
    buyToken: bantahBroWalletTokenSchema,
    sellAmount: z.string().trim().min(1).max(80),
    sellAmountAtomic: z.string().trim().min(1).max(120),
    estimatedBuyAmount: z.string().trim().min(1).max(120),
    quote: z.object({
      allowanceTarget: z.string().trim().min(8).max(128).nullable(),
      transaction: z.object({
        to: z.string().trim().min(8).max(128),
        data: z.string().trim().min(2).max(20000),
        value: z.string().trim().min(1).max(120).nullable(),
      }),
      priceImpactBps: z.string().trim().min(1).max(80).optional().nullable(),
      minBuyAmount: z.string().trim().min(1).max(120).optional().nullable(),
    }),
  }),
  z.object({
    kind: z.literal("bridge"),
    fromChainId: z.number().int().positive(),
    fromChainLabel: z.string().trim().min(1).max(80),
    toChainId: z.number().int().positive(),
    toChainLabel: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(240),
    token: bantahBroWalletTokenSchema,
    destinationToken: bantahBroWalletTokenSchema,
    amount: z.string().trim().min(1).max(80),
    amountAtomic: z.string().trim().min(1).max(120),
    estimatedReceivedAmount: z.string().trim().min(1).max(120),
    quote: z.object({
      allowanceTarget: z.string().trim().min(8).max(128).nullable(),
      transaction: z.object({
        to: z.string().trim().min(8).max(128),
        data: z.string().trim().min(2).max(20000),
        value: z.string().trim().min(1).max(120).nullable(),
      }),
      minReceiveAmount: z.string().trim().min(1).max(120).optional().nullable(),
    }),
  }),
]);

export type BantahBroPreparedWalletAction = z.infer<typeof bantahBroPreparedWalletActionSchema>;
