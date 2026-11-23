/**
 * export.test.js
 *
 * Tests for multi-format report exports (PDF, Excel, CSV)
 * and CSV formula injection security sanitization.
 */

import {
  sanitizeCsvCell,
  generateCsvBuffer,
  generateExcelBuffer,
  generatePdfBuffer,
} from "../src/services/export.service.js";
import { exportReportSchema } from "../src/schemas/report.schemas.js";

describe("Export Security - CSV Formula Injection Sanitization", () => {
  test("neutralizes formula characters (=, +, -, @)", () => {
    expect(sanitizeCsvCell("=SUM(A1:B10)")).toBe("'=SUM(A1:B10)");
    expect(sanitizeCsvCell("+12345")).toBe("'+12345");
    expect(sanitizeCsvCell("-500")).toBe("'-500");
    expect(sanitizeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  test("escapes commas, quotes, and newlines per RFC 4180", () => {
    expect(sanitizeCsvCell('Hello, "World"')).toBe('"Hello, ""World"""');
    expect(sanitizeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
  });

  test("handles null, undefined, numbers, and plain strings", () => {
    expect(sanitizeCsvCell(null)).toBe("");
    expect(sanitizeCsvCell(undefined)).toBe("");
    expect(sanitizeCsvCell(1234)).toBe("1234");
    expect(sanitizeCsvCell("North America")).toBe("North America");
  });
});

describe("CSV Generation", () => {
  test("generates RFC 4180 compliant CSV buffer", () => {
    const columns = ["region", "revenue", "units"];
    const rows = [
      ["North", 15000, 45],
      ["South", 8500, 22],
    ];

    const buffer = generateCsvBuffer({ columns, rows });
    expect(Buffer.isBuffer(buffer)).toBe(true);

    const text = buffer.toString("utf-8");
    const lines = text.split("\r\n");
    expect(lines[0]).toBe("region,revenue,units");
    expect(lines[1]).toBe("North,15000,45");
    expect(lines[2]).toBe("South,8500,22");
  });

  test("supports object rows as well as array rows", () => {
    const columns = ["name", "role"];
    const rows = [
      { name: "Alice", role: "admin" },
      { name: "Bob", role: "viewer" },
    ];

    const buffer = generateCsvBuffer({ columns, rows });
    const text = buffer.toString("utf-8");
    expect(text).toContain("Alice,admin");
    expect(text).toContain("Bob,viewer");
  });
});

describe("Excel (.xlsx) Generation", () => {
  test("generates valid Excel binary buffer with overview and data tabs", async () => {
    const columns = ["product", "category", "price"];
    const rows = [
      ["Laptop", "Electronics", 45000],
      ["Desk Chair", "Furniture", 8500],
    ];
    const summaryMetrics = [
      { label: "Total Revenue", value: "₹53,500" },
      { label: "Total Items", value: 2 },
    ];

    const buffer = await generateExcelBuffer({
      title: "Quarterly Inventory",
      workspaceName: "Test Workspace",
      summaryMetrics,
      columns,
      rows,
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    // Excel files are ZIP archives starting with PK (0x50, 0x4B)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});

describe("PDF Generation", () => {
  test("generates valid PDF binary buffer", async () => {
    const columns = ["Region", "Sales", "Target"];
    const rows = [
      ["North", 125000, 100000],
      ["South", 83000, 90000],
      ["West", 45000, 40000],
    ];
    const summaryMetrics = [
      { label: "Total Sales", value: "₹2,53,000" },
      { label: "Avg Sales", value: "₹84,333" },
    ];

    const buffer = await generatePdfBuffer({
      title: "Regional Sales Summary",
      subtitle: "Q4 Performance Review",
      workspaceName: "ABC Technologies",
      summaryMetrics,
      columns,
      rows,
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF magic bytes: %PDF-
    const header = buffer.slice(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });
});

describe("Export Schema Validation", () => {
  test("accepts valid export payload with defaults", () => {
    const result = exportReportSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.format).toBe("pdf");
    expect(result.data.limit).toBe(1000);
  });

  test("accepts csv and xlsx formats", () => {
    expect(exportReportSchema.safeParse({ format: "csv" }).success).toBe(true);
    expect(exportReportSchema.safeParse({ format: "xlsx" }).success).toBe(true);
  });

  test("rejects unsupported export formats", () => {
    const result = exportReportSchema.safeParse({ format: "docx" });
    expect(result.success).toBe(false);
  });
});
