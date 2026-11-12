/**
 * wallet.service.js
 *
 * Organization credit wallet and double-entry transaction ledger.
 * Guarantees atomic balance adjustments, prevents negative balances,
 * checks balance before heavy operations, and records employee actions.
 */

import { withTenantTransaction } from "../database/transaction.js";
import { newId } from "../utils/crypto.js";
import { logActivity } from "./activity.service.js";
import { WELCOME_CREDIT_BONUS } from "../config/credits.config.js";

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

/**
 * Ensure an organization wallet exists; provisions one with welcome bonus if missing.
 */
export async function getOrCreateWallet(client, organizationId) {
  let result = await client.query(
    `SELECT id, organization_id AS "organizationId", balance::float, currency, updated_at AS "updatedAt"
     FROM organization_wallets WHERE organization_id = $1`,
    [organizationId],
  );

  if (!result.rowCount) {
    const walletId = newId();
    await client.query(
      `INSERT INTO organization_wallets (id, organization_id, balance, currency)
       VALUES ($1, $2, $3, 'INR')
       ON CONFLICT (organization_id) DO NOTHING`,
      [walletId, organizationId, WELCOME_CREDIT_BONUS],
    );

    // Record welcome bonus transaction in ledger
    await client.query(
      `INSERT INTO wallet_transactions (
         id, wallet_id, organization_id, user_id, type, amount, balance_after,
         description, reference_type
       ) VALUES ($1, $2, $3, NULL, 'credit', $4, $4, 'Welcome starter credit bonus', 'bonus')
       ON CONFLICT DO NOTHING`,
      [newId(), walletId, organizationId, WELCOME_CREDIT_BONUS],
    );

    result = await client.query(
      `SELECT id, organization_id AS "organizationId", balance::float, currency, updated_at AS "updatedAt"
       FROM organization_wallets WHERE organization_id = $1`,
      [organizationId],
    );
  }

  return result.rows[0];
}

/**
 * Pre-flight balance check: verifies if an organization has enough credits.
 * Throws 402 Payment Required immediately before executing heavy work.
 */
export async function assertSufficientCredits(client, organizationId, requiredCredits) {
  const parsedCost = Number(requiredCredits);
  if (isNaN(parsedCost) || parsedCost <= 0) return true;

  const wallet = await getOrCreateWallet(client, organizationId);
  if (wallet.balance < parsedCost) {
    throw httpError(
      402,
      "INSUFFICIENT_CREDITS",
      `Insufficient credits. This action requires ${parsedCost} credits, but your current balance is ${wallet.balance}. Please recharge.`,
    );
  }

  return true;
}

/**
 * Get the current credit wallet balance and metadata for a workspace.
 */
export async function getWallet(userId, organizationId) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    return getOrCreateWallet(client, organizationId);
  });
}

/**
 * Atomic credit addition to an organization's wallet.
 * Supports idempotency: if an idempotencyKey is re-submitted, returns the existing record.
 */
export async function creditWallet(userId, organizationId, {
  amount,
  referenceType = "manual",
  referenceId = null,
  idempotencyKey = null,
  description = "Credits added",
  metadata = {},
  client: providedClient = null,
}) {
  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw httpError(400, "INVALID_AMOUNT", "Credit amount must be greater than zero");
  }

  const work = async (client) => {
    // 1. Check idempotency
    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT id, amount::float, balance_after::float AS "balanceAfter", created_at AS "createdAt"
         FROM wallet_transactions WHERE idempotency_key = $1`,
        [idempotencyKey],
      );
      if (existing.rowCount) {
        return {
          idempotent: true,
          transactionId: existing.rows[0].id,
          amount: existing.rows[0].amount,
          balanceAfter: existing.rows[0].balanceAfter,
        };
      }
    }

    // 2. Ensure wallet exists
    const wallet = await getOrCreateWallet(client, organizationId);

    // 3. Atomically update wallet balance
    const updated = await client.query(
      `UPDATE organization_wallets
       SET balance = balance + $1, updated_at = now()
       WHERE organization_id = $2
       RETURNING balance::float`,
      [parsedAmount, organizationId],
    );

    const balanceAfter = updated.rows[0].balance;

    // 4. Record in double-entry transaction ledger with employee tracking
    const txId = newId();
    await client.query(
      `INSERT INTO wallet_transactions (
         id, wallet_id, organization_id, user_id, type, amount, balance_after,
         description, reference_type, reference_id, idempotency_key, metadata
       ) VALUES ($1, $2, $3, $4, 'credit', $5, $6, $7, $8, $9, $10, $11)`,
      [
        txId,
        wallet.id,
        organizationId,
        userId,
        parsedAmount,
        balanceAfter,
        description,
        referenceType,
        referenceId ? String(referenceId) : null,
        idempotencyKey,
        JSON.stringify(metadata),
      ],
    );

    await logActivity({
      organizationId,
      userId,
      action: "wallet.credit",
      entityType: "wallet",
      entityId: txId,
      details: {
        amount: parsedAmount,
        balanceAfter,
        referenceType,
        description,
      },
      client,
    });

    return {
      success: true,
      transactionId: txId,
      amount: parsedAmount,
      balanceAfter,
    };
  };

  if (providedClient) {
    return work(providedClient);
  }
  return withTenantTransaction(userId, organizationId, work);
}

/**
 * Concurrency-safe atomic deduction from an organization's wallet.
 * Fails atomically if balance is less than required amount.
 */
export async function debitWallet(userId, organizationId, {
  amount,
  referenceType = "manual",
  referenceId = null,
  description = "Credits deducted",
  metadata = {},
  client: providedClient = null,
}) {
  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw httpError(400, "INVALID_AMOUNT", "Debit amount must be greater than zero");
  }

  const work = async (client) => {
    // 1. Ensure wallet exists
    const wallet = await getOrCreateWallet(client, organizationId);

    // 2. Concurrency-safe atomic balance deduction
    const updated = await client.query(
      `UPDATE organization_wallets
       SET balance = balance - $1, updated_at = now()
       WHERE organization_id = $2 AND balance >= $1
       RETURNING balance::float`,
      [parsedAmount, organizationId],
    );

    if (!updated.rowCount) {
      throw httpError(
        402,
        "INSUFFICIENT_CREDITS",
        `Insufficient credits. Required: ${parsedAmount}, current balance is ${wallet.balance}. Please recharge.`,
      );
    }

    const balanceAfter = updated.rows[0].balance;

    // 3. Record in double-entry transaction ledger with employee tracking
    const txId = newId();
    await client.query(
      `INSERT INTO wallet_transactions (
         id, wallet_id, organization_id, user_id, type, amount, balance_after,
         description, reference_type, reference_id, metadata
       ) VALUES ($1, $2, $3, $4, 'debit', $5, $6, $7, $8, $9, $10)`,
      [
        txId,
        wallet.id,
        organizationId,
        userId,
        parsedAmount,
        balanceAfter,
        description,
        referenceType,
        referenceId ? String(referenceId) : null,
        JSON.stringify(metadata),
      ],
    );

    await logActivity({
      organizationId,
      userId,
      action: "wallet.debit",
      entityType: "wallet",
      entityId: txId,
      details: {
        amount: parsedAmount,
        balanceAfter,
        referenceType,
        description,
      },
      client,
    });

    return {
      success: true,
      transactionId: txId,
      amount: parsedAmount,
      balanceAfter,
    };
  };

  if (providedClient) {
    return work(providedClient);
  }
  return withTenantTransaction(userId, organizationId, work);
}

/**
 * List paginated transaction ledger history for a workspace, tracking who took each action.
 */
export async function listTransactions(userId, organizationId, { limit = 50, offset = 0, type = null } = {}) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    const conditions = ["t.organization_id = $1"];
    const params = [organizationId];
    let paramIdx = 2;

    if (type) {
      conditions.push(`t.type = $${paramIdx++}`);
      params.push(type);
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await client.query(
      `SELECT count(*)::int AS total FROM wallet_transactions t WHERE ${whereClause}`,
      params,
    );
    const total = countResult.rows[0]?.total || 0;

    const dataParams = [...params, limit, offset];
    const dataResult = await client.query(
      `SELECT t.id, t.type, t.amount::float, t.balance_after::float AS "balanceAfter",
              t.description, t.reference_type AS "referenceType", t.reference_id AS "referenceId",
              t.created_at AS "createdAt",
              u.id AS "userId", u.name AS "userName", u.email AS "userEmail"
       FROM wallet_transactions t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      dataParams,
    );

    return {
      items: dataResult.rows,
      total,
      limit,
      offset,
      hasMore: offset + dataResult.rows.length < total,
    };
  });
}
