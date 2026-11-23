/**
 * analytics.routes.js
 *
 * Routes for the generic analytics engine.
 * All routes require authentication and workspace authorization (viewer+).
 */

import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeWorkspace } from "../middleware/authorize-workspace.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  analyticsParamsSchema,
  analyticsQuerySchema,
  kpiQuerySchema,
  chartQuerySchema,
} from "../schemas/analytics.schemas.js";
import * as controller from "../controllers/analytics.controller.js";

const router = Router();
router.use(authenticate);

// Generic analytics query
router.post(
  "/workspaces/:workspaceId/datasets/:datasetId/analytics/query",
  validate(analyticsParamsSchema, "params"),
  validate(analyticsQuerySchema),
  authorizeWorkspace("viewer"),
  asyncHandler(controller.query),
);

// Dynamic KPI
router.post(
  "/workspaces/:workspaceId/datasets/:datasetId/analytics/kpi",
  validate(analyticsParamsSchema, "params"),
  validate(kpiQuerySchema),
  authorizeWorkspace("viewer"),
  asyncHandler(controller.kpi),
);

// Chart data
router.post(
  "/workspaces/:workspaceId/datasets/:datasetId/analytics/chart",
  validate(analyticsParamsSchema, "params"),
  validate(chartQuerySchema),
  authorizeWorkspace("viewer"),
  asyncHandler(controller.chart),
);

// Dataset summary
router.get(
  "/workspaces/:workspaceId/datasets/:datasetId/analytics/summary",
  validate(analyticsParamsSchema, "params"),
  authorizeWorkspace("viewer"),
  asyncHandler(controller.summary),
);

export default router;

