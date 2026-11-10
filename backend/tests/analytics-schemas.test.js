/**
 * analytics-schemas.test.js
 *
 * Tests for Zod validation schemas used by the analytics engine.
 */

import {
  analyticsQuerySchema,
  kpiQuerySchema,
  chartQuerySchema,
  analyticsParamsSchema,
} from "../src/schemas/analytics.schemas.js";

describe("analyticsParamsSchema", () => {
  test("accepts valid UUIDs", () => {
    const result = analyticsParamsSchema.safeParse({
      workspaceId: "550e8400-e29b-41d4-a716-446655440000",
      datasetId: "550e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid UUIDs", () => {
    const result = analyticsParamsSchema.safeParse({
      workspaceId: "not-a-uuid",
      datasetId: "also-not-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("analyticsQuerySchema", () => {
  test("accepts valid query with select", () => {
    const result = analyticsQuerySchema.safeParse({
      select: [{ column: "region" }],
    });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(500); // default
    expect(result.data.offset).toBe(0); // default
    expect(result.data.filters).toEqual([]); // default
  });

  test("accepts query with aggregation", () => {
    const result = analyticsQuerySchema.safeParse({
      select: [{ column: "price", aggregation: "SUM", alias: "total_price" }],
      groupBy: ["region"],
    });
    expect(result.success).toBe(true);
  });

  test("accepts query with filters", () => {
    const result = analyticsQuerySchema.safeParse({
      select: [{ column: "region" }],
      filters: [
        { column: "price", operator: "gte", value: 100 },
        { column: "region", operator: "in", value: ["North", "South"] },
        { column: "deleted_at", operator: "is_null" },
      ],
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty select", () => {
    const result = analyticsQuerySchema.safeParse({
      select: [],
    });
    expect(result.success).toBe(false);
  });

  test("rejects too many select columns", () => {
    const select = Array.from({ length: 21 }, (_, i) => ({ column: `col${i}` }));
    const result = analyticsQuerySchema.safeParse({ select });
    expect(result.success).toBe(false);
  });

  test("rejects invalid aggregation", () => {
    const result = analyticsQuerySchema.safeParse({
      select: [{ column: "price", aggregation: "MEDIAN" }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects limit above max", () => {
    const result = analyticsQuerySchema.safeParse({
      select: [{ column: "region" }],
      limit: 999999,
    });
    expect(result.success).toBe(false);
  });

  test("enforces filter value requirements", () => {
    // eq requires a value
    const result1 = analyticsQuerySchema.safeParse({
      select: [{ column: "region" }],
      filters: [{ column: "price", operator: "eq" }],
    });
    expect(result1.success).toBe(false);

    // is_null does not require value
    const result2 = analyticsQuerySchema.safeParse({
      select: [{ column: "region" }],
      filters: [{ column: "price", operator: "is_null" }],
    });
    expect(result2.success).toBe(true);

    // in requires array value
    const result3 = analyticsQuerySchema.safeParse({
      select: [{ column: "region" }],
      filters: [{ column: "region", operator: "in", value: "North" }],
    });
    expect(result3.success).toBe(false);
  });
});

describe("kpiQuerySchema", () => {
  test("accepts valid KPI metrics", () => {
    const result = kpiQuerySchema.safeParse({
      metrics: [
        { column: "quantity", aggregation: "SUM" },
        { column: "price", aggregation: "AVG", alias: "avg_price" },
      ],
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty metrics", () => {
    const result = kpiQuerySchema.safeParse({ metrics: [] });
    expect(result.success).toBe(false);
  });

  test("rejects too many metrics", () => {
    const metrics = Array.from({ length: 11 }, (_, i) => ({
      column: `col${i}`, aggregation: "COUNT",
    }));
    const result = kpiQuerySchema.safeParse({ metrics });
    expect(result.success).toBe(false);
  });
});

describe("chartQuerySchema", () => {
  test("accepts valid chart query", () => {
    const result = chartQuerySchema.safeParse({
      chartType: "bar",
      categoryColumn: "region",
      valueColumns: [{ column: "quantity", aggregation: "SUM" }],
    });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(50); // default
  });

  test("rejects invalid chart type", () => {
    const result = chartQuerySchema.safeParse({
      chartType: "scatter",
      categoryColumn: "region",
      valueColumns: [{ column: "quantity", aggregation: "SUM" }],
    });
    expect(result.success).toBe(false);
  });

  test("accepts all valid chart types", () => {
    for (const chartType of ["bar", "line", "pie", "area"]) {
      const result = chartQuerySchema.safeParse({
        chartType,
        categoryColumn: "region",
        valueColumns: [{ column: "quantity", aggregation: "SUM" }],
      });
      expect(result.success).toBe(true);
    }
  });

  test("rejects empty value columns", () => {
    const result = chartQuerySchema.safeParse({
      chartType: "bar",
      categoryColumn: "region",
      valueColumns: [],
    });
    expect(result.success).toBe(false);
  });
});

