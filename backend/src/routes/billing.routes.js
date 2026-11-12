/**
 * billing.routes.js
 *
 * Express routes for credit wallet balance, transactions, and Razorpay payments.
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
  createOrderSchema,
  verifyPaymentSchema,
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

// 4. List available credit packs for purchase
router.get(
  "/workspaces/:workspaceId/billing/packs",
  validate(billingWorkspaceParamsSchema, "params"),
  authorizeWorkspace("viewer"),
  asyncHandler(controller.listCreditPacks),
);

// 5. Create Razorpay order to purchase a credit pack
router.post(
  "/workspaces/:workspaceId/billing/orders",
  validate(billingWorkspaceParamsSchema, "params"),
  validate(createOrderSchema),
  authorizeWorkspace("member"),
  asyncHandler(controller.createOrder),
);

// 6. Verify Razorpay payment signature & credit wallet
router.post(
  "/workspaces/:workspaceId/billing/verify",
  validate(billingWorkspaceParamsSchema, "params"),
  validate(verifyPaymentSchema),
  authorizeWorkspace("member"),
  asyncHandler(controller.verifyPayment),
);

export default router;