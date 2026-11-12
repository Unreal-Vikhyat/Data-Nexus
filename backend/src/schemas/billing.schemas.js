/**
 * billing.schemas.js
 *
 * Zod validation schemas for billing, wallet, and transaction ledger.
 */

import { z } from "zod";

export const billingWorkspaceParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const listTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  type: z.enum(["credit", "debit", "refund", "adjustment"]).optional(),
});

export const manualCreditSchema = z.object({
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(1).max(255).default("Credits added"),
});

export const createOrderSchema = z.object({
  packId: z.enum(["pack_starter", "pack_growth", "pack_scale"]),
});

export const verifyPaymentSchema = z.object({
  orderId: z.string().trim().min(1, "Order ID is required"),
  paymentId: z.string().trim().min(1, "Payment ID is required"),
  signature: z.string().trim().min(1, "Signature is required"),
  packId: z.enum(["pack_starter", "pack_growth", "pack_scale"]),
});