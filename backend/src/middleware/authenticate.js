import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { withUserTransaction } from "../database/transaction.js";
import { hashSecret } from "../utils/crypto.js";

function unauthorized() {
  const error = new Error("Authentication required");
  error.status = 401;
  error.code = "UNAUTHENTICATED";
  return error;
}

export async function authenticate(req, _res, next) {
  try {
    const token = req.cookies?.[env.COOKIE_NAME];
    if (!token) throw unauthorized();
    const claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof claims.sub !== "string" || typeof claims.sid !== "string" || typeof claims.jti !== "string") throw unauthorized();
    const auth = await withUserTransaction(claims.sub, async (client) => {
      const result = await client.query(
        `SELECT s.id, s.expires_at, s.revoked_at, u.id AS user_id, u.name, u.email
         FROM auth_sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.user_id = $2 AND s.token_id_hash = $3`,
        [claims.sid, claims.sub, hashSecret(claims.jti)],
      );
      return result.rows[0];
    });
    if (!auth || auth.revoked_at || new Date(auth.expires_at) <= new Date()) throw unauthorized();
    req.auth = { userId: auth.user_id, sessionId: auth.id, name: auth.name, email: auth.email };
    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") return next(unauthorized());
    return next(error);
  }
}
