/**
 * report.schemas.js
 *
 * Zod validation schema for report export endpoints.
 */

import { z } from "zod";

export const reportWorkspaceParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const reportDatasetParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  datasetId: z.string().uuid(),
});

export const exportReportSchema = z.object({
  format: z.enum(["pdf", "csv", "xlsx"]).default("pdf"),
  title: z.string().trim().min(1).max(200).optional(),
  subtitle: z.string().trim().max(500).optional(),
  datasetId: z.string().uuid().optional(),
  summaryMetrics: z.array(z.object({
    label: z.string().trim().min(1).max(100),
    value: z.union([z.string(), z.number()]),
  })).max(10).optional().default([]),
  customColumns: z.array(z.string().trim().min(1).max(128)).max(100).optional(),
  customRows: z.array(z.union([z.array(z.any()), z.record(z.string(), z.any())])).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(10000).default(1000),
});
