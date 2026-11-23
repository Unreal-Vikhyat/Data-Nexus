/**
 * analytics.controller.js
 *
 * Handles HTTP requests for the generic analytics engine.
 * Delegates all business logic to analytics.service.js.
 */

import * as analyticsService from "../services/analytics.service.js";

export async function query(req, res) {
  const data = await analyticsService.runAnalyticsQuery(
    req.auth.userId,
    req.params.workspaceId,
    req.params.datasetId,
    req.body,
  );
  res.json({ success: true, message: "Analytics query results", data });
}

export async function kpi(req, res) {
  const data = await analyticsService.runKpiQuery(
    req.auth.userId,
    req.params.workspaceId,
    req.params.datasetId,
    req.body,
  );
  res.json({ success: true, message: "KPI results", data });
}

export async function chart(req, res) {
  const data = await analyticsService.runChartQuery(
    req.auth.userId,
    req.params.workspaceId,
    req.params.datasetId,
    req.body,
  );
  res.json({ success: true, message: "Chart data", data });
}

export async function summary(req, res) {
  const data = await analyticsService.getDatasetSummary(
    req.auth.userId,
    req.params.workspaceId,
    req.params.datasetId,
  );
  res.json({ success: true, message: "Dataset summary", data });
}

