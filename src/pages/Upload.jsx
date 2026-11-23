
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  UploadCloud,
  FileSpreadsheet,
  X,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Database,
  Eye,
} from "lucide-react";

function detectType(values) {
  const filled = values.filter(
    (value) => value !== "" && value !== null && value !== undefined
  );

  if (filled.length === 0) return "Empty";

  const isNumber = filled.every(
    (value) =>
      !isNaN(Number(String(value).replace(/[₹$,%\s,]/g, ""))) &&
      String(value).trim() !== ""
  );

  if (isNumber) return "Number";

  const isDate = filled.every(
    (value) =>
      !isNaN(Date.parse(String(value))) &&
      String(value).trim() !== ""
  );

  if (isDate) return "Date";

  return "Text";
}

const BUSINESS_FIELDS = [
  "Date",
  "Revenue",
  "Profit",
  "Product",
  "Region",
  "Quantity",
  "Customer",
  "Order ID",
];

function suggestBusinessField(header) {
  const name = header.toLowerCase().replace(/[_-]/g, " ");

  if (name.includes("date") || name.includes("time")) return "Date";
  if (name.includes("revenue") || name.includes("sales amount") || name.includes("total sales")) return "Revenue";
  if (name.includes("profit")) return "Profit";
  if (name.includes("product") || name.includes("item")) return "Product";
  if (name.includes("region") || name.includes("location") || name.includes("city")) return "Region";
  if (name.includes("quantity") || name.includes("units")) return "Quantity";
  if (name.includes("customer") || name.includes("client")) return "Customer";
  if (name.includes("order id") || name.includes("order number")) return "Order ID";

  return "";
}

function analyzeDataQuality(headers, rows, columnTypes) {
  const totalCells = headers.length * rows.length;

  // 1. Missing values
  let missingValues = 0;

  rows.forEach((row) => {
    row.forEach((cell) => {
      if (String(cell).trim() === "") {
        missingValues++;
      }
    });
  });

  // 2. Duplicate rows
  const seenRows = new Set();
  let duplicateRows = 0;

  rows.forEach((row) => {
    const rowKey = JSON.stringify(row);

    if (seenRows.has(rowKey)) {
      duplicateRows++;
    } else {
      seenRows.add(rowKey);
    }
  });

  // 3. Empty columns
  const emptyColumns = headers.filter((header, index) =>
    rows.every((row) => String(row[index] ?? "").trim() === "")
  );

  // 4. Invalid values
  let invalidValues = 0;

  columnTypes.forEach((column, index) => {
    rows.forEach((row) => {
      const value = String(row[index] ?? "").trim();

      if (value === "") return;

      if (column.type === "Number") {
        const cleanedValue = value.replace(/[₹$,%\s,]/g, "");

        if (cleanedValue === "" || !Number.isFinite(Number(cleanedValue))) {
          invalidValues++;
        }
      }

      if (column.type === "Date" && isNaN(Date.parse(value))) {
        invalidValues++;
      }
    });
  });

  // Quality score
  const missingPercentage =
    totalCells > 0 ? (missingValues / totalCells) * 100 : 0;

  const duplicatePercentage =
    rows.length > 0 ? (duplicateRows / rows.length) * 100 : 0;

  const invalidPercentage =
    totalCells > 0 ? (invalidValues / totalCells) * 100 : 0;

  const qualityScore = Math.max(
    0,
    Math.round(
      100 -
        missingPercentage * 0.4 -
        duplicatePercentage * 0.3 -
        invalidPercentage * 0.3 -
        (emptyColumns.length > 0 ? 10 : 0)
    )
  );

  return {
    missingValues,
    duplicateRows,
    emptyColumns,
    invalidValues,
    qualityScore,
  };
}

function removeDuplicateRows(rows) {
  const uniqueRows = [];
  const seenRows = new Set();

  rows.forEach((row) => {
    const rowKey = JSON.stringify(row);

    if (!seenRows.has(rowKey)) {
      seenRows.add(rowKey);
      uniqueRows.push(row);
    }
  });

  return uniqueRows;
}

function removeRowsWithMissingValues(rows) {
  return rows.filter((row) =>
    row.every((cell) => String(cell ?? "").trim() !== "")
  );
}
function removeEmptyColumns(headers, rows) {
  const nonEmptyIndexes = headers
    .map((_, index) => index)
    .filter((index) =>
      rows.some((row) => String(row[index] ?? "").trim() !== "")
    );

  return {
    headers: nonEmptyIndexes.map((index) => headers[index]),
    rows: rows.map((row) =>
      nonEmptyIndexes.map((index) => row[index])
    ),
  };
}


function Upload() {
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mappings, setMappings] = useState({});
  const [mappingSaved, setMappingSaved] = useState(false);
  const [quality, setQuality] = useState(null);
  const [cleanedRows, setCleanedRows] = useState(null);
  const [cleaningApplied, setCleaningApplied] = useState(false);
  const applyCleaning = () => {
  if (!preview) return;

  let rows = preview.rows;

  const beforeRows = rows.length;
  const beforeColumns = preview.headers.length;

  rows = removeDuplicateRows(rows);
  rows = removeRowsWithMissingValues(rows);

  const cleanedData = removeEmptyColumns(preview.headers, rows);

  setCleanedRows(cleanedData);
  setCleaningApplied(true);

  setQuality(
    analyzeDataQuality(
      cleanedData.headers,
      cleanedData.rows,
      cleanedData.headers.map((header, index) => ({
        name: header,
        type: detectType(cleanedData.rows.map((row) => row[index])),
      }))
    )
  );
};

  const MAX_SIZE = 25 * 1024 * 1024;

  const handleFile = async (selectedFile) => {
    setError("");
    setPreview(null);

    if (!selectedFile) return;

    const extension = selectedFile.name.split(".").pop().toLowerCase();

    if (!["csv", "xlsx", "xls"].includes(extension)) {
      setFile(null);
      setError("Please select a CSV, XLSX or XLS file.");
      return;
    }

    if (selectedFile.size > MAX_SIZE) {
      setFile(null);
      setError("File size must be less than 25 MB.");
      return;
    }

    if (selectedFile.size === 0) {
      setFile(null);
      setError("This file is empty.");
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    try {
      const buffer = await selectedFile.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      const nonEmptyRows = rawData.filter((row) =>
        row.some((cell) => String(cell).trim() !== "")
      );

      if (nonEmptyRows.length < 2) {
        throw new Error(
          "The file must contain a header row and at least one data row."
        );
      }

      const headers = nonEmptyRows[0].map((header, index) =>
        String(header).trim() || `Column ${index + 1}`
      );

      const rows = nonEmptyRows.slice(1).map((row) =>
        headers.map((_, index) => row[index] ?? "")
      );

      const columnTypes = headers.map((header, index) => ({
        name: header,
        type: detectType(rows.map((row) => row[index])),
      }));

      setPreview({
        sheetName,
        headers,
        rows,
        columnTypes,
        totalRows: rows.length,
      });
      const initialMappings = {};

      headers.forEach((header) => {
      initialMappings[header] = suggestBusinessField(header);
      });

setMappings(initialMappings);
setMappingSaved(false);
setQuality(analyzeDataQuality(headers, rows, columnTypes));
    } catch (err) {
      setFile(null);
      setPreview(null);
      setError(err.message || "Unable to read this file.");
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024)
      return `${(bytes / 1024).toFixed(1)} KB`;

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
    setQuality(null);
    setError("");
  };

  return (
    <div className="space-y-6">

      <div>
        <button
          onClick={() => navigate("/datasets")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 mb-4"
        >
          <ArrowLeft size={16} />
          Back to Datasets
        </button>

        <h1 className="text-2xl font-bold text-gray-800">
          Upload Data
        </h1>

        <p className="text-gray-500 mt-1">
          Import your business data and preview it before analysis.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8">

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 md:p-12 text-center transition ${
            dragging
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-300 bg-gray-50"
          }`}
        >
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <UploadCloud size={32} className="text-indigo-600" />
          </div>

          <h2 className="text-lg font-semibold text-gray-800">
            Drag and drop your file here
          </h2>

          <p className="text-sm text-gray-500 mt-2">
            Or select a file from your computer
          </p>

          <label className="inline-block mt-5">
            <span className="bg-indigo-600 text-white px-6 py-3 rounded-lg text-sm font-medium cursor-pointer hover:bg-indigo-700 transition">
              Browse Files
            </span>

            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </label>

          <p className="text-xs text-gray-400 mt-5">
            CSV, XLSX, XLS · Maximum size: 25 MB
          </p>
        </div>

        {error && (
          <div className="mt-5 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {file && (
          <div className="mt-6 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-green-50 p-3 rounded-lg">
                  <FileSpreadsheet size={25} className="text-green-600" />
                </div>

                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatSize(file.size)}
                  </p>
                </div>
              </div>

              <button
                onClick={removeFile}
                className="text-gray-400 hover:text-red-500"
                title="Remove file"
              >
                <X size={20} />
              </button>
            </div>

            {loading && (
              <p className="text-sm text-indigo-600 mt-4">
                Reading your file and preparing preview...
              </p>
            )}

            {preview && (
              <div className="flex items-center gap-2 text-green-600 text-sm mt-4">
                <CheckCircle size={16} />
                File read successfully. Preview is ready.
              </div>
            )}
          </div>
        )}
      </div>

      {preview && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <Database className="text-indigo-600 mb-3" size={23} />
              <p className="text-sm text-gray-500">Total Rows</p>
              <h2 className="text-2xl font-bold text-gray-800 mt-1">
                {preview.totalRows}
              </h2>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <FileSpreadsheet className="text-green-600 mb-3" size={23} />
              <p className="text-sm text-gray-500">Total Columns</p>
              <h2 className="text-2xl font-bold text-gray-800 mt-1">
                {preview.headers.length}
              </h2>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <Eye className="text-purple-600 mb-3" size={23} />
              <p className="text-sm text-gray-500">Sheet Name</p>
              <h2 className="text-lg font-bold text-gray-800 mt-1 truncate">
                {preview.sheetName}
              </h2>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-800">
              Detected Columns
            </h2>

            <p className="text-sm text-gray-500 mt-1 mb-4">
              Automatically detected data types.
            </p>

            <div className="flex flex-wrap gap-2">
              {preview.columnTypes.map((column, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg px-3 py-2"
                >
                  <p className="text-sm font-medium text-gray-800">
                    {column.name}
                  </p>
                  <span className="text-xs text-indigo-600">
                    {column.type}
                  </span>
                </div>
              ))}
            </div>
          </div>

{/* Business Column Mapping */}
<div className="bg-white border border-gray-200 rounded-xl p-5">
  <div className="mb-5">
    <h2 className="text-lg font-semibold text-gray-800">
      Business Column Mapping
    </h2>
    <p className="text-sm text-gray-500 mt-1">
      Match your file columns with standard business fields.
      You can change the automatic suggestions.
    </p>
  </div>

  <div className="space-y-3">
    {preview.headers.map((header, index) => (
      <div
        key={index}
        className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center border border-gray-100 rounded-lg p-3"
      >
        <div>
          <p className="text-xs text-gray-400 mb-1">
            YOUR FILE COLUMN
          </p>
          <p className="font-medium text-gray-800">
            {header}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1">
            BUSINESS FIELD
          </p>

          <select
            value={mappings[header] || ""}
            onChange={(e) => {
              setMappings((prev) => ({
                ...prev,
                [header]: e.target.value,
              }));
              setMappingSaved(false);
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Not Mapped</option>

            {BUSINESS_FIELDS.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </div>
      </div>
    ))}
  </div>

  <button
    onClick={() => setMappingSaved(true)}
    className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-lg text-sm font-medium"
  >
    Save Mapping
  </button>

  {mappingSaved && (
    <div className="mt-4 flex items-center gap-2 text-green-600 text-sm">
      <CheckCircle size={17} />
      Mapping saved for this preview.
    </div>
  )}
</div>

{/* Data Quality Dashboard */}
{quality && (
  <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">

    <div>
      <h2 className="text-lg font-semibold text-gray-800">
        Data Quality Report
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        Check the quality and reliability of your uploaded data.
      </p>
    </div>

    {/* Quality Score */}
    <div className="bg-indigo-50 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-indigo-700">
            Overall Data Quality Score
          </p>

          <h2 className="text-4xl font-bold text-indigo-800 mt-2">
            {quality.qualityScore}%
          </h2>

          <p className="text-sm text-indigo-600 mt-2">
            {quality.qualityScore >= 90
              ? "Excellent data quality"
              : quality.qualityScore >= 70
              ? "Good data quality"
              : quality.qualityScore >= 40
              ? "Needs improvement"
              : "Poor data quality"}
          </p>
        </div>

        <Database size={38} className="text-indigo-500" />
      </div>

      <div className="w-full bg-indigo-200 rounded-full h-3 mt-4">
        <div
          className="bg-indigo-600 h-3 rounded-full transition-all"
          style={{ width: `${quality.qualityScore}%` }}
        />
      </div>
    </div>

    {/* Quality Statistics */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

      <div className="border border-gray-200 rounded-xl p-4">
        <AlertCircle className="text-amber-500 mb-3" size={24} />
        <p className="text-sm text-gray-500">Missing Values</p>
        <h3 className="text-2xl font-bold text-gray-800 mt-1">
          {quality.missingValues}
        </h3>
      </div>

      <div className="border border-gray-200 rounded-xl p-4">
        <Database className="text-red-500 mb-3" size={24} />
        <p className="text-sm text-gray-500">Duplicate Rows</p>
        <h3 className="text-2xl font-bold text-gray-800 mt-1">
          {quality.duplicateRows}
        </h3>
      </div>

      <div className="border border-gray-200 rounded-xl p-4">
        <AlertCircle className="text-orange-500 mb-3" size={24} />
        <p className="text-sm text-gray-500">Invalid Values</p>
        <h3 className="text-2xl font-bold text-gray-800 mt-1">
          {quality.invalidValues}
        </h3>
      </div>

      <div className="border border-gray-200 rounded-xl p-4">
        <Database className="text-purple-500 mb-3" size={24} />
        <p className="text-sm text-gray-500">Empty Columns</p>
        <h3 className="text-2xl font-bold text-gray-800 mt-1">
          {quality.emptyColumns.length}
        </h3>
      </div>

    </div>

    {/* Empty Column Details */}
    {quality.emptyColumns.length > 0 && (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-semibold text-amber-800">
          Empty Columns Found
        </h3>

        <div className="flex flex-wrap gap-2 mt-3">
          {quality.emptyColumns.map((column, index) => (
            <span
              key={index}
              className="bg-white border border-amber-200 text-amber-800 text-sm px-3 py-1 rounded-md"
            >
              {column}
            </span>
          ))}
        </div>
      </div>
    )}

    {/* Quality Status */}
    <div className="flex items-center gap-2 text-sm">
      {quality.missingValues === 0 &&
      quality.duplicateRows === 0 &&
      quality.invalidValues === 0 &&
      quality.emptyColumns.length === 0 ? (
        <>
          <CheckCircle className="text-green-600" size={18} />
          <span className="text-green-700">
            No issues detected in the basic quality checks.
          </span>
        </>
      ) : (
        <>
          <AlertCircle className="text-amber-600" size={18} />
          <span className="text-amber-700">
            Data issues detected. Review the report before analysis.
          </span>
        </>
      )}
    </div>

  </div>
)}



          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Data Preview
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Showing first {Math.min(10, preview.rows.length)} rows
                  out of {preview.totalRows}.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {preview.headers.map((header, index) => (
                      <th
                        key={index}
                        className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {preview.rows.slice(0, 10).map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-4 py-3 text-gray-600 whitespace-nowrap"
                        >
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
        <p className="text-sm text-indigo-800">
          <strong>Note:</strong> Your file is currently read locally in the
          browser. Permanent storage and backend processing will be added
          during integration.
        </p>
      </div>

    </div>
  );
}

export default Upload;
