import { z } from "zod";

const uuidParam = z.string().uuid();

// ─── Route params ────────────────────────────────

export const assistantParamsSchema = z.object({
  workspaceId: uuidParam,
  datasetId: uuidParam,
});

export const sessionParamsSchema = z.object({
  workspaceId: uuidParam,
  sessionId: uuidParam,
});

export const sessionsListParamsSchema = z.object({
  workspaceId: uuidParam,
});

// ─── Ask a question ──────────────────────────────

export const askQuestionSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  sessionId: uuidParam.optional(),
});

// ─── Query params for sessions list ──────────────

export const sessionsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

