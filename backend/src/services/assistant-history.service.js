/**
 * assistant-history.service.js
 *
 * Manages AI assistant conversation sessions and message history.
 * All queries are tenant-scoped through RLS.
 */

import { withTenantTransaction } from "../database/transaction.js";

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

/**
 * List conversation sessions for the current user in a workspace.
 */
export async function listSessions(userId, organizationId, { limit, offset }) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    const result = await client.query(
      `SELECT s.id, s.title, s.dataset_id AS "datasetId",
              d.name AS "datasetName",
              s.created_at AS "createdAt",
              s.updated_at AS "updatedAt",
              (SELECT COUNT(*)::int FROM assistant_messages m WHERE m.session_id = s.id) AS "messageCount"
       FROM assistant_sessions s
       LEFT JOIN datasets d ON d.id = s.dataset_id
       WHERE s.user_id = $1
       ORDER BY s.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS total FROM assistant_sessions WHERE user_id = $1`,
      [userId],
    );

    return {
      sessions: result.rows,
      total: countResult.rows[0].total,
      limit,
      offset,
    };
  });
}

/**
 * Get a single conversation session with its metadata.
 */
export async function getSession(userId, organizationId, sessionId) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    const result = await client.query(
      `SELECT s.id, s.title, s.dataset_id AS "datasetId",
              d.name AS "datasetName",
              s.created_at AS "createdAt",
              s.updated_at AS "updatedAt"
       FROM assistant_sessions s
       LEFT JOIN datasets d ON d.id = s.dataset_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [sessionId, userId],
    );

    if (!result.rowCount) {
      throw httpError(404, "SESSION_NOT_FOUND", "Conversation session not found");
    }

    return result.rows[0];
  });
}

/**
 * Get all messages in a conversation session.
 */
export async function getSessionMessages(userId, organizationId, sessionId) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    // Verify session belongs to user
    const sessResult = await client.query(
      `SELECT id FROM assistant_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );

    if (!sessResult.rowCount) {
      throw httpError(404, "SESSION_NOT_FOUND", "Conversation session not found");
    }

    const result = await client.query(
      `SELECT id, role, content, query_plan AS "queryPlan",
              result_summary AS "resultSummary",
              created_at AS "createdAt"
       FROM assistant_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId],
    );

    return { messages: result.rows };
  });
}

/**
 * Delete a conversation session and all its messages.
 */
export async function deleteSession(userId, organizationId, sessionId) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    const result = await client.query(
      `DELETE FROM assistant_sessions WHERE id = $1 AND user_id = $2 RETURNING id`,
      [sessionId, userId],
    );

    if (!result.rowCount) {
      throw httpError(404, "SESSION_NOT_FOUND", "Conversation session not found");
    }

    return { deleted: true };
  });
}

