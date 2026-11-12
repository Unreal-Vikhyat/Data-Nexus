/**
 * billing.controller.js
 *
 * HTTP handlers for credit wallets and transaction history.
 */

import * as walletService from "../services/wallet.service.js";

export async function getWallet(req, res) {
  const data = await walletService.getWallet(req.auth.userId, req.params.workspaceId);
  res.json({ success: true, message: "Workspace credit wallet", data });
}

export async function listTransactions(req, res) {
  const data = await walletService.listTransactions(req.auth.userId, req.params.workspaceId, req.query);
  res.json({ success: true, message: "Wallet transaction ledger", data });
}

export async function addManualCredits(req, res) {
  const data = await walletService.creditWallet(req.auth.userId, req.params.workspaceId, {
    amount: req.body.amount,
    referenceType: "manual",
    description: req.body.description || "Manual credit adjustment",
  });
  res.json({ success: true, message: "Credits added", data });
}
