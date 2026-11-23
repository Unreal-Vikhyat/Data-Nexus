/**
 * report.routes.js
 *
 * Express routes for exporting reports in PDF, Excel, and CSV formats.
 */

import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeWorkspace } from "../middleware/authorize-workspace.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  exportReportSchema,
  reportDatasetParamsSchema,
  reportWorkspaceParamsSchema,
} from "../schemas/report.schemas.js";
import * as controller from "../controllers/report.controller.js";

const router = Router();
router.use(authenticate);

// 1. Generic workspace report export (accepts custom tabular data, KPIs, or datasetId)
router.post(
  "/workspaces/:workspaceId/reports/export",
  validate(reportWorkspaceParamsSchema, "params"),
  validate(exportReportSchema),
  authorizeWorkspace("viewer"),
  asyncHandler(controller.exportReport),
);

// 2. Direct dataset report export
router.post(
  "/workspaces/:workspaceId/datasets/:datasetId/reports/export",
  validate(reportDatasetParamsSchema, "params"),
  validate(exportReportSchema),
  authorizeWorkspace("viewer"),
  asyncHandler(controller.exportReport),
);

export default router;
