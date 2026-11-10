# Analytics & AI API Documentation

Base path: `/api/v1`

All analytics and assistant endpoints require authentication (HTTP-only cookie) and workspace authorization (viewer role minimum).

---

## Response Format

### Success
```json
{ "success": true, "message": "...", "data": { ... } }
```

### Error
```json
{ "success": false, "message": "...", "errors": {}, "code": "ERROR_CODE" }
```

---

## Analytics Endpoints

### POST `/workspaces/:workspaceId/datasets/:datasetId/analytics/query`

Generic analytics query with aggregations, filters, grouping, sorting, and pagination.

**Request Body:**
```json
{
  "select": [
    { "column": "region" },
    { "column": "quantity", "aggregation": "SUM", "alias": "total_qty" }
  ],
  "filters": [
    { "column": "price", "operator": "gte", "value": 100 },
    { "column": "region", "operator": "in", "value": ["North", "South"] },
    { "column": "deleted_at", "operator": "is_null" }
  ],
  "groupBy": ["region"],
  "orderBy": [{ "column": "total_qty", "direction": "DESC" }],
  "limit": 100,
  "offset": 0
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `select` | array | ✅ | 1–20 column selections with optional aggregation and alias |
| `select[].column` | string | ✅ | Column name from the dataset |
| `select[].aggregation` | enum | ❌ | `COUNT`, `SUM`, `AVG`, `MIN`, `MAX` |
| `select[].alias` | string | ❌ | Output alias for the column |
| `filters` | array | ❌ | Up to 20 filter clauses (default: `[]`) |
| `filters[].column` | string | ✅ | Column name to filter on |
| `filters[].operator` | enum | ✅ | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `like`, `is_null`, `is_not_null` |
| `filters[].value` | any | depends | Required for all operators except `is_null`/`is_not_null`. Array for `in`/`not_in`. |
| `groupBy` | array | ❌ | Column names to group by (max 10) |
| `orderBy` | array | ❌ | Sort clauses (max 5) |
| `limit` | integer | ❌ | 1–10000 (default: 500) |
| `offset` | integer | ❌ | 0+ (default: 0) |

**Response:**
```json
{
  "success": true,
  "message": "Analytics query results",
  "data": {
    "rows": [
      { "region": "North", "total_qty": 12500 },
      { "region": "South", "total_qty": 8300 }
    ],
    "total": 4,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

---

### POST `/workspaces/:workspaceId/datasets/:datasetId/analytics/kpi`

Dynamic KPI metrics — aggregate values with optional filtering.

**Request Body:**
```json
{
  "metrics": [
    { "column": "quantity", "aggregation": "SUM", "alias": "total_qty" },
    { "column": "price", "aggregation": "AVG", "alias": "avg_price" },
    { "column": "order_date", "aggregation": "COUNT", "alias": "order_count" }
  ],
  "filters": []
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `metrics` | array | ✅ | 1–10 metric definitions |
| `metrics[].column` | string | ✅ | Column to aggregate |
| `metrics[].aggregation` | enum | ✅ | `COUNT`, `SUM`, `AVG`, `MIN`, `MAX` |
| `metrics[].alias` | string | ❌ | Display label |
| `filters` | array | ❌ | Same as analytics query filters |

**Response:**
```json
{
  "success": true,
  "message": "KPI results",
  "data": {
    "kpis": [
      { "label": "total_qty", "column": "quantity", "aggregation": "SUM", "value": 45200 },
      { "label": "avg_price", "column": "price", "aggregation": "AVG", "value": 125.50 },
      { "label": "order_count", "column": "order_date", "aggregation": "COUNT", "value": 1847 }
    ]
  }
}
```

---

### POST `/workspaces/:workspaceId/datasets/:datasetId/analytics/chart`

Chart-ready data grouped by a category column.

**Request Body:**
```json
{
  "chartType": "bar",
  "categoryColumn": "region",
  "valueColumns": [
    { "column": "quantity", "aggregation": "SUM", "alias": "total" }
  ],
  "filters": [],
  "orderBy": [{ "column": "total", "direction": "DESC" }],
  "limit": 10
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chartType` | enum | ✅ | `bar`, `line`, `pie`, `area` |
| `categoryColumn` | string | ✅ | Column for the X-axis / categories |
| `valueColumns` | array | ✅ | 1–5 value series with aggregation |
| `filters` | array | ❌ | Same filter syntax |
| `orderBy` | array | ❌ | Max 3 sort clauses |
| `limit` | integer | ❌ | 1–1000 (default: 50) |

**Response:**
```json
{
  "success": true,
  "message": "Chart data",
  "data": {
    "chartType": "bar",
    "categoryColumn": "region",
    "data": [
      { "region": "North", "total": 12500 },
      { "region": "South", "total": 8300 }
    ]
  }
}
```

---

### GET `/workspaces/:workspaceId/datasets/:datasetId/analytics/summary`

Dataset summary with row count, distinct counts, and per-column statistics.

**Response:**
```json
{
  "success": true,
  "message": "Dataset summary",
  "data": {
    "datasetId": "uuid",
    "datasetName": "My Dataset",
    "totalRows": 5000,
    "columns": [
      {
        "columnName": "price",
        "displayName": "Price",
        "dataType": "numeric",
        "nonNullCount": 4980,
        "distinctCount": 350,
        "nullCount": 20,
        "min": 5.99,
        "max": 999.99,
        "avg": 125.50,
        "sum": 625000.00
      }
    ],
    "availableColumns": [
      {
        "name": "price",
        "displayName": "Price",
        "dataType": "numeric",
        "aggregatable": true,
        "groupable": false,
        "filterable": true
      }
    ]
  }
}
```

---

## AI Assistant Endpoints

### POST `/workspaces/:workspaceId/datasets/:datasetId/assistant/ask`

Ask a natural-language question about a dataset.

The LLM interprets the question into a structured JSON query plan. The plan is validated against the real schema and converted into safe, parameterized SQL. **Raw LLM-generated SQL is never executed.**

**Request Body:**
```json
{
  "question": "What is the total quantity by region?",
  "sessionId": "uuid (optional — creates new session if omitted)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assistant response",
  "data": {
    "sessionId": "uuid",
    "answer": "SUM of quantity grouped by region",
    "queryPlan": {
      "intent": "aggregate",
      "aggregations": [{ "column": "quantity", "function": "SUM", "alias": "total_qty" }],
      "groupBy": ["region"],
      "explanation": "SUM of quantity grouped by region"
    },
    "data": [
      { "region": "North", "total_qty": 12500 },
      { "region": "South", "total_qty": 8300 }
    ],
    "resultSummary": { "rowCount": 4, "columns": ["region", "total_qty"] }
  }
}
```

When clarification is needed:
```json
{
  "data": {
    "sessionId": "uuid",
    "answer": "Could you specify which column you'd like to analyze?",
    "clarificationNeeded": true,
    "queryPlan": { "clarification_needed": true, "clarification_message": "..." }
  }
}
```

---

### GET `/workspaces/:workspaceId/assistant/sessions?limit=20&offset=0`

List conversation sessions for the current user.

**Response:**
```json
{
  "data": {
    "sessions": [
      {
        "id": "uuid",
        "title": "What is the total quantity...",
        "datasetId": "uuid",
        "datasetName": "Sales Data",
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-01T00:05:00Z",
        "messageCount": 6
      }
    ],
    "total": 15,
    "limit": 20,
    "offset": 0
  }
}
```

---

### GET `/workspaces/:workspaceId/assistant/sessions/:sessionId`

Get a specific session's metadata.

---

### GET `/workspaces/:workspaceId/assistant/sessions/:sessionId/messages`

Get all messages in a conversation.

**Response:**
```json
{
  "data": {
    "messages": [
      {
        "id": "uuid",
        "role": "user",
        "content": "What is the total quantity by region?",
        "queryPlan": null,
        "resultSummary": null,
        "createdAt": "2026-01-01T00:00:00Z"
      },
      {
        "id": "uuid",
        "role": "assistant",
        "content": "SUM of quantity grouped by region",
        "queryPlan": { "..." : "..." },
        "resultSummary": { "rowCount": 4, "columns": ["region", "total_qty"] },
        "createdAt": "2026-01-01T00:00:01Z"
      }
    ]
  }
}
```

---

### DELETE `/workspaces/:workspaceId/assistant/sessions/:sessionId`

Delete a conversation session. Requires `editor` role or above.

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Request body/params validation failed |
| `INVALID_IDENTIFIER` | 400 | Column or table name contains unsafe characters |
| `INVALID_COLUMN` | 400 | Column does not exist in the dataset schema |
| `INVALID_AGGREGATION` | 400 | Unsupported aggregation function |
| `COLUMN_NOT_AGGREGATABLE` | 400 | Column data type does not support the requested aggregation |
| `INVALID_FILTER_OPERATOR` | 400 | Unknown filter operator |
| `INVALID_QUERY_PLAN` | 400 | AI-generated query plan failed schema validation |
| `EMPTY_QUERY_PLAN` | 400 | Query plan has no fields or aggregations |
| `UNAUTHENTICATED` | 401 | No valid session cookie |
| `FORBIDDEN` | 403 | Insufficient workspace role |
| `DATASET_NOT_FOUND` | 404 | Dataset does not exist or is not accessible |
| `SESSION_NOT_FOUND` | 404 | Conversation session not found |
| `DATASET_NOT_READY` | 409 | Dataset is still processing or has errors |
| `DATASET_NO_COLUMNS` | 409 | Dataset has no column metadata |
| `LLM_ERROR` | 502 | AI service communication failure |
| `LLM_EMPTY_RESPONSE` | 502 | AI service returned empty response |
| `LLM_INVALID_RESPONSE` | 502 | AI service returned unparseable JSON |

---

## Security

- All queries are **read-only** with `SET LOCAL default_transaction_read_only = ON`.
- All queries have an **8-second timeout** (`SET LOCAL statement_timeout = 8000`).
- Row-level security (RLS) enforces **tenant isolation** — users can only access their organization's data.
- Column names and table names are **whitelist-validated** against actual dataset metadata.
- SQL is always **parameterized** — no string interpolation of user input.
- The LLM produces a **structured JSON plan**, never raw SQL. The plan is validated before execution.
- Result sets are **limited** (max 10,000 rows for queries, 1,000 for charts).

