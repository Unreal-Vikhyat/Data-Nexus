/**
 * activity.schemas.js
 *
 * Zod validation schemas for workspace activity & audit log queries.
 */

import { z } from "zod";

export const activityWorkspaceParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const listActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  action: z.string().trim().min(1).max(120).optional(),
  entityType: z.string().trim().min(1).max(60).optional(),
});
