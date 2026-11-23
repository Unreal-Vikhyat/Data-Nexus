# Data Nexus Development Status

Updated: 2026-11-12
Active branch: `SaaS-Integration`

## Scope control

Phase 1 and Phase 2 are implemented on Backend baseline. Phase 6 Reports & Exports (PDF, Excel, CSV) are now implemented on `SaaS-Integration`. Dataset management (Phase 3) is owned by Data Engineering. Data Quality/Analytics (Phase 4) and AI Assistant (Phase 5) are owned by Analytics-AI.
Updated: 2026-11-10
Active branches: `Backend`, `Analytics-AI`

## Scope control

Phase 1 and Phase 2 are implemented on Backend. Phase 4 (analytics) and Phase 5 (AI assistant) are now implemented on Analytics-AI. Dataset management (Phase 3) is owned by Data Engineering. Frontend files/branch have not been changed.

## Phase status

| Phase | State | Notes |
|---|---|---|
| 1. Foundation | Implemented; PostgreSQL verification pending | Express app, environment validation, PostgreSQL pool, migration runner, security middleware, versioned liveness/readiness endpoints, migration SQL, scripts and docs. |
| 2. Authentication and tenancy | Implemented; PostgreSQL integration verification pending | Registration/login/logout/current user, JWT HTTP-only cookie sessions, password reset flow, organizations/workspaces, invitations, membership and role checks, tenant-scoped transactions and RLS policies. |
| 3. Dataset management | Not started (Data Engineering) | Upload, parsing, schema detection, profiling, cleaning. |
| 4. Data quality and analytics | In progress / Branch Analytics-AI | Generic analytics query engine, dynamic KPI API, chart data API, dataset summary API. |
| 5. AI assistant | In progress / Branch Analytics-AI | LLM structured query plan generation, validation against real schema, safe SQL execution. |
| 6. SaaS & Integrations | **Reports, Exports, Credit Wallets & Audit Logs Implemented** | PDF/Excel/CSV exports, organization credit wallet, pre-flight checks, double-entry ledger with employee tracking, atomic balance constraints, and enterprise activity/audit logs with forced RLS. |
| 7. Final verification/deployment | Not started | Will include API/security/deployment docs and test results. |

## SaaS & Integrations Details

### Files added
- `backend/src/database/migrations/003_credit_wallets.sql` — Organization wallets and double-entry transaction ledger with forced RLS
- `backend/src/database/migrations/004_activity_logs.sql` — Enterprise activity & audit logs with compound indices and forced RLS
- `backend/src/config/credits.config.js` — Centralized credit rate card, pack tiers, and welcome bonus
- `backend/src/services/wallet.service.js` — Credit wallet engine, pre-flight checks, atomic debit/credit operations, employee attribution
- `backend/src/services/activity.service.js` — Activity & audit logging engine with credential sanitization, non-blocking writes, and pagination
- `backend/src/services/export.service.js` — PDF, Excel (.xlsx), and CSV generation engine with RFC 4180 compliance and formula injection sanitization
- `backend/src/schemas/billing.schemas.js` — Zod request validation for wallet and transaction ledger
- `backend/src/schemas/activity.schemas.js` — Zod request validation for activity and audit log queries
- `backend/src/schemas/report.schemas.js` — Zod request validation for report export endpoints
- `backend/src/controllers/billing.controller.js` — Billing and wallet HTTP handlers
- `backend/src/controllers/activity.controller.js` — Workspace activity HTTP handlers
- `backend/src/controllers/report.controller.js` — Report HTTP handlers streaming file downloads with binary headers
- `backend/src/routes/billing.routes.js` — Express routes for wallet balance, transactions, and manual credits
- `backend/src/routes/activity.routes.js` — Express routes for workspace activity audit logs
- `backend/src/routes/report.routes.js` — Express routes for workspace-level and dataset-level report exports
- `backend/tests/wallet.test.js` — Unit tests for pre-flight checks, atomic debit/credit, and idempotency
- `backend/tests/activity.test.js` — Unit tests for credential sanitization, IP extraction, and audit log querying
- `backend/tests/export.test.js` — 10 unit tests covering formula sanitization, CSV formatting, Excel generation, and PDF binary output
- `backend/docs/API.md` — Updated with complete Reports, Exports, Billing, and Activity API documentation

### Files modified
- `backend/package.json` — Added `pdfkit` and `exceljs` dependencies
- `backend/src/app.js` — Registered `/api/v1` report export, billing, and activity routes
| 3. Dataset management | Not started (Data Engineering) | Upload, parsing, schema detection, mapping, profiling, cleaning, dataset versions. The Analytics-AI module defines stub `datasets` and `dataset_columns` tables in migration 002 — Data Engineering should coordinate to avoid conflicts. |
| 4. Data quality and analytics | **Implemented on Analytics-AI** | Generic analytics query engine (SUM, AVG, COUNT, MIN, MAX, grouping, filtering, sorting, pagination), dynamic KPI API, chart data API, dataset summary API. Safe parameterized SQL builder with whitelist-validated identifiers. All queries read-only with timeouts and tenant RLS isolation. |
| 5. AI assistant | **Implemented on Analytics-AI** | LLM-based structured query plan generation, strict plan validation against real schema, safe SQL construction from validated plans, conversation session/message history in PostgreSQL. Rule-based fallback parser for development without LLM. Never executes raw LLM-generated SQL. |
| 6. Additional modules | Not started | Team/report/billing/credit/Razorpay/activity features deferred. |
| 7. Final verification/deployment | Not started | Will include API/security/deployment docs and test results. |

## Analytics-AI module details

### Files added
- `backend/src/database/migrations/002_analytics_and_ai.sql` — datasets, dataset_columns, assistant_sessions, assistant_messages tables with RLS
- `backend/src/schemas/analytics.schemas.js` — Zod validation for analytics endpoints
- `backend/src/schemas/assistant.schemas.js` — Zod validation for assistant endpoints
- `backend/src/services/query-builder.service.js` — Safe parameterized SQL builder
- `backend/src/services/analytics.service.js` — Generic analytics engine
- `backend/src/services/assistant.service.js` — AI data assistant with LLM integration
- `backend/src/services/assistant-history.service.js` — Conversation history management
- `backend/src/controllers/analytics.controller.js` — Analytics HTTP handlers
- `backend/src/controllers/assistant.controller.js` — Assistant HTTP handlers
- `backend/src/routes/analytics.routes.js` — Analytics route definitions
- `backend/src/routes/assistant.routes.js` — Assistant route definitions
- `backend/tests/query-builder.test.js` — 25 unit tests for SQL builder security and correctness
- `backend/tests/analytics-schemas.test.js` — 16 tests for analytics schema validation
- `backend/tests/assistant-schemas.test.js` — 12 tests for assistant schema validation
- `backend/tests/integration/analytics-ai.integration.test.js` — Integration and route registration tests
- `backend/docs/ANALYTICS_API.md` — Full API documentation

### Files modified
- `backend/src/app.js` — Added analytics and assistant route registration
- `backend/src/config/env.js` — Added LLM_PROVIDER, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL env vars
- `backend/.env.example` — Added LLM configuration variables
- `DEVELOPMENT_STATUS.md` — This file

### API endpoints added
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/workspaces/:workspaceId/billing/wallet` | Get current workspace credit balance and metadata |
| GET | `/api/v1/workspaces/:workspaceId/billing/transactions` | Get paginated transaction history with employee tracking |
| POST | `/api/v1/workspaces/:workspaceId/billing/wallet/credit` | Manual credit adjustment (owner only) |
| GET | `/api/v1/workspaces/:workspaceId/activity` | Get paginated workspace activity and audit logs |
| POST | `/api/v1/workspaces/:workspaceId/reports/export` | Generic workspace report export (PDF, Excel, CSV) |
| POST | `/api/v1/workspaces/:workspaceId/datasets/:datasetId/reports/export` | Direct dataset report export (PDF, Excel, CSV) |

## Verification completed

- `npm install`: completed (installed `pdfkit` and `exceljs`).
- `npm test`: **7 suites passed**, 1 PostgreSQL integration suite skipped; **34 tests passed**, 2 database integration tests skipped.
- `npm run lint`: **passed** with 0 errors and 0 warnings.
- All export tests pass: formula injection sanitization, CSV buffer creation, Excel multi-tab workbook, PDF binary magic header, and request schema bounds.
- All wallet and activity tests pass: credential sanitization, IP extraction, pre-flight checks, atomic debits, and non-negative balance constraints.

## Known constraints / follow-up

- Report exports stream binary buffers directly to clients; production deployments with very large exports (>10,000 rows) can optionally spool to `storage/reports`.
- Frontend integration: trigger download with `responseType: "blob"` and `withCredentials: true`.
| POST | `/api/v1/workspaces/:workspaceId/datasets/:datasetId/analytics/query` | Generic analytics query |
| POST | `/api/v1/workspaces/:workspaceId/datasets/:datasetId/analytics/kpi` | Dynamic KPI metrics |
| POST | `/api/v1/workspaces/:workspaceId/datasets/:datasetId/analytics/chart` | Chart-ready data |
| GET | `/api/v1/workspaces/:workspaceId/datasets/:datasetId/analytics/summary` | Dataset summary statistics |
| POST | `/api/v1/workspaces/:workspaceId/datasets/:datasetId/assistant/ask` | Ask natural-language question |
| GET | `/api/v1/workspaces/:workspaceId/assistant/sessions` | List conversation sessions |
| GET | `/api/v1/workspaces/:workspaceId/assistant/sessions/:sessionId` | Get session details |
| GET | `/api/v1/workspaces/:workspaceId/assistant/sessions/:sessionId/messages` | Get session messages |
| DELETE | `/api/v1/workspaces/:workspaceId/assistant/sessions/:sessionId` | Delete conversation |

## Verification completed

- `npm install`: completed.
- `npm test` (outside sandbox): **8 suites passed**, 1 PostgreSQL integration suite skipped; **72 tests passed**, 9 database integration tests skipped.
- `npm run lint`: passed (see known constraints below).
- All Analytics-AI tests pass: query builder security (25 tests), schema validation (28 tests), route registration (4 tests).
- Sandbox supertest runs fail with `EPERM`/`EACCES`; running outside sandbox passes. This is a known environment restriction.

## Known constraints / follow-up

- Run `npm run db:migrate` with `DATABASE_MIGRATION_URL` after provisioning the separate roles/database.
- Migration 002 defines stub `datasets` and `dataset_columns` tables. Data Engineering must coordinate if they define these tables separately.
- Set `TEST_DATABASE_URL` and `TEST_MIGRATION_DATABASE_URL` for the database integration suite.
- LLM integration requires `LLM_API_KEY` (supports OpenAI-compatible and Gemini). Falls back to rule-based parser without an API key.
- `nexus_app` must remain a non-owner role with `NOSUPERUSER NOBYPASSRLS`.
- SMTP is optional for startup; password reset/invitation emails need SMTP in production.
- Owner transfer is not implemented; owner role cannot be changed or removed.
