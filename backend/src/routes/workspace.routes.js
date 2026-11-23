import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeWorkspace } from "../middleware/authorize-workspace.js";
import { validate } from "../middleware/validate.js";
import { acceptInvitationSchema, invitationSchema, memberIdSchema, roleUpdateSchema, workspaceCreateSchema, workspaceIdSchema, workspaceUpdateSchema } from "../schemas/workspace.schemas.js";
import { asyncHandler } from "../utils/async-handler.js";
import * as controller from "../controllers/workspace.controller.js";

const router = Router();
router.use(authenticate);
router.get("/workspaces", asyncHandler(controller.list));
router.post("/workspaces", validate(workspaceCreateSchema), asyncHandler(controller.create));
router.get("/workspaces/:workspaceId", validate(workspaceIdSchema, "params"), authorizeWorkspace("viewer"), asyncHandler(controller.get));
router.patch("/workspaces/:workspaceId", validate(workspaceIdSchema, "params"), validate(workspaceUpdateSchema), authorizeWorkspace("admin"), asyncHandler(controller.update));
router.get("/workspaces/:workspaceId/members", validate(workspaceIdSchema, "params"), authorizeWorkspace("viewer"), asyncHandler(controller.members));
router.post("/workspaces/:workspaceId/invitations", validate(workspaceIdSchema, "params"), validate(invitationSchema), authorizeWorkspace("admin"), asyncHandler(controller.invite));
router.patch("/workspaces/:workspaceId/members/:memberId", validate(memberIdSchema, "params"), validate(roleUpdateSchema), authorizeWorkspace("admin"), asyncHandler(controller.updateMember));
router.delete("/workspaces/:workspaceId/members/:memberId", validate(memberIdSchema, "params"), authorizeWorkspace("admin"), asyncHandler(controller.removeMember));
router.post("/invitations/accept", validate(acceptInvitationSchema), asyncHandler(controller.acceptInvitation));

export default router;
