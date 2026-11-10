/**
 * analytics.service.js
 *
 * Generic analytics engine for arbitrary datasets.
 * Reads dataset metadata, builds safe SQL, and executes read-only queries.
 * Never hardcodes domain-specific metrics.
 */

import { withTenantTransaction } from "../database/transaction.js";
import { logger } from "../config/logger.js";
import {
  buildAnalyticsQuery,
  buildKpiQuery,
  buildChartQuery,
  buildSummaryQuery,
} from "./query-builder.service.js";

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

// ─── Fetch dataset + validate access ─────────────

async function getDatasetWithSchema(client, datasetId) {
  const dsResult = await client.query(
    `SELECT d.id, d.name, d.storage_table, d.status, d.row_count, d.organization_id
     FROM datasets d WHERE d.id = $1`,
    [datasetId],
  );

  if (!dsResult.rowCount) {
    throw httpError(404, "DATASET_NOT_FOUND", "Dataset not found");
  }

  const dataset = dsResult.rows[0];

  if (dataset.status !== "ready") {
    throw httpError(409, "DATASET_NOT_READY", `Dataset is "${dataset.status}" and not available for analytics`);
  }

  const colResult = await client.query(
    `SELECT column_name, display_name, data_type, is_aggregatable, is_groupable, is_filterable, ordinal
     FROM dataset_columns WHERE dataset_id = $1 ORDER BY ordinal`,
    [datasetId],
  );

  if (!colResult.rowCount) {
    throw httpError(409, "DATASET_NO_COLUMNS", "Dataset has no column metadata. Upload/profiling may not be complete.");
  }

  return { dataset, columns: colResult.rows };
}

// ─── Execute a read-only query with timeout ──────

async function executeReadOnly(client, sql, params, timeoutMs = 8000) {
  await client.query(`SET LOCAL statement_timeout = ${Number(timeoutMs)}`);
  await client.query("SET LOCAL default_transaction_read_only = ON");

  const result = await client.query(sql, params);
  return result;
}

// ─── Public API ──────────────────────────────────

/**
 * Generic analytics query: SELECT with aggregations, filters, grouping, sorting, pagination.
 */
export async function runAnalyticsQuery(userId, organizationId, datasetId, queryParams) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    const { dataset, columns } = await getDatasetWithSchema(client, datasetId);

    const { sql, params, countSql, countParams } = buildAnalyticsQuery(
      dataset.storage_table,
      queryParams,
      columns,
    );

    logger.info({ datasetId, sql: sql.substring(0, 200) }, "Executing analytics query");

    const [dataResult, countResult] = await Promise.all([
      executeReadOnly(client, sql, params),
      executeReadOnly(client, countSql, countParams),
    ]);

    const total = parseInt(countResult.rows[0]?.total ?? 0, 10);

    return {
      rows: dataResult.rows,
      total,
      limit: queryParams.limit,
      offset: queryParams.offset,
      hasMore: queryParams.offset + dataResult.rows.length < total,
    };
  });
}

/**
 * KPI metrics query: aggregated values with optional filters.
 */
export async function runKpiQuery(userId, organizationId, datasetId, queryParams) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    const { dataset, columns } = await getDatasetWithSchema(client, datasetId);

    const { sql, params } = buildKpiQuery(
      dataset.storage_table,
      queryParams,
      columns,
    );

    logger.info({ datasetId }, "Executing KPI query");

    const result = await executeReadOnly(client, sql, params);

    // Transform the single-row result into an array of named KPIs
    const row = result.rows[0] || {};
    const kpis = queryParams.metrics.map((m) => {
      const key = m.alias || `${m.aggregation.toLowerCase()}_${m.column}`;
      return {
        label: m.alias || `${m.aggregation} of ${m.column}`,
        column: m.column,
        aggregation: m.aggregation,
        value: row[key] ?? null,
      };
    });

    return { kpis };
  });
}

/**
 * Chart data query: category-based grouping for chart rendering.
 */
export async function runChartQuery(userId, organizationId, datasetId, queryParams) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    const { dataset, columns } = await getDatasetWithSchema(client, datasetId);

    const { sql, params } = buildChartQuery(
      dataset.storage_table,
      queryParams,
      columns,
    );

    logger.info({ datasetId, chartType: queryParams.chartType }, "Executing chart query");

    const result = await executeReadOnly(client, sql, params);

    return {
      chartType: queryParams.chartType,
      categoryColumn: queryParams.categoryColumn,
      data: result.rows,
    };
  });
}

/**
 * Dataset summary: row count, distinct counts, basic statistics per column.
 */
export async function getDatasetSummary(userId, organizationId, datasetId) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    const { dataset, columns } = await getDatasetWithSchema(client, datasetId);

    const { sql, params } = buildSummaryQuery(dataset.storage_table, columns);

    logger.info({ datasetId }, "Executing summary query");

    const result = await executeReadOnly(client, sql, params);
    const raw = result.rows[0] || {};

    // Structure the summary by column
    const totalRows = parseInt(raw.totalRows ?? 0, 10);
    const columnSummaries = columns.map((col) => {
      const prefix = col.column_name;
      const summary = {
        columnName: col.column_name,
        displayName: col.display_name || col.column_name,
        dataType: col.data_type,
        nonNullCount: parseInt(raw[`${prefix}_non_null`] ?? 0, 10),
        distinctCount: parseInt(raw[`${prefix}_distinct`] ?? 0, 10),
        nullCount: totalRows - parseInt(raw[`${prefix}_non_null`] ?? 0, 10),
      };

      if (col.is_aggregatable) {
        summary.min = raw[`${prefix}_min`] ?? null;
        summary.max = raw[`${prefix}_max`] ?? null;
        summary.avg = raw[`${prefix}_avg`] != null ? parseFloat(raw[`${prefix}_avg`]) : null;
        summary.sum = raw[`${prefix}_sum`] != null ? parseFloat(raw[`${prefix}_sum`]) : null;
      }

      return summary;
    });

    return {
      datasetId: dataset.id,
      datasetName: dataset.name,
      totalRows,
      columns: columnSummaries,
      availableColumns: columns.map((c) => ({
        name: c.column_name,
        displayName: c.display_name || c.column_name,
        dataType: c.data_type,
        aggregatable: c.is_aggregatable,
        groupable: c.is_groupable,
        filterable: c.is_filterable,
      })),
    };
  });
}

