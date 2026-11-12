/**
 * export.service.js
 *
 * Multi-format report export engine for Data Nexus.
 * Generates PDF, Excel (.xlsx), and CSV files from datasets and analytics queries.
 *
 * Security:
 * - Sanitizes spreadsheet formula injection in CSV and Excel.
 * - Enforces safe column quoting and bounded row limits.
 * - Streams buffers directly to avoid memory leaks.
 */

import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { withTenantTransaction } from "../database/transaction.js";
import { assertSufficientCredits, debitWallet } from "./wallet.service.js";
import { logActivity } from "./activity.service.js";
import { CREDIT_COSTS } from "../config/credits.config.js";

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

// ─── Formula Injection Sanitization ────────────────
const FORMULA_START_CHARS = ["=", "+", "-", "@", "\t", "\r"];

export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);

  // If the cell begins with formula characters, prefix with single-quote to neutralize in Excel/Sheets
  let safeValue = stringValue;
  if (FORMULA_START_CHARS.some((char) => stringValue.startsWith(char))) {
    safeValue = `'${stringValue}`;
  }

  // RFC 4180: If contains quotes, commas, or newlines, escape internal quotes and wrap in double quotes
  if (/[",\r\n]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

// ─── CSV Generator ─────────────────────────────────
export function generateCsvBuffer({ columns, rows }) {
  const headerLine = columns.map(sanitizeCsvCell).join(",");
  const dataLines = rows.map((row) => {
    if (Array.isArray(row)) {
      return row.map(sanitizeCsvCell).join(",");
    }
    return columns.map((col) => sanitizeCsvCell(row[col])).join(",");
  });

  const csvContent = [headerLine, ...dataLines].join("\r\n");
  return Buffer.from(csvContent, "utf-8");
}

// ─── Excel Generator (ExcelJS) ─────────────────────
export async function generateExcelBuffer({
  title = "Data Nexus Report",
  workspaceName = "Workspace",
  summaryMetrics = [],
  columns,
  rows,
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Data Nexus Platform";
  workbook.created = new Date();

  // Tab 1: Summary / Overview Sheet (if metrics present)
  if (summaryMetrics.length > 0) {
    const summarySheet = workbook.addWorksheet("Overview");
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 28 },
      { header: "Value", key: "value", width: 24 },
    ];

    const headerRow = summarySheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" }, // Indigo 600
    };

    summarySheet.addRow({ metric: "Report Title", value: title });
    summarySheet.addRow({ metric: "Workspace", value: workspaceName });
    summarySheet.addRow({ metric: "Generated At", value: new Date().toISOString() });
    summarySheet.addRow({ metric: "Total Records", value: rows.length });
    summarySheet.addRow({});

    for (const m of summaryMetrics) {
      summarySheet.addRow({ metric: m.label || m.metric, value: m.value });
    }
  }

  // Tab 2: Data Sheet
  const dataSheet = workbook.addWorksheet("Data");

  dataSheet.columns = columns.map((col) => ({
    header: col,
    key: col,
    width: Math.max(col.length + 4, 14),
  }));

  const dataHeaderRow = dataSheet.getRow(1);
  dataHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  dataHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" }, // Slate 800
  };
  dataHeaderRow.height = 24;

  for (const row of rows) {
    const rowValues = Array.isArray(row)
      ? row
      : columns.map((col) => row[col] ?? "");

    const sanitizedRow = rowValues.map((val) => {
      if (typeof val === "string" && FORMULA_START_CHARS.some((c) => val.startsWith(c))) {
        return `'${val}`;
      }
      return val;
    });

    dataSheet.addRow(sanitizedRow);
  }

  dataSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
    }
  });

  return workbook.xlsx.writeBuffer();
}

// ─── PDF Generator (PDFKit) ────────────────────────
export function generatePdfBuffer({
  title = "Data Nexus Executive Report",
  subtitle = null,
  workspaceName = "Workspace",
  summaryMetrics = [],
  columns,
  rows,
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: "A4",
        info: {
          Title: title,
          Author: "Data Nexus Platform",
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const primaryColor = "#4F46E5";
      const slateDark = "#0F172A";
      const slateMuted = "#64748B";
      const borderLine = "#E2E8F0";

      // 1. Top Brand Banner
      doc.rect(40, 40, doc.page.width - 80, 4).fill(primaryColor);
      doc.moveDown(0.8);

      doc.fillColor(slateDark).fontSize(20).font("Helvetica-Bold").text("DATA NEXUS", 40, 52);
      doc.fillColor(slateMuted).fontSize(10).font("Helvetica").text("Analytics & Intelligence Platform", 40, 76);

      doc.fillColor(slateMuted).fontSize(9).font("Helvetica").text(
        `Generated: ${new Date().toISOString().replace("T", " ").substring(0, 19)} UTC`,
        doc.page.width - 240,
        54,
        { width: 200, align: "right" },
      );
      doc.text(
        `Workspace: ${workspaceName}`,
        doc.page.width - 240,
        68,
        { width: 200, align: "right" },
      );

      doc.moveDown(2);
      doc.strokeColor(borderLine).lineWidth(1).moveTo(40, 95).lineTo(doc.page.width - 40, 95).stroke();

      let currentY = 110;
      doc.fillColor(slateDark).fontSize(16).font("Helvetica-Bold").text(title, 40, currentY);
      currentY += 24;

      if (subtitle) {
        doc.fillColor(slateMuted).fontSize(10).font("Helvetica-Oblique").text(subtitle, 40, currentY, { width: doc.page.width - 80 });
        currentY += doc.heightOfString(subtitle, { width: doc.page.width - 80 }) + 10;
      }

      // 2. Summary Metric Cards (if present)
      if (summaryMetrics.length > 0) {
        currentY += 6;
        const cardWidth = Math.min(150, (doc.page.width - 80 - (summaryMetrics.length - 1) * 10) / summaryMetrics.length);
        const cardHeight = 48;

        summaryMetrics.slice(0, 4).forEach((m, idx) => {
          const cardX = 40 + idx * (cardWidth + 10);
          doc.rect(cardX, currentY, cardWidth, cardHeight).fillAndStroke("#F8FAFC", borderLine);

          doc.fillColor(slateMuted).fontSize(8).font("Helvetica").text(
            m.label || m.metric,
            cardX + 8,
            currentY + 8,
            { width: cardWidth - 16, lineBreak: false },
          );
          doc.fillColor(primaryColor).fontSize(13).font("Helvetica-Bold").text(
            String(m.value),
            cardX + 8,
            currentY + 24,
            { width: cardWidth - 16, lineBreak: false },
          );
        });

        currentY += cardHeight + 20;
      }

      // 3. Tabular Data Section
      const maxColumns = Math.min(columns.length, 7);
      const activeCols = columns.slice(0, maxColumns);
      const colWidth = (doc.page.width - 80) / maxColumns;
      const rowHeight = 20;

      // Table Header
      doc.rect(40, currentY, doc.page.width - 80, rowHeight).fill("#1E293B");
      activeCols.forEach((col, idx) => {
        doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold").text(
          String(col),
          40 + idx * colWidth + 4,
          currentY + 5,
          { width: colWidth - 8, lineBreak: false },
        );
      });
      currentY += rowHeight;

      const previewRows = rows.slice(0, 100);

      previewRows.forEach((row, rowIdx) => {
        if (currentY + rowHeight > doc.page.height - 40) {
          doc.addPage();
          currentY = 40;

          doc.rect(40, currentY, doc.page.width - 80, rowHeight).fill("#1E293B");
          activeCols.forEach((col, idx) => {
            doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold").text(
              String(col),
              40 + idx * colWidth + 4,
              currentY + 5,
              { width: colWidth - 8, lineBreak: false },
            );
          });
          currentY += rowHeight;
        }

        const bgColor = rowIdx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
        doc.rect(40, currentY, doc.page.width - 80, rowHeight).fill(bgColor);

        const rowValues = Array.isArray(row)
          ? row.slice(0, maxColumns)
          : activeCols.map((col) => row[col]);

        rowValues.forEach((val, idx) => {
          const displayVal = val === null || val === undefined ? "-" : String(val);
          doc.fillColor(slateDark).fontSize(8).font("Helvetica").text(
            displayVal,
            40 + idx * colWidth + 4,
            currentY + 5,
            { width: colWidth - 8, lineBreak: false },
          );
        });

        currentY += rowHeight;
      });

      if (rows.length > previewRows.length) {
        currentY += 10;
        doc.fillColor(slateMuted).fontSize(8).font("Helvetica-Oblique").text(
          `* Showing first ${previewRows.length} of ${rows.length} total records. Use CSV or Excel for full raw export.`,
          40,
          currentY,
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Main Unified Export Method ───
export async function exportReportData(userId, organizationId, {
  format = "pdf",
  title = "Data Nexus Export",
  subtitle = null,
  datasetId = null,
  summaryMetrics = [],
  customColumns = null,
  customRows = null,
  limit = 1000,
}) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    // 1. Get workspace name
    const orgRes = await client.query("SELECT name FROM organizations WHERE id = $1", [organizationId]);
    const workspaceName = orgRes.rows[0]?.name || "Workspace";

    let columns = customColumns || [];
    let rows = customRows || [];

    // 2. If datasetId provided, load schema and rows from database
    if (datasetId && (!customRows || customRows.length === 0)) {
      const dsRes = await client.query(
        "SELECT id, name, storage_table FROM datasets WHERE id = $1 AND organization_id = $2",
        [datasetId, organizationId],
      );

      if (!dsRes.rowCount) {
        throw httpError(404, "DATASET_NOT_FOUND", "Dataset not found in this workspace");
      }

      const dataset = dsRes.rows[0];
      title = title || `${dataset.name} Report`;

      // Fetch columns metadata if present
      const colRes = await client.query(
        "SELECT column_name, display_name FROM dataset_columns WHERE dataset_id = $1 ORDER BY ordinal",
        [datasetId],
      );

      if (colRes.rowCount > 0) {
        columns = colRes.rows.map((c) => c.column_name);
      }

      // Safe query on dataset table
      if (dataset.storage_table && /^ds_[a-f0-9]{32}$/.test(dataset.storage_table)) {
        const queryRes = await client.query(`SELECT * FROM "${dataset.storage_table}" LIMIT $1`, [limit]);
        rows = queryRes.rows;
        if (columns.length === 0 && rows.length > 0) {
          columns = Object.keys(rows[0]);
        }
      }
    }

    if (columns.length === 0 && rows.length > 0) {
      columns = Array.isArray(rows[0])
        ? rows[0].map((_, i) => `Col_${i + 1}`)
        : Object.keys(rows[0]);
    }

    if (columns.length === 0) {
      throw httpError(400, "EMPTY_DATASET", "Cannot export without columns or data rows");
    }

    // 3. Pre-flight check: verify workspace has sufficient credits before heavy rendering
    const creditCost = format === "pdf"
      ? CREDIT_COSTS.REPORT_PDF
      : format === "xlsx"
        ? CREDIT_COSTS.REPORT_XLSX
        : CREDIT_COSTS.REPORT_CSV;

    await assertSufficientCredits(client, organizationId, creditCost);

    // 4. Generate file buffer based on requested format
    let buffer;
    let mimeType;
    let extension;

    const safeFilenamePrefix = title.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 40);
    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
      buffer = generateCsvBuffer({ columns, rows });
      mimeType = "text/csv; charset=utf-8";
      extension = "csv";
    } else if (format === "xlsx") {
      buffer = await generateExcelBuffer({
        title,
        workspaceName,
        summaryMetrics,
        columns,
        rows,
      });
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      extension = "xlsx";
    } else {
      // Default: PDF
      buffer = await generatePdfBuffer({
        title,
        subtitle,
        workspaceName,
        summaryMetrics,
        columns,
        rows,
      });
      mimeType = "application/pdf";
      extension = "pdf";
    }

    const filename = `${safeFilenamePrefix}_${timestamp}.${extension}`;

    // 5. Concurrency-safe atomic debit deduction with employee tracking
    const debitResult = await debitWallet(userId, organizationId, {
      amount: creditCost,
      referenceType: "report_export",
      description: `Exported ${format.toUpperCase()} report: ${title}`,
      client,
    });

    await logActivity({
      organizationId,
      userId,
      action: "report.export",
      entityType: "report",
      entityId: datasetId ? String(datasetId) : "custom",
      details: {
        format,
        title,
        recordCount: rows.length,
        creditsDeducted: creditCost,
        remainingCredits: debitResult.balanceAfter,
      },
      client,
    });

    return {
      buffer,
      filename,
      mimeType,
      recordCount: rows.length,
      creditsDeducted: creditCost,
      remainingCredits: debitResult.balanceAfter,
    };
  });
}
