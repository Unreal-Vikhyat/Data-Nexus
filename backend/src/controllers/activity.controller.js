/**
 * activity.controller.js
 *
 * HTTP handlers for workspace activity & audit log queries.
 */

import * as activityService from "../services/activity.service.js";

export async function listActivity(req, res) {
  const data = await activityService.listActivityLogs(
    req.auth.userId,
    req.params.workspaceId,
    req.query,
  );
  res.json({ success: true, message: "Workspace activity logs", data });
}
