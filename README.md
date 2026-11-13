# Data Nexus — Analytics & AI Module

> Generic analytics engine, dynamic KPI/chart APIs, AI-assisted natural-language querying, and conversation history for the Data Nexus platform.

**Branch:** `Analytics-AI`  
**Base:** Merged from `Backend` (Phase 1 & 2)  
**Stack:** Node.js · Express.js · PostgreSQL (pg) · Zod · LLM (OpenAI / Gemini)

---

## Overview

This module adds a **schema-agnostic analytics engine** and an **AI data assistant** to Data Nexus. It works with any uploaded dataset — retail, logistics, education, healthcare — without hardcoding domain-specific metrics like revenue or sales.

### Key Principles

- **No raw LLM-generated SQL** — the LLM produces a structured JSON query plan; the backend validates it and builds safe, parameterized SQL.
- **No hardcoded analytics** — all queries are driven by the dataset's actual column metadata.
- **Tenant isolation** — every query is scoped through PostgreSQL Row-Level Security (RLS).
- **Read-only execution** — all analytics queries run with `SET LOCAL default_transaction_read_only = ON` and an 8-second timeout.

---

## Features

### 1. Generic Analytics Engine

| Capability | Details |
|------------|---------|
| Aggregations | `COUNT`, `SUM`, `AVG`, `MIN`, `MAX` |
| Filters | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `like`, `is_null`, `is_not_null` |
| Grouping | Up to 10 columns |
| Sorting | Up to 5 order-by clauses with ASC/DESC |
| Pagination | Offset/limit (max 10,000 rows) with total count |
| Security | Parameterized SQL, whitelist-validated identifiers, no string interpolation |

### 2. Dynamic KPI & Chart APIs

- **KPI endpoint** — returns named aggregate values with configurable metrics and filters
- **Chart endpoint** — returns category-grouped data for `bar`, `line`, `pie`, and `area` charts (Recharts-compatible)
- **Summary endpoint** — per-column statistics: row count, distinct count, nulls, min/max/avg/sum

### 3. AI Data Assistant

- Users ask natural-language questions about a selected dataset
- LLM interprets the question into a **strict structured JSON query plan**
- The plan is validated against the real dataset schema, allowed operations, and tenant scope
- Safe, parameterized SQL is constructed from the validated plan
- Supports **OpenAI-compatible APIs** and **Google Gemini**
- **Rule-based fallback parser** for development/testing without an LLM key
- Handles ambiguous questions with a clarification flow

### 4. Conversation History

- Sessions and messages stored in PostgreSQL with RLS
- Users can list, retrieve, continue, and delete conversations
- Query plans and result summaries are persisted per message

---

## API Endpoints

All endpoints are prefixed with `/api/v1` and require authentication + workspace authorization.

### Analytics

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/workspaces/:wid/datasets/:did/analytics/query` | viewer+ | Generic analytics query |
| `POST` | `/workspaces/:wid/datasets/:did/analytics/kpi` | viewer+ | Dynamic KPI metrics |
| `POST` | `/workspaces/:wid/datasets/:did/analytics/chart` | viewer+ | Chart-ready data |
| `GET` | `/workspaces/:wid/datasets/:did/analytics/summary` | viewer+ | Dataset summary stats |

### AI Assistant

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/workspaces/:wid/datasets/:did/assistant/ask` | viewer+ | Ask a question |
| `GET` | `/workspaces/:wid/assistant/sessions` | viewer+ | List sessions |
| `GET` | `/workspaces/:wid/assistant/sessions/:sid` | viewer+ | Get session |
| `GET` | `/workspaces/:wid/assistant/sessions/:sid/messages` | viewer+ | Get messages |
| `DELETE` | `/workspaces/:wid/assistant/sessions/:sid` | editor+ | Delete session |

> Full request/response schemas and error codes are documented in [`backend/docs/ANALYTICS_API.md`](backend/docs/ANALYTICS_API.md).

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── env.js                          # + LLM env vars
│   ├── controllers/
│   │   ├── analytics.controller.js         ★ NEW
│   │   └── assistant.controller.js         ★ NEW
│   ├── database/
│   │   └── migrations/
│   │       ├── 001_identity_and_tenants.sql
│   │       └── 002_analytics_and_ai.sql    ★ NEW
│   ├── routes/
│   │   ├── analytics.routes.js             ★ NEW
│   │   └── assistant.routes.js             ★ NEW
│   ├── schemas/
│   │   ├── analytics.schemas.js            ★ NEW
│   │   └── assistant.schemas.js            ★ NEW
│   ├── services/
│   │   ├── analytics.service.js            ★ NEW
│   │   ├── assistant.service.js            ★ NEW
│   │   ├── assistant-history.service.js    ★ NEW
│   │   └── query-builder.service.js        ★ NEW
│   └── app.js                              # + route registration
├── tests/
│   ├── query-builder.test.js               ★ NEW (25 tests)
│   ├── analytics-schemas.test.js           ★ NEW (16 tests)
│   ├── assistant-schemas.test.js           ★ NEW (12 tests)
│   └── integration/
│       └── analytics-ai.integration.test.js ★ NEW
└── docs/
    └── ANALYTICS_API.md                    ★ NEW
```

---

## Setup

### Environment Variables

Add these to your `.env` (all optional — falls back to rule-based parser without an LLM key):

```env
LLM_PROVIDER=openai          # "openai" or "gemini"
LLM_API_KEY=                  # your API key
LLM_BASE_URL=                 # custom endpoint (optional)
LLM_MODEL=gpt-4o-mini         # model name
```

### Database Migration

After provisioning PostgreSQL with the required roles:

```bash
cd backend
npm run db:migrate
```

This applies `002_analytics_and_ai.sql` which creates:
- `datasets` and `dataset_columns` (stub tables for Data Engineering coordination)
- `assistant_sessions` and `assistant_messages`
- RLS policies on all tables

### Running Tests

```bash
cd backend
npm test
```

**Result:** 72 tests passing, 0 failures, 9 skipped (need PostgreSQL).

---

## Security

| Layer | Protection |
|-------|------------|
| SQL Injection | Parameterized queries — no string interpolation of user input |
| Identifier Injection | Column/table names whitelist-validated against `dataset_columns` metadata |
| Tenant Isolation | PostgreSQL RLS enforces organization-level scoping |
| Query Safety | `SET LOCAL default_transaction_read_only = ON` on all analytics queries |
| Query Timeout | `SET LOCAL statement_timeout = 8000` (8 seconds) |
| LLM Safety | LLM produces JSON plans only — never raw SQL; plans validated before execution |
| Row Limits | Max 10,000 rows (queries), 1,000 (charts), 100 (sessions) |
| Input Validation | Zod schemas on all request bodies, params, and query strings |

---

## Team Coordination

| Team | Notes |
|------|-------|
| **Backend** | Reuses shared pool, `withTenantTransaction`, `authenticate`, `authorizeWorkspace`, `validate`, `asyncHandler`, error handler. No new Express app or DB connection. |
| **Data Engineering** | Migration 002 defines stub `datasets` and `dataset_columns` tables. Coordinate if these are defined separately. Analytics reads column metadata from `dataset_columns`. |
| **Frontend** | Chart API returns `[{ category: "value", metric: number }]` compatible with Recharts. KPI API returns `{ kpis: [{ label, column, aggregation, value }] }` for StatCard. |

---

## License

Part of the Data Nexus project.
