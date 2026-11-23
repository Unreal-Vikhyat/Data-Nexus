/**
 * activity.routes.js
 *
 * Express routes for workspace activity & audit log queries.
 */

import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeWorkspace } from "../middleware/authorize-workspace.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  activityWorkspaceParamsSchema,
  listActivityQuerySchema,
} from "../schemas/activity.schemas.js";
import * as controller from "../controllers/activity.controller.js";

const router = Router();
router.use(authenticate);

// List workspace activity logs (members with 'viewer' role or above)
router.get(
  "/workspaces/:workspaceId/activity",
  validate(activityWorkspaceParamsSchema, "params"),
  validate(listActivityQuerySchema, "query"),
  authorizeWorkspace("viewer"),
  asyncHandler(controller.listActivity),
);

export default router;
