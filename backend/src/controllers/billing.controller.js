/**
 * billing.controller.js
 *
 * HTTP handlers for credit wallets, credit packs, and Razorpay payments.
 */

import { CREDIT_PACKS } from "../config/credits.config.js";
import { env } from "../config/env.js";
import * as razorpayService from "../services/razorpay.service.js";
import * as walletService from "../services/wallet.service.js";

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

// 1. Get current wallet balance
export async function getWallet(req, res) {
  const data = await walletService.getWallet(req.auth.userId, req.params.workspaceId);
  res.json({ success: true, message: "Workspace credit wallet", data });
}

// 2. Get transaction history
export async function listTransactions(req, res) {
  const data = await walletService.listTransactions(req.auth.userId, req.params.workspaceId, req.query);
  res.json({ success: true, message: "Wallet transaction ledger", data });
}

// 3. Manual administrative credit adjustment
export async function addManualCredits(req, res) {
  const data = await walletService.creditWallet(req.auth.userId, req.params.workspaceId, {
    amount: req.body.amount,
    referenceType: "manual",
    description: req.body.description || "Manual credit adjustment",
  });
  res.json({ success: true, message: "Credits added", data });
}

// 4. List available credit packs for purchase
export async function listCreditPacks(_req, res) {
  res.json({ success: true, data: CREDIT_PACKS });
}

// 5. Create a Razorpay Order
export async function createOrder(req, res) {
  const { packId } = req.body;
  const pack = CREDIT_PACKS.find((p) => p.id === packId);

  if (!pack) {
    throw httpError(400, "INVALID_PACK", "Selected credit pack does not exist");
  }

  const receipt = `rcpt_${req.params.workspaceId.slice(0, 8)}_${Date.now()}`;
  const order = await razorpayService.createRazorpayOrder({
    amountInPaise: pack.priceInPaise,
    currency: pack.currency,
    receipt,
    notes: {
      workspaceId: req.params.workspaceId,
      userId: req.auth.userId,
      packId: pack.id,
      credits: String(pack.credits),
    },
  });

  res.json({
    success: true,
    message: "Razorpay order created",
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.RAZORPAY_KEY_ID,
      pack,
    },
  });
}

// 6. Verify payment signature & credit the wallet
export async function verifyPayment(req, res) {
  const { orderId, paymentId, signature, packId } = req.body;
  const pack = CREDIT_PACKS.find((p) => p.id === packId);

  if (!pack) {
    throw httpError(400, "INVALID_PACK", "Selected credit pack does not exist");
  }

  // Cryptographic signature check
  const isValid = razorpayService.verifyPaymentSignature({
    orderId,
    paymentId,
    signature,
  });

  if (!isValid) {
    throw httpError(400, "INVALID_SIGNATURE", "Payment verification failed: Invalid cryptographic signature");
  }

  // Atomically credit the organization wallet (idempotent: prevents duplicate credits)
  const data = await walletService.creditWallet(req.auth.userId, req.params.workspaceId, {
    amount: pack.credits,
    referenceType: "razorpay_payment",
    referenceId: paymentId,
    idempotencyKey: `rzp_${paymentId}`,
    description: `Purchased ${pack.name} (${pack.credits} credits)`,
    metadata: {
      orderId,
      paymentId,
      packId,
      amountInPaise: pack.priceInPaise,
      currency: pack.currency,
    },
  });

  res.json({
    success: true,
    message: "Payment successfully verified and credits added to wallet",
    data,
  });
}