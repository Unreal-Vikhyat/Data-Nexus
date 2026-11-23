/**
 * report.controller.js
 *
 * Controller for handling PDF, Excel, and CSV report export requests.
 */

import * as exportService from "../services/export.service.js";

export async function exportReport(req, res) {
  const { workspaceId, datasetId } = req.params;
  const options = {
    ...req.body,
    ...(datasetId ? { datasetId } : {}),
  };

  const { buffer, filename, mimeType } = await exportService.exportReportData(
    req.auth.userId,
    workspaceId,
    options,
  );

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", buffer.length);
  return res.send(buffer);
}
