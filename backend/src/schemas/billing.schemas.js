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
