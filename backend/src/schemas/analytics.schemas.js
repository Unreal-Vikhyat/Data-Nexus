import { z } from "zod";

// ─── Shared primitives ───────────────────────────

const uuidParam = z.string().uuid();

const aggregation = z.enum(["COUNT", "SUM", "AVG", "MIN", "MAX"]);

const sortDirection = z.enum(["ASC", "DESC"]).default("ASC");

const filterOperator = z.enum([
  "eq", "neq", "gt", "gte", "lt", "lte",
  "in", "not_in", "like", "is_null", "is_not_null",
]);

const filterValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number()])),
]);

const filterClause = z.object({
  column: z.string().min(1).max(128),
  operator: filterOperator,
  value: filterValue.optional(),
}).refine(
  (f) => {
    if (f.operator === "is_null" || f.operator === "is_not_null") return true;
    if (f.operator === "in" || f.operator === "not_in") return Array.isArray(f.value);
    return f.value !== undefined && f.value !== null;
  },
  { message: "Filter value is required for the given operator" },
);

const sortClause = z.object({
  column: z.string().min(1).max(128),
  direction: sortDirection,
});

// ─── Route params ────────────────────────────────

export const analyticsParamsSchema = z.object({
  workspaceId: uuidParam,
  datasetId: uuidParam,
});

// ─── Generic analytics query ─────────────────────

export const analyticsQuerySchema = z.object({
  select: z.array(z.object({
    column: z.string().min(1).max(128),
    aggregation: aggregation.optional(),
    alias: z.string().min(1).max(128).optional(),
  })).min(1).max(20),
  filters: z.array(filterClause).max(20).default([]),
  groupBy: z.array(z.string().min(1).max(128)).max(10).default([]),
  orderBy: z.array(sortClause).max(5).default([]),
  limit: z.coerce.number().int().min(1).max(10000).default(500),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── KPI request ─────────────────────────────────

export const kpiQuerySchema = z.object({
  metrics: z.array(z.object({
    column: z.string().min(1).max(128),
    aggregation: aggregation,
    alias: z.string().min(1).max(128).optional(),
  })).min(1).max(10),
  filters: z.array(filterClause).max(20).default([]),
});

// ─── Chart data request ──────────────────────────

export const chartQuerySchema = z.object({
  chartType: z.enum(["bar", "line", "pie", "area"]),
  categoryColumn: z.string().min(1).max(128),
  valueColumns: z.array(z.object({
    column: z.string().min(1).max(128),
    aggregation: aggregation,
    alias: z.string().min(1).max(128).optional(),
  })).min(1).max(5),
  filters: z.array(filterClause).max(20).default([]),
  orderBy: z.array(sortClause).max(3).default([]),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

