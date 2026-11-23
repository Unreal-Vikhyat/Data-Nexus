/**
 * query-builder.service.js
 *
 * Safe, parameterized SQL query builder for dynamic dataset analytics.
 * Never interpolates user input into SQL — uses parameterized values
 * and whitelist-validated identifiers only.
 */

import { logger } from "../config/logger.js";

// ─── Identifier safety ──────────────────────────

/** Allowed identifier pattern: letters, digits, underscores. Must start with letter/underscore. */
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]{0,127}$/i;

/**
 * Validate and quote a SQL identifier. Rejects anything that doesn't
 * match strict alphanumeric + underscore pattern.
 */
export function safeIdentifier(name) {
  if (!SAFE_IDENTIFIER.test(name)) {
    throw Object.assign(
      new Error(`Invalid identifier: ${name}`),
      { status: 400, code: "INVALID_IDENTIFIER" },
    );
  }
  return `"${name}"`;
}

/**
 * Validate a column name against the actual dataset schema.
 * Returns the safe-quoted identifier if valid.
 */
export function validateColumn(columnName, schemaColumns) {
  const col = schemaColumns.find((c) => c.column_name === columnName);
  if (!col) {
    throw Object.assign(
      new Error(`Column "${columnName}" does not exist in this dataset`),
      { status: 400, code: "INVALID_COLUMN" },
    );
  }
  return col;
}

// ─── Allowed aggregations ────────────────────────

const ALLOWED_AGGREGATIONS = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX"]);

function validateAggregation(agg) {
  if (!ALLOWED_AGGREGATIONS.has(agg)) {
    throw Object.assign(
      new Error(`Unsupported aggregation: ${agg}`),
      { status: 400, code: "INVALID_AGGREGATION" },
    );
  }
}

// ─── Filter operators to SQL ─────────────────────

const FILTER_OPS = {
  eq:          (col, paramIdx) => ({ sql: `${col} = $${paramIdx}`, count: 1 }),
  neq:         (col, paramIdx) => ({ sql: `${col} != $${paramIdx}`, count: 1 }),
  gt:          (col, paramIdx) => ({ sql: `${col} > $${paramIdx}`, count: 1 }),
  gte:         (col, paramIdx) => ({ sql: `${col} >= $${paramIdx}`, count: 1 }),
  lt:          (col, paramIdx) => ({ sql: `${col} < $${paramIdx}`, count: 1 }),
  lte:         (col, paramIdx) => ({ sql: `${col} <= $${paramIdx}`, count: 1 }),
  like:        (col, paramIdx) => ({ sql: `${col} ILIKE $${paramIdx}`, count: 1 }),
  is_null:     (col) =>          ({ sql: `${col} IS NULL`, count: 0 }),
  is_not_null: (col) =>          ({ sql: `${col} IS NOT NULL`, count: 0 }),
  in:          (col, paramIdx, values) => {
    const placeholders = values.map((_, i) => `$${paramIdx + i}`).join(", ");
    return { sql: `${col} IN (${placeholders})`, count: values.length };
  },
  not_in:      (col, paramIdx, values) => {
    const placeholders = values.map((_, i) => `$${paramIdx + i}`).join(", ");
    return { sql: `${col} NOT IN (${placeholders})`, count: values.length };
  },
};

// ─── Build WHERE clause from filters ─────────────

function buildWhereClause(filters, schemaColumns, startParamIdx) {
  const conditions = [];
  const params = [];
  let paramIdx = startParamIdx;

  for (const filter of filters) {
    validateColumn(filter.column, schemaColumns);
    const quotedCol = safeIdentifier(filter.column);
    const opBuilder = FILTER_OPS[filter.operator];

    if (!opBuilder) {
      throw Object.assign(
        new Error(`Unknown filter operator: ${filter.operator}`),
        { status: 400, code: "INVALID_FILTER_OPERATOR" },
      );
    }

    if (filter.operator === "in" || filter.operator === "not_in") {
      const values = Array.isArray(filter.value) ? filter.value : [filter.value];
      const result = opBuilder(quotedCol, paramIdx, values);
      conditions.push(result.sql);
      params.push(...values);
      paramIdx += result.count;
    } else if (filter.operator === "is_null" || filter.operator === "is_not_null") {
      const result = opBuilder(quotedCol);
      conditions.push(result.sql);
    } else {
      const result = opBuilder(quotedCol, paramIdx);
      conditions.push(result.sql);
      params.push(filter.operator === "like" ? `%${filter.value}%` : filter.value);
      paramIdx += result.count;
    }
  }

  return { clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params, nextParamIdx: paramIdx };
}

// ─── Generic analytics query builder ─────────────

/**
 * Build a safe, parameterized SELECT query for analytics.
 *
 * @param {string} tableName - The validated storage table name (e.g., "ds_abc123...")
 * @param {object} query - Validated query object from schema
 * @param {Array} schemaColumns - Column metadata from dataset_columns table
 * @returns {{ sql: string, params: Array, countSql: string, countParams: Array }}
 */
export function buildAnalyticsQuery(tableName, query, schemaColumns) {
  const safeTable = safeIdentifier(tableName);
  let paramIdx = 1;

  // SELECT clause
  const selectParts = [];
  for (const sel of query.select) {
    const col = validateColumn(sel.column, schemaColumns);
    const quotedCol = safeIdentifier(sel.column);

    if (sel.aggregation) {
      validateAggregation(sel.aggregation);
      if (sel.aggregation !== "COUNT" && !col.is_aggregatable) {
        throw Object.assign(
          new Error(`Column "${sel.column}" is not aggregatable`),
          { status: 400, code: "COLUMN_NOT_AGGREGATABLE" },
        );
      }
      const alias = sel.alias ? safeIdentifier(sel.alias) : safeIdentifier(`${sel.aggregation.toLowerCase()}_${sel.column}`);
      selectParts.push(`${sel.aggregation}(${quotedCol}) AS ${alias}`);
    } else {
      const alias = sel.alias ? safeIdentifier(sel.alias) : quotedCol;
      selectParts.push(sel.alias ? `${quotedCol} AS ${alias}` : quotedCol);
    }
  }

  // WHERE clause
  const where = buildWhereClause(query.filters, schemaColumns, paramIdx);
  paramIdx = where.nextParamIdx;
  const allParams = [...where.params];

  // GROUP BY clause
  let groupByClause = "";
  if (query.groupBy.length > 0) {
    const groupCols = query.groupBy.map((col) => {
      validateColumn(col, schemaColumns);
      return safeIdentifier(col);
    });
    groupByClause = `GROUP BY ${groupCols.join(", ")}`;
  }

  // ORDER BY clause
  let orderByClause = "";
  if (query.orderBy.length > 0) {
    const orderParts = query.orderBy.map((o) => {
      // Allow ordering by alias or column
      const isAlias = query.select.some((s) => s.alias === o.column);
      if (!isAlias) {
        validateColumn(o.column, schemaColumns);
      }
      const dir = o.direction === "DESC" ? "DESC" : "ASC";
      return `${safeIdentifier(o.column)} ${dir}`;
    });
    orderByClause = `ORDER BY ${orderParts.join(", ")}`;
  }

  // LIMIT/OFFSET
  const limitClause = `LIMIT $${paramIdx}`;
  allParams.push(query.limit);
  paramIdx += 1;
  const offsetClause = `OFFSET $${paramIdx}`;
  allParams.push(query.offset);
  paramIdx += 1;

  const sql = [
    `SELECT ${selectParts.join(", ")}`,
    `FROM ${safeTable}`,
    where.clause,
    groupByClause,
    orderByClause,
    limitClause,
    offsetClause,
  ].filter(Boolean).join("\n");

  // Count query for pagination
  const countSql = [
    `SELECT COUNT(*) AS total`,
    groupByClause ? `FROM (SELECT 1 FROM ${safeTable} ${where.clause} ${groupByClause}) AS sub` : `FROM ${safeTable}`,
    groupByClause ? "" : where.clause,
  ].filter(Boolean).join("\n");

  logger.debug({ sql, paramCount: allParams.length }, "Built analytics query");

  return { sql, params: allParams, countSql, countParams: where.params };
}

// ─── KPI query builder ──────────────────────────

/**
 * Build a KPI aggregation query.
 */
export function buildKpiQuery(tableName, query, schemaColumns) {
  const safeTable = safeIdentifier(tableName);
  let paramIdx = 1;

  const selectParts = query.metrics.map((m) => {
    const col = validateColumn(m.column, schemaColumns);
    validateAggregation(m.aggregation);
    if (m.aggregation !== "COUNT" && !col.is_aggregatable) {
      throw Object.assign(
        new Error(`Column "${m.column}" is not aggregatable for ${m.aggregation}`),
        { status: 400, code: "COLUMN_NOT_AGGREGATABLE" },
      );
    }
    const quotedCol = safeIdentifier(m.column);
    const alias = m.alias
      ? safeIdentifier(m.alias)
      : safeIdentifier(`${m.aggregation.toLowerCase()}_${m.column}`);
    return `${m.aggregation}(${quotedCol}) AS ${alias}`;
  });

  const where = buildWhereClause(query.filters, schemaColumns, paramIdx);
  paramIdx = where.nextParamIdx;

  const sql = [
    `SELECT ${selectParts.join(", ")}`,
    `FROM ${safeTable}`,
    where.clause,
  ].filter(Boolean).join("\n");

  return { sql, params: where.params };
}

// ─── Chart query builder ─────────────────────────

/**
 * Build a chart-data query grouped by a category column.
 */
export function buildChartQuery(tableName, query, schemaColumns) {
  const safeTable = safeIdentifier(tableName);
  let paramIdx = 1;

  validateColumn(query.categoryColumn, schemaColumns);
  const categoryCol = safeIdentifier(query.categoryColumn);

  const valueParts = query.valueColumns.map((v) => {
    const col = validateColumn(v.column, schemaColumns);
    validateAggregation(v.aggregation);
    if (v.aggregation !== "COUNT" && !col.is_aggregatable) {
      throw Object.assign(
        new Error(`Column "${v.column}" is not aggregatable for ${v.aggregation}`),
        { status: 400, code: "COLUMN_NOT_AGGREGATABLE" },
      );
    }
    const quotedCol = safeIdentifier(v.column);
    const alias = v.alias
      ? safeIdentifier(v.alias)
      : safeIdentifier(`${v.aggregation.toLowerCase()}_${v.column}`);
    return `${v.aggregation}(${quotedCol}) AS ${alias}`;
  });

  const where = buildWhereClause(query.filters, schemaColumns, paramIdx);
  paramIdx = where.nextParamIdx;
  const allParams = [...where.params];

  // ORDER BY
  let orderByClause = "";
  if (query.orderBy.length > 0) {
    const orderParts = query.orderBy.map((o) => {
      // Allow ordering by value aliases or the category column
      const isValueAlias = query.valueColumns.some((v) => v.alias === o.column);
      if (!isValueAlias && o.column !== query.categoryColumn) {
        validateColumn(o.column, schemaColumns);
      }
      return `${safeIdentifier(o.column)} ${o.direction === "DESC" ? "DESC" : "ASC"}`;
    });
    orderByClause = `ORDER BY ${orderParts.join(", ")}`;
  }

  // LIMIT
  const limitClause = `LIMIT $${paramIdx}`;
  allParams.push(query.limit);

  const sql = [
    `SELECT ${categoryCol}, ${valueParts.join(", ")}`,
    `FROM ${safeTable}`,
    where.clause,
    `GROUP BY ${categoryCol}`,
    orderByClause,
    limitClause,
  ].filter(Boolean).join("\n");

  return { sql, params: allParams };
}

// ─── Summary query builder ──────────────────────

/**
 * Build summary statistics for a dataset.
 */
export function buildSummaryQuery(tableName, schemaColumns) {
  const safeTable = safeIdentifier(tableName);
  const parts = [];

  // Row count
  parts.push(`COUNT(*) AS "totalRows"`);

  // Per-column stats
  for (const col of schemaColumns) {
    const qCol = safeIdentifier(col.column_name);
    const prefix = col.column_name;

    parts.push(`COUNT(${qCol}) AS "${prefix}_non_null"`);
    parts.push(`COUNT(DISTINCT ${qCol}) AS "${prefix}_distinct"`);

    if (col.is_aggregatable) {
      parts.push(`MIN(${qCol}) AS "${prefix}_min"`);
      parts.push(`MAX(${qCol}) AS "${prefix}_max"`);
      parts.push(`AVG(${qCol}::numeric) AS "${prefix}_avg"`);
      parts.push(`SUM(${qCol}::numeric) AS "${prefix}_sum"`);
    }
  }

  const sql = `SELECT ${parts.join(",\n  ")} FROM ${safeTable}`;
  return { sql, params: [] };
}

// ─── Query plan → SQL (for AI assistant) ─────────

/**
 * Validate and convert an AI-generated query plan into safe SQL.
 * The plan is a structured JSON — never raw SQL.
 *
 * @param {string} tableName
 * @param {object} plan - Structured query plan from LLM
 * @param {Array} schemaColumns
 * @returns {{ sql: string, params: Array }}
 */
export function buildQueryFromPlan(tableName, plan, schemaColumns) {
  // Normalize the plan into our analytics query format
  const query = {
    select: [],
    filters: plan.filters || [],
    groupBy: plan.groupBy || [],
    orderBy: plan.orderBy || [],
    limit: Math.min(plan.limit || 500, 10000),
    offset: plan.offset || 0,
  };

  // Handle fields/aggregations from the plan
  if (plan.aggregations && plan.aggregations.length > 0) {
    for (const agg of plan.aggregations) {
      query.select.push({
        column: agg.column,
        aggregation: agg.function?.toUpperCase(),
        alias: agg.alias,
      });
    }
    // Add groupBy columns to select if not already there
    for (const groupCol of query.groupBy) {
      if (!query.select.some((s) => s.column === groupCol && !s.aggregation)) {
        query.select.push({ column: groupCol });
      }
    }
  } else if (plan.fields && plan.fields.length > 0) {
    for (const field of plan.fields) {
      query.select.push({ column: field });
    }
  } else {
    // Default: select all columns
    for (const col of schemaColumns) {
      query.select.push({ column: col.column_name });
    }
    query.limit = Math.min(query.limit, 100);
  }

  if (query.select.length === 0) {
    throw Object.assign(
      new Error("Query plan must specify at least one field or aggregation"),
      { status: 400, code: "EMPTY_QUERY_PLAN" },
    );
  }

  return buildAnalyticsQuery(tableName, query, schemaColumns);
}

