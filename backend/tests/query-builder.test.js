/**
 * query-builder.test.js
 *
 * Unit tests for the safe SQL query builder.
 * Validates identifier safety, column validation, filter construction,
 * and parameterized query generation.
 */

import {
  safeIdentifier,
  validateColumn,
  buildAnalyticsQuery,
  buildKpiQuery,
  buildChartQuery,
  buildSummaryQuery,
  buildQueryFromPlan,
} from "../src/services/query-builder.service.js";

// ─── Mock schema columns ─────────────────────────

const mockColumns = [
  { column_name: "region", display_name: "Region", data_type: "text", is_aggregatable: false, is_groupable: true, is_filterable: true },
  { column_name: "product", display_name: "Product", data_type: "text", is_aggregatable: false, is_groupable: true, is_filterable: true },
  { column_name: "quantity", display_name: "Quantity", data_type: "integer", is_aggregatable: true, is_groupable: false, is_filterable: true },
  { column_name: "price", display_name: "Price", data_type: "numeric", is_aggregatable: true, is_groupable: false, is_filterable: true },
  { column_name: "order_date", display_name: "Order Date", data_type: "date", is_aggregatable: false, is_groupable: true, is_filterable: true },
  { column_name: "is_active", display_name: "Active", data_type: "boolean", is_aggregatable: false, is_groupable: true, is_filterable: true },
];

const tableName = "ds_abc123def456abc123def456abc12345";

// ─── safeIdentifier ──────────────────────────────

describe("safeIdentifier", () => {
  test("accepts valid identifiers", () => {
    expect(safeIdentifier("region")).toBe('"region"');
    expect(safeIdentifier("order_date")).toBe('"order_date"');
    expect(safeIdentifier("col1")).toBe('"col1"');
    expect(safeIdentifier("_private")).toBe('"_private"');
  });

  test("rejects SQL injection attempts", () => {
    expect(() => safeIdentifier("'; DROP TABLE users--")).toThrow("Invalid identifier");
    expect(() => safeIdentifier("col; SELECT *")).toThrow("Invalid identifier");
    expect(() => safeIdentifier("col OR 1=1")).toThrow("Invalid identifier");
    expect(() => safeIdentifier("")).toThrow("Invalid identifier");
  });

  test("rejects identifiers with special characters", () => {
    expect(() => safeIdentifier("col-name")).toThrow("Invalid identifier");
    expect(() => safeIdentifier("col.name")).toThrow("Invalid identifier");
    expect(() => safeIdentifier("col name")).toThrow("Invalid identifier");
    expect(() => safeIdentifier("col(name)")).toThrow("Invalid identifier");
  });

  test("rejects identifiers starting with numbers", () => {
    expect(() => safeIdentifier("1col")).toThrow("Invalid identifier");
    expect(() => safeIdentifier("123")).toThrow("Invalid identifier");
  });
});

// ─── validateColumn ──────────────────────────────

describe("validateColumn", () => {
  test("accepts valid column names", () => {
    const col = validateColumn("region", mockColumns);
    expect(col.column_name).toBe("region");
    expect(col.data_type).toBe("text");
  });

  test("rejects non-existent columns", () => {
    expect(() => validateColumn("nonexistent", mockColumns)).toThrow('Column "nonexistent" does not exist');
  });

  test("rejects injection through column names", () => {
    expect(() => validateColumn("1=1 OR region", mockColumns)).toThrow("does not exist");
  });
});

// ─── buildAnalyticsQuery ─────────────────────────

describe("buildAnalyticsQuery", () => {
  test("builds a simple SELECT query", () => {
    const query = {
      select: [{ column: "region" }, { column: "quantity" }],
      filters: [],
      groupBy: [],
      orderBy: [],
      limit: 100,
      offset: 0,
    };

    const result = buildAnalyticsQuery(tableName, query, mockColumns);
    expect(result.sql).toContain("SELECT");
    expect(result.sql).toContain('"region"');
    expect(result.sql).toContain('"quantity"');
    expect(result.sql).toContain(`"${tableName}"`);
    expect(result.params).toEqual([100, 0]);
  });

  test("builds aggregation query with GROUP BY", () => {
    const query = {
      select: [
        { column: "region" },
        { column: "quantity", aggregation: "SUM", alias: "total_qty" },
      ],
      filters: [],
      groupBy: ["region"],
      orderBy: [{ column: "total_qty", direction: "DESC" }],
      limit: 50,
      offset: 0,
    };

    const result = buildAnalyticsQuery(tableName, query, mockColumns);
    expect(result.sql).toContain('SUM("quantity") AS "total_qty"');
    expect(result.sql).toContain('GROUP BY "region"');
    expect(result.sql).toContain('ORDER BY "total_qty" DESC');
  });

  test("builds query with filters", () => {
    const query = {
      select: [{ column: "product" }, { column: "price" }],
      filters: [
        { column: "region", operator: "eq", value: "North" },
        { column: "price", operator: "gte", value: 100 },
      ],
      groupBy: [],
      orderBy: [],
      limit: 100,
      offset: 0,
    };

    const result = buildAnalyticsQuery(tableName, query, mockColumns);
    expect(result.sql).toContain("WHERE");
    expect(result.sql).toContain('"region" = $1');
    expect(result.sql).toContain('"price" >= $2');
    expect(result.params[0]).toBe("North");
    expect(result.params[1]).toBe(100);
  });

  test("builds query with IN filter", () => {
    const query = {
      select: [{ column: "product" }],
      filters: [{ column: "region", operator: "in", value: ["North", "South", "East"] }],
      groupBy: [],
      orderBy: [],
      limit: 100,
      offset: 0,
    };

    const result = buildAnalyticsQuery(tableName, query, mockColumns);
    expect(result.sql).toContain("IN ($1, $2, $3)");
    expect(result.params.slice(0, 3)).toEqual(["North", "South", "East"]);
  });

  test("builds query with IS NULL filter", () => {
    const query = {
      select: [{ column: "product" }],
      filters: [{ column: "region", operator: "is_null" }],
      groupBy: [],
      orderBy: [],
      limit: 100,
      offset: 0,
    };

    const result = buildAnalyticsQuery(tableName, query, mockColumns);
    expect(result.sql).toContain('"region" IS NULL');
  });

  test("builds query with LIKE filter", () => {
    const query = {
      select: [{ column: "product" }],
      filters: [{ column: "product", operator: "like", value: "widget" }],
      groupBy: [],
      orderBy: [],
      limit: 100,
      offset: 0,
    };

    const result = buildAnalyticsQuery(tableName, query, mockColumns);
    expect(result.sql).toContain("ILIKE $1");
    expect(result.params[0]).toBe("%widget%");
  });

  test("rejects non-aggregatable column for SUM", () => {
    const query = {
      select: [{ column: "region", aggregation: "SUM" }],
      filters: [],
      groupBy: [],
      orderBy: [],
      limit: 100,
      offset: 0,
    };

    expect(() => buildAnalyticsQuery(tableName, query, mockColumns))
      .toThrow('Column "region" is not aggregatable');
  });

  test("allows COUNT on non-aggregatable columns", () => {
    const query = {
      select: [{ column: "region", aggregation: "COUNT" }],
      filters: [],
      groupBy: [],
      orderBy: [],
      limit: 100,
      offset: 0,
    };

    const result = buildAnalyticsQuery(tableName, query, mockColumns);
    expect(result.sql).toContain('COUNT("region")');
  });

  test("rejects non-existent columns", () => {
    const query = {
      select: [{ column: "nonexistent" }],
      filters: [],
      groupBy: [],
      orderBy: [],
      limit: 100,
      offset: 0,
    };

    expect(() => buildAnalyticsQuery(tableName, query, mockColumns))
      .toThrow('Column "nonexistent" does not exist');
  });

  test("includes count query for pagination", () => {
    const query = {
      select: [{ column: "region" }],
      filters: [],
      groupBy: [],
      orderBy: [],
      limit: 10,
      offset: 0,
    };

    const result = buildAnalyticsQuery(tableName, query, mockColumns);
    expect(result.countSql).toContain("COUNT(*)");
    expect(typeof result.countParams).toBe("object");
  });
});

// ─── buildKpiQuery ───────────────────────────────

describe("buildKpiQuery", () => {
  test("builds KPI aggregation query", () => {
    const query = {
      metrics: [
        { column: "quantity", aggregation: "SUM", alias: "total_qty" },
        { column: "price", aggregation: "AVG", alias: "avg_price" },
      ],
      filters: [],
    };

    const result = buildKpiQuery(tableName, query, mockColumns);
    expect(result.sql).toContain('SUM("quantity") AS "total_qty"');
    expect(result.sql).toContain('AVG("price") AS "avg_price"');
    expect(result.sql).not.toContain("GROUP BY");
  });

  test("builds KPI with filters", () => {
    const query = {
      metrics: [{ column: "quantity", aggregation: "COUNT" }],
      filters: [{ column: "region", operator: "eq", value: "West" }],
    };

    const result = buildKpiQuery(tableName, query, mockColumns);
    expect(result.sql).toContain("WHERE");
    expect(result.params[0]).toBe("West");
  });

  test("rejects non-aggregatable column for AVG", () => {
    const query = {
      metrics: [{ column: "region", aggregation: "AVG" }],
      filters: [],
    };

    expect(() => buildKpiQuery(tableName, query, mockColumns))
      .toThrow('Column "region" is not aggregatable');
  });
});

// ─── buildChartQuery ─────────────────────────────

describe("buildChartQuery", () => {
  test("builds chart data query", () => {
    const query = {
      chartType: "bar",
      categoryColumn: "region",
      valueColumns: [{ column: "quantity", aggregation: "SUM", alias: "total" }],
      filters: [],
      orderBy: [],
      limit: 50,
    };

    const result = buildChartQuery(tableName, query, mockColumns);
    expect(result.sql).toContain('"region"');
    expect(result.sql).toContain('SUM("quantity") AS "total"');
    expect(result.sql).toContain('GROUP BY "region"');
  });

  test("builds chart with ordering and limit", () => {
    const query = {
      chartType: "pie",
      categoryColumn: "product",
      valueColumns: [{ column: "price", aggregation: "SUM" }],
      filters: [],
      orderBy: [{ column: "product", direction: "ASC" }],
      limit: 10,
    };

    const result = buildChartQuery(tableName, query, mockColumns);
    expect(result.sql).toContain("ORDER BY");
    expect(result.sql).toContain("LIMIT");
  });
});

// ─── buildSummaryQuery ───────────────────────────

describe("buildSummaryQuery", () => {
  test("builds summary statistics query", () => {
    const result = buildSummaryQuery(tableName, mockColumns);
    expect(result.sql).toContain('COUNT(*)');
    expect(result.sql).toContain("COUNT(DISTINCT");
    expect(result.sql).toContain("MIN(");
    expect(result.sql).toContain("MAX(");
    expect(result.sql).toContain("AVG(");
    expect(result.params).toEqual([]);
  });

  test("includes stats only for aggregatable columns", () => {
    const result = buildSummaryQuery(tableName, mockColumns);
    // "region" is not aggregatable — should not have MIN/MAX/AVG for it
    expect(result.sql).not.toContain('"region"_min');
    // "quantity" is aggregatable — should have MIN/MAX/AVG
    expect(result.sql).toContain('MIN("quantity")');
  });
});

// ─── buildQueryFromPlan ──────────────────────────

describe("buildQueryFromPlan", () => {
  test("builds query from aggregate plan", () => {
    const plan = {
      intent: "aggregate",
      aggregations: [{ column: "quantity", function: "SUM", alias: "total_qty" }],
      groupBy: ["region"],
      filters: [],
      orderBy: [],
      limit: 100,
    };

    const result = buildQueryFromPlan(tableName, plan, mockColumns);
    expect(result.sql).toContain('SUM("quantity")');
    expect(result.sql).toContain('GROUP BY "region"');
  });

  test("builds query from list plan", () => {
    const plan = {
      intent: "list",
      fields: ["region", "product", "quantity"],
      filters: [],
      orderBy: [],
      limit: 50,
    };

    const result = buildQueryFromPlan(tableName, plan, mockColumns);
    expect(result.sql).toContain('"region"');
    expect(result.sql).toContain('"product"');
    expect(result.sql).toContain('"quantity"');
  });

  test("defaults to all columns when no fields/aggregations specified", () => {
    const plan = {
      intent: "summary",
      filters: [],
      orderBy: [],
    };

    const result = buildQueryFromPlan(tableName, plan, mockColumns);
    expect(result.sql).toContain('"region"');
    expect(result.sql).toContain('"quantity"');
  });

  test("enforces max limit of 10000", () => {
    const plan = {
      intent: "list",
      fields: ["region"],
      filters: [],
      orderBy: [],
      limit: 99999,
    };

    const result = buildQueryFromPlan(tableName, plan, mockColumns);
    expect(result.sql).toContain("LIMIT");
    // The limit param should be capped at 10000
    expect(result.params).toContain(10000);
  });

  test("falls back to all columns when plan has no explicit fields or aggregations", () => {
    const plan = {
      intent: "aggregate",
      aggregations: [],
      fields: [],
      filters: [],
      groupBy: [],
      orderBy: [],
    };

    // When both aggregations and fields are empty, buildQueryFromPlan
    // falls back to selecting all columns (capped at 100 rows).
    const result = buildQueryFromPlan(tableName, plan, mockColumns);
    expect(result.sql).toContain('"region"');
    expect(result.sql).toContain('"quantity"');
    expect(result.params).toContain(100); // default limit capped
  });
});
