import { withTenantTransaction } from "../database/transaction.js";
import { roleMeetsMinimum } from "../utils/roles.js";

export function authorizeWorkspace(minimumRole = "viewer", idParam = "workspaceId") {
  return async (req, _res, next) => {
    try {
      const workspaceId = req.params[idParam];
      if (!workspaceId) throw new Error("Workspace route parameter is missing");
      const role = await withTenantTransaction(req.auth.userId, workspaceId, async (client) => {
        const result = await client.query(
          "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = 'active'",
          [workspaceId, req.auth.userId],
        );
        return result.rows[0]?.role;
      });
      if (!roleMeetsMinimum(role, minimumRole)) {
        const error = new Error("You do not have permission to perform this action");
        error.status = 403;
        error.code = "FORBIDDEN";
        throw error;
      }
      req.workspace = { id: workspaceId, role };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
