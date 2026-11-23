import { pool } from "./pool.js";

async function inTransaction(poolOrClient, setup, work) {
  const client = typeof poolOrClient.connect === "function" ? await poolOrClient.connect() : poolOrClient;
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    if (setup) await setup(client);
    const result = await work(client);
    await client.query("COMMIT");
    transactionOpen = false;
    return result;
  } catch (error) {
    if (transactionOpen) {
      try { await client.query("ROLLBACK"); } catch { /* Keep the original failure. */ }
    }
    throw error;
  } finally {
    if (client !== poolOrClient) client.release();
  }
}

export const withTransaction = (work, poolOverride = pool) => inTransaction(poolOverride, null, work);

export function withUserTransaction(userId, work, poolOverride = pool) {
  return inTransaction(poolOverride, (client) => client.query(
    "SELECT set_config('app.current_user_id', $1, true)", [userId],
  ), work);
}

export function withTenantTransaction(userId, organizationId, work, poolOverride = pool) {
  return inTransaction(poolOverride, async (client) => {
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    // Membership lookup runs with user context only. The tenant context is not installed until access is proven.
    const membership = await client.query(
      `SELECT role FROM organization_members
       WHERE user_id = $1 AND organization_id = $2 AND status = 'active'`,
      [userId, organizationId],
    );
    if (membership.rowCount === 0) {
      const error = new Error("Workspace not found");
      error.status = 404;
      error.code = "WORKSPACE_NOT_FOUND";
      throw error;
    }
    await client.query("SELECT set_config('app.current_organization_id', $1, true)", [organizationId]);
  }, work);
}

export function withNewTenantTransaction(userId, organizationId, work, poolOverride = pool) {
  return inTransaction(poolOverride, async (client) => {
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    await client.query("SELECT set_config('app.current_organization_id', $1, true)", [organizationId]);
  }, work);
}

export async function assertRuntimeRole(client) {
  const result = await client.query(`
    SELECT r.rolsuper, r.rolbypassrls,
      EXISTS (
        SELECT 1 FROM pg_roles privileged
        WHERE (privileged.rolsuper OR privileged.rolbypassrls)
          AND pg_has_role(r.rolname, privileged.rolname, 'MEMBER')
      ) AS inherits_bypass,
      EXISTS (
        SELECT 1 FROM pg_roles migrator
        WHERE migrator.rolname = 'nexus_migrator'
          AND pg_has_role(r.rolname, migrator.rolname, 'MEMBER')
      ) AS can_assume_migrator,
      EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'app' AND pg_get_userbyid(c.relowner) = r.rolname AND c.relkind IN ('r', 'p')
      ) AS owns_application_tables,
      EXISTS (
        SELECT 1 FROM pg_namespace n
        WHERE n.nspname = 'app' AND has_schema_privilege(r.rolname, n.nspname, 'CREATE')
      ) AS can_create_application_objects
    FROM pg_roles r WHERE r.rolname = current_user
  `);
  const role = result.rows[0];
  if (result.rowCount !== 1 || role.rolsuper || role.rolbypassrls || role.inherits_bypass
    || role.can_assume_migrator || role.owns_application_tables || role.can_create_application_objects) {
    throw new Error("Runtime database role must be separate from migrations, non-owning, and unable to bypass or alter RLS-protected objects");
  }
}

export async function assertRlsConfiguration(client) {
  const result = await client.query(`
    SELECT count(*)::int AS protected_count,
      bool_and(c.relrowsecurity AND c.relforcerowsecurity) AS all_forced
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app'
      AND c.relname = ANY($1::text[])
      AND c.relkind IN ('r', 'p')
  `, [["organizations", "organization_members", "auth_sessions", "invitations"]]);
  if (result.rows[0].protected_count !== 4 || result.rows[0].all_forced !== true) {
    throw new Error("Database migrations are missing or forced RLS is not enabled on all tenant tables");
  }
}
