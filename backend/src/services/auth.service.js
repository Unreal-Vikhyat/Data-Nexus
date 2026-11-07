import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { withNewTenantTransaction, withTransaction, withUserTransaction } from "../database/transaction.js";
import { hashSecret, newId, newSecret } from "../utils/crypto.js";
import { durationMilliseconds } from "../utils/duration.js";
import { sendAccountLink } from "./email.service.js";

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function validatePasswordSize(password) {
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw httpError(400, "VALIDATION_ERROR", "Password must be at most 72 UTF-8 bytes");
  }
}

async function createSession(user, client) {
  const sessionId = newId();
  const jti = newSecret();
  const expiresAt = new Date(Date.now() + durationMilliseconds(env.JWT_EXPIRES_IN));
  await client.query(
    `INSERT INTO auth_sessions (id, user_id, token_id_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [sessionId, user.id, hashSecret(jti), expiresAt],
  );
  const token = jwt.sign({ sid: sessionId, jti }, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN,
  });
  return { token, expiresAt };
}

export function sessionCookieOptions(maxAge = durationMilliseconds(env.JWT_EXPIRES_IN)) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/v1",
    maxAge,
  };
}

export async function register({ name, companyName, email, password }) {
  validatePasswordSize(password);
  const userId = newId();
  const organizationId = newId();
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await withNewTenantTransaction(userId, organizationId, async (client) => {
      await client.query(
        "INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)",
        [userId, name.trim(), email.toLowerCase(), passwordHash],
      );
      await client.query(
        "INSERT INTO organizations (id, name, created_by) VALUES ($1, $2, $3)",
        [organizationId, companyName.trim(), userId],
      );
      await client.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role)
         VALUES ($1, $2, $3, 'owner')`,
        [newId(), organizationId, userId],
      );
    });
  } catch (error) {
    if (error.code === "23505") throw httpError(409, "EMAIL_IN_USE", "An account with this email already exists");
    throw error;
  }
  return {
    user: { id: userId, name: name.trim(), email: email.toLowerCase() },
    workspace: { id: organizationId, name: companyName.trim(), role: "owner" },
  };
}

export async function login({ email, password }) {
  const user = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT user_id AS id, user_name AS name, user_email AS email,
              user_password_hash AS password_hash, user_disabled_at AS disabled_at
       FROM app.lookup_user_for_auth($1)`, [email.toLowerCase()],
    );
    return result.rows[0];
  });
  if (!user || user.disabled_at || !(await bcrypt.compare(password, user.password_hash))) {
    throw httpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  const session = await withUserTransaction(user.id, (client) => createSession(user, client));
  const workspaces = await withUserTransaction(user.id, async (client) => {
    const result = await client.query(
      `SELECT o.id, o.name, m.role
       FROM organization_members m JOIN organizations o ON o.id = m.organization_id
       WHERE m.user_id = $1 AND m.status = 'active'
       ORDER BY m.created_at`, [user.id],
    );
    return result.rows;
  });
  return {
    ...session,
    user: { id: user.id, name: user.name, email: user.email },
    workspaces,
  };
}

export async function getCurrentUser(userId) {
  return withUserTransaction(userId, async (client) => {
    const result = await client.query(
      `SELECT u.id, u.name, u.email, u.created_at,
              COALESCE(json_agg(json_build_object('id', o.id, 'name', o.name, 'role', m.role))
                FILTER (WHERE o.id IS NOT NULL), '[]'::json) AS workspaces
       FROM users u
       LEFT JOIN organization_members m ON m.user_id = u.id AND m.status = 'active'
       LEFT JOIN organizations o ON o.id = m.organization_id
       WHERE u.id = $1 GROUP BY u.id`, [userId],
    );
    return result.rows[0];
  });
}

export async function revokeSession(userId, sessionId) {
  await withUserTransaction(userId, (client) => client.query(
    `UPDATE auth_sessions SET revoked_at = now()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`, [sessionId, userId],
  ));
}

export async function requestPasswordReset(email) {
  if (env.NODE_ENV === "production" && !env.SMTP_URL) {
    throw httpError(503, "EMAIL_NOT_CONFIGURED", "Password reset email is unavailable");
  }
  const user = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT user_id AS id, user_email AS email FROM app.lookup_user_for_auth($1)
       WHERE user_disabled_at IS NULL`, [email.toLowerCase()],
    );
    return result.rows[0];
  });
  if (!user) return { accepted: true };
  const token = newSecret();
  const resetId = newId();
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_MINUTES * 60_000);
  await withUserTransaction(user.id, (client) => client.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`, [resetId, user.id, hashSecret(token), expiresAt],
  ));
  const url = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
  let delivery;
  try {
    delivery = await sendAccountLink({ to: user.email, subject: "Reset your Data Nexus password", url, action: "reset your password" });
  } catch (error) {
    await withUserTransaction(user.id, (client) => client.query("DELETE FROM password_reset_tokens WHERE id = $1", [resetId]));
    throw error;
  }
  return { accepted: true, ...(delivery.developmentUrl ? { developmentResetUrl: delivery.developmentUrl } : {}) };
}

export async function resetPassword({ token, password }) {
  validatePasswordSize(password);
  const hashedToken = hashSecret(token);
  const lookup = await withUserTransaction("00000000-0000-0000-0000-000000000000", async (client) => {
    const result = await client.query("SELECT reset_id AS id, reset_user_id AS user_id FROM app.lookup_password_reset_token($1)", [hashedToken]);
    return result.rows[0];
  });
  if (!lookup) throw httpError(400, "INVALID_RESET_TOKEN", "Password reset link is invalid or expired");
  const passwordHash = await bcrypt.hash(password, 12);
  await withUserTransaction(lookup.user_id, async (client) => {
    const consumed = await client.query(
      `UPDATE password_reset_tokens SET used_at = now()
       WHERE id = $1 AND user_id = $2 AND used_at IS NULL AND expires_at > now() RETURNING id`,
      [lookup.id, lookup.user_id],
    );
    if (!consumed.rowCount) throw httpError(400, "INVALID_RESET_TOKEN", "Password reset link is invalid or expired");
    await client.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [passwordHash, lookup.user_id]);
    await client.query("UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [lookup.user_id]);
  });
  return { reset: true };
}
