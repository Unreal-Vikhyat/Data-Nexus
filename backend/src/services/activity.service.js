/**
 * activity.service.js
 *
 * Enterprise audit logging service.
 * Records workspace-scoped activity events with actor attribution, entity references,
 * timestamps, and sanitized metadata with Row Level Security.
 */

import { withTenantTransaction, withTransaction } from "../database/transaction.js";
import { newId } from "../utils/crypto.js";
import { logger } from "../config/logger.js";

/**
 * Log an activity event. Safe to call from any service; errors are logged without breaking the caller.
 * Accepts an optional database client if already within an active transaction.
 *
 * @param {Object} options
 * @param {string} options.organizationId - Workspace / Tenant ID
 * @param {string|null} [options.userId] - Actor user ID
 * @param {string} options.action - Action identifier (e.g. 'report.export', 'wallet.debit')
 * @param {string} options.entityType - Target entity type (e.g. 'report', 'wallet')
 * @param {string|null} [options.entityId] - Target entity identifier
 * @param {Object} [options.details] - Arbitrary event metadata (passwords/tokens will be stripped)
 * @param {Object|null} [options.req] - Express request object for IP extraction
 * @param {Object|null} [options.client] - Existing pg client if inside a transaction
 */
export async function logActivity({
  organizationId,
  userId = null,
  action,
  entityType,
  entityId = null,
  details = {},
  req = null,
  client = null,
}) {
  const ipAddress = req
    ? req.headers?.["x-forwarded-for"]?.split(",")?.[0]?.trim() || req.socket?.remoteAddress || req.ip || null
    : null;

  // Sanitize details to avoid storing secrets or sensitive credentials
  const sanitizedDetails = { ...details };
  delete sanitizedDetails.password;
  delete sanitizedDetails.token;
  delete sanitizedDetails.secret;
  delete sanitizedDetails.rawBody;
  delete sanitizedDetails.apiKey;

  const logRecord = {
    id: newId(),
    organization_id: organizationId,
    user_id: userId,
    action: action.trim(),
    entity_type: entityType.trim(),
    entity_id: entityId ? String(entityId) : null,
    details: JSON.stringify(sanitizedDetails),
    ip_address: ipAddress,
  };

  const sql = `
    INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, details, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;
  const params = [
    logRecord.id,
    logRecord.organization_id,
    logRecord.user_id,
    logRecord.action,
    logRecord.entity_type,
    logRecord.entity_id,
    logRecord.details,
    logRecord.ip_address,
  ];

  try {
    if (client) {
      await client.query(sql, params);
    } else {
      await withTransaction(async (txClient) => {
        await txClient.query(sql, params);
      });
    }
  } catch (error) {
    logger.warn({ err: error, action, organizationId }, "Failed to record audit activity log");
  }
}

/**
 * List activity logs for an authorized workspace member.
 *
 * @param {string} userId - Requesting user ID (for tenant session verification)
 * @param {string} organizationId - Target workspace ID
 * @param {Object} [options]
 * @param {number} [options.limit=50] - Number of records to return
 * @param {number} [options.offset=0] - Number of records to skip
 * @param {string|null} [options.action] - Optional action filter
 * @param {string|null} [options.entityType] - Optional entity type filter
 */
export async function listActivityLogs(
  userId,
  organizationId,
  { limit = 50, offset = 0, action = null, entityType = null } = {},
) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    const conditions = ["organization_id = $1"];
    const params = [organizationId];
    let paramIdx = 2;

    if (action) {
      conditions.push(`action = $${paramIdx++}`);
      params.push(action);
    }

    if (entityType) {
      conditions.push(`entity_type = $${paramIdx++}`);
      params.push(entityType);
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await client.query(
      `SELECT count(*)::int AS total FROM activity_logs WHERE ${whereClause}`,
      params,
    );
    const total = countResult.rows[0]?.total || 0;

    const dataParams = [...params, limit, offset];
    const dataResult = await client.query(
      `SELECT a.id, a.organization_id AS "organizationId", a.user_id AS "userId",
              u.name AS "userName", u.email AS "userEmail",
              a.action, a.entity_type AS "entityType", a.entity_id AS "entityId",
              a.details, a.ip_address AS "ipAddress", a.created_at AS "createdAt"
       FROM activity_logs a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE ${whereClause}
       ORDER BY a.created_at DESC
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
