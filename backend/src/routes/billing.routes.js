/**
 * billing.routes.js
 *
 * Express routes for credit wallet balance, transactions, and manual adjustments.
 */

import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeWorkspace } from "../middleware/authorize-workspace.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  billingWorkspaceParamsSchema,
  listTransactionsQuerySchema,
  manualCreditSchema,
} from "../schemas/billing.schemas.js";
import * as controller from "../controllers/billing.controller.js";

const router = Router();
router.use(authenticate);

// 1. Get current credit wallet balance
router.get(
  "/workspaces/:workspaceId/billing/wallet",
  validate(billingWorkspaceParamsSchema, "params"),
  authorizeWorkspace("viewer"),
  asyncHandler(controller.getWallet),
);

// 2. Get transaction history with employee tracking
router.get(
  "/workspaces/:workspaceId/billing/transactions",
  validate(billingWorkspaceParamsSchema, "params"),
  validate(listTransactionsQuerySchema, "query"),
  authorizeWorkspace("viewer"),
  asyncHandler(controller.listTransactions),
);

// 3. Manual administrative credit top-up (owner only)
router.post(
  "/workspaces/:workspaceId/billing/wallet/credit",
  validate(billingWorkspaceParamsSchema, "params"),
  validate(manualCreditSchema),
  authorizeWorkspace("owner"),
  asyncHandler(controller.addManualCredits),
);

export default router;
