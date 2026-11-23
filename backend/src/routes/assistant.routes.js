/**
 * assistant.routes.js
 *
 * Routes for the AI data assistant and conversation history.
 * All routes require authentication and workspace authorization.
 */

import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeWorkspace } from "../middleware/authorize-workspace.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  assistantParamsSchema,
  sessionParamsSchema,
  sessionsListParamsSchema,
  askQuestionSchema,
  sessionsListQuerySchema,
} from "../schemas/assistant.schemas.js";
import * as controller from "../controllers/assistant.controller.js";

const router = Router();
router.use(authenticate);

// Ask a question about a dataset
router.post(
  "/workspaces/:workspaceId/datasets/:datasetId/assistant/ask",
  validate(assistantParamsSchema, "params"),
  validate(askQuestionSchema),
  authorizeWorkspace("viewer"),
  asyncHandler(controller.ask),
);

// List conversation sessions
router.get(
  "/workspaces/:workspaceId/assistant/sessions",
  validate(sessionsListParamsSchema, "params"),
  validate(sessionsListQuerySchema, "query"),
  authorizeWorkspace("viewer"),
  asyncHandler(controller.listSessions),
);

// Get a specific session
router.get(
  "/workspaces/:workspaceId/assistant/sessions/:sessionId",
  validate(sessionParamsSchema, "params"),
  authorizeWorkspace("viewer"),
  asyncHandler(controller.getSession),
);

// Get session messages
router.get(
  "/workspaces/:workspaceId/assistant/sessions/:sessionId/messages",
  validate(sessionParamsSchema, "params"),
  authorizeWorkspace("viewer"),
  asyncHandler(controller.getSessionMessages),
);

// Delete a session
router.delete(
  "/workspaces/:workspaceId/assistant/sessions/:sessionId",
  validate(sessionParamsSchema, "params"),
  authorizeWorkspace("editor"),
  asyncHandler(controller.deleteSession),
);

export default router;

