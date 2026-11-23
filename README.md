# Data Nexus — SaaS & Integrations Platform

> Enterprise Multi-Tenant Data Analytics, Credit Wallet Billing, Razorpay Payment Gateway, Multi-Format Report Exports, Team Email Workflows, and Audit Logging.

**Repository:** [https://github.com/Unreal-Vikhyat/Data-Nexus](https://github.com/Unreal-Vikhyat/Data-Nexus)  
**Branch:** `SaaS-Integration`  
**API Prefix:** `/api/v1`

---

## Table of Contents
1. [Overview & Architecture](#overview--architecture)
2. [The 5 SaaS & Integration Fronts](#the-5-saas--integration-fronts)
   - [1. Credit Wallet & Double-Entry Ledger](#1-credit-wallet--double-entry-ledger)
   - [2. Razorpay Payments & Cryptographic Verification](#2-razorpay-payments--cryptographic-verification)
   - [3. Multi-Format Report Exports (PDF, Excel, CSV)](#3-multi-format-report-exports-pdf-excel-csv)
   - [4. Team Invitations & Transactional Email Workflows](#4-team-invitations--transactional-email-workflows)
   - [5. Organization Activity & Enterprise Audit Logs](#5-organization-activity--enterprise-audit-logs)
3. [Implementation Matrix: What Is Built vs. What Remains](#implementation-matrix-what-is-built-vs-what-remains)
4. [Cross-Team Integration Contract](#cross-team-integration-contract)
   - [What Frontend Needs to Implement (React + Tailwind)](#what-frontend-needs-to-implement-react--tailwind)
   - [What Analytics & AI Needs to Implement](#what-analytics--ai-needs-to-implement)
   - [What Data Engineering Needs to Implement](#what-data-engineering-needs-to-implement)
5. [Complete API Reference](#complete-api-reference)
6. [Database Migrations & Multi-Tenant Security (RLS)](#database-migrations--multi-tenant-security-rls)
7. [Environment Configuration](#environment-configuration)
8. [Local Development & Automated Testing](#local-development--automated-testing)

---

## Overview & Architecture

Data Nexus is a multi-tenant SaaS analytics platform where organizations upload datasets, analyze metrics with AI assistance, collaborate across team roles, and pay for compute/usage via a prepaid credit wallet.

The `SaaS-Integration` branch extends the foundational identity/tenancy architecture (Phase 1 & 2) by delivering the complete commercial infrastructure and supporting collaboration tooling:

```
                            ┌────────────────────────────────────────┐
                            │          Data Nexus Frontend           │
                            │      (React + Vite + Tailwind CSS)     │
                            └───────────────────┬────────────────────┘
                                                │ HTTPS / Cookies
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                Data Nexus REST API (/api/v1)                           │
├────────────────────┬────────────────────┬────────────────────┬────────────────────────┤
│   Credit Wallet    │ Razorpay Payments  │  Report Exports    │   Activity Logs &      │
│     & Ledger       │   & Verification   │ (PDF / XLSX / CSV) │   Email Workflows      │
├────────────────────┼────────────────────┼────────────────────┼────────────────────────┤
│ • Pre-flight check │ • Credit pack tiers│ • Vector PDFKit    │ • Actor attribution    │
│ • Atomic debits    │ • Server-side order│ • ExcelJS Sheets   │ • Credential scrub     │
│ • Non-negative chk │ • HMAC-SHA256 check│ • Formula sanitize │ • Brevo v3 / SMTP      │
│ • Member tracking  │ • Idempotent credit│ • Streamed buffers │ • Responsive HTML      │
└────────────────────┴────────────────────┴────────────────────┴────────────────────────┘
                                                │
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL Database with Forced RLS                             │
│       organization_wallets  │  wallet_transactions  │  activity_logs  │  invitations   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## The 5 SaaS & Integration Fronts

### 1. Credit Wallet & Double-Entry Ledger

Provides organizations with a commercial prepaid credit balance to meter heavy computations, exports, and AI queries.

- **Non-Negative Balance Guarantee**: Guaranteed at the database level with `CHECK (balance >= 0)`.
- **Two-Tier Balance Protection**:
  1. *Tier 1 (Application Pre-Flight Check)*: `assertSufficientCredits(client, orgId, cost)` verifies available balance before starting CPU-intensive rendering or external LLM calls. Throws HTTP `402 Payment Required` (`INSUFFICIENT_CREDITS`) if balance is deficient.
  2. *Tier 2 (Atomic Row Lock)*: `debitWallet` executes `UPDATE organization_wallets SET balance = balance - $1 WHERE organization_id = $2 AND balance >= $1 RETURNING balance` inside a tenant transaction. Eliminates race conditions and concurrent double-spending.
- **Double-Entry Transaction Ledger (`wallet_transactions`)**:
  - Every adjustment records `amount`, `balance_after`, `reference_type`, `reference_id`, and `idempotency_key`.
  - **Employee Tracking**: Stores `user_id` on every debit/credit. Ledger queries join `app.users` so organization owners can see exactly which employee spent credits (`userName`, `userEmail`).
- **Starter Welcome Bonus**: New workspaces are automatically initialized with **50.00 free credits**.
- **Centralized Rate Card (`credits.config.js`)**:
  - PDF Export: **5 credits**
  - Excel (.xlsx) Export: **2 credits**
  - CSV Export: **1 credit**
  - AI Assistant Query: **3 credits**
  - Complex Analytics Query: **1 credit**

---

### 2. Razorpay Payments & Cryptographic Verification

Enables organizations to purchase credit bundles securely through India's standard payment gateway (Razorpay).

- **Standard Credit Bundles**:
  - **Starter Pack**: 100 credits for ₹499 (`pack_starter`, 49900 paise)
  - **Growth Pack**: 500 credits for ₹1,999 (`pack_growth`, 199900 paise, Most Popular)
  - **Scale Pack**: 2,000 credits for ₹6,999 (`pack_scale`, 699900 paise)
- **Server-Side Order Generation (`razorpay.service.js`)**:
  - Creates authoritative orders using the official Razorpay SDK (`razorpayClient.orders.create`).
  - Locks amount in paise with metadata notes (`workspaceId`, `userId`, `packId`, `credits`).
- **Cryptographic Signature Verification**:
  - Computes `HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)`.
  - Validates signatures using `crypto.timingSafeEqual` to prevent side-channel timing attacks.
  - Zero trust: Never credits a wallet based on client-side status flags alone.
- **Idempotent Fulfillment**:
  - Credits the wallet with `idempotencyKey = "rzp_" + paymentId`. Duplicate verification calls or network retries return the existing transaction without double-crediting.

---

### 3. Multi-Format Report Exports (PDF, Excel, CSV)

Allows authorized users to download reports and dataset extracts with enterprise formatting and formula security.

- **Formula Injection Mitigation (CWE-1236)**:
  - Cells beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` are prefixed with a single quote (`'`) to neutralize dynamic formula execution in Microsoft Excel, LibreOffice, and Google Sheets.
  - RFC 4180 escaping wraps entries containing commas, quotes, or newlines in double quotes.
- **Executive PDF Engine (`PDFKit`)**:
  - Generates A4 vector PDFs with custom brand banner, workspace metadata, executive KPI metric summary cards, and alternating zebra-striped data tables with automatic multi-page pagination.
- **Structured Excel Engine (`ExcelJS`)**:
  - Multi-tab `.xlsx` workbooks containing a styled "Overview" sheet (KPI cards, generation timestamp, record count) and a "Data" sheet with styled dark headers and alternating row fills.
- **Compliant CSV Engine**:
  - High-performance, RFC 4180 compliant CSV generator.
- **Unified Pipeline**:
  - Automatically loads dataset columns and rows or accepts custom query aggregations.
  - Executes pre-flight balance assertion -> generates buffer -> atomically debits wallet -> logs audit event -> streams buffer with `Content-Disposition: attachment`.

---

### 4. Team Invitations & Transactional Email Workflows

Enables seamless organization growth through email invitations and password resets.

- **Dual-Provider Architecture (`email.service.js`)**:
  - **Primary (Brevo REST API v3)**: High-deliverability transactional emails via HTTP POST `https://api.brevo.com/v3/smtp/email` using `BREVO_API_KEY`.
  - **Secondary (Nodemailer / SMTP)**: Standard SMTP fallback using `SMTP_URL` or `SMTP_HOST`/`SMTP_PORT`.
  - **Development Fallback**: In `development` or `test` mode without SMTP credentials, endpoints return the generated invitation/reset URL in the response payload for easy local testing without external mail dependencies.
- **Responsive HTML Email Templates**:
  - Custom branded templates with responsive cards, workspace name badges, "Join Workspace" buttons, fallback copy-paste links, and security expiration notices.
- **Secure Expiring Tokens**:
  - Invitations generate high-entropy tokens stored as SHA-256 hashes (`token_hash`) in PostgreSQL with expiration timestamps (`expires_at`).

---

### 5. Organization Activity & Enterprise Audit Logs

Tracks administrative, billing, and data export events for security, compliance, and user accountability.

- **Sanitized Metadata Storage**:
  - `logActivity` automatically scrubs sensitive keys (`password`, `token`, `secret`, `rawBody`, `apiKey`) before storing JSON metadata.
- **Actor & Client Attribution**:
  - Records `organization_id`, `user_id`, `action`, `entity_type`, `entity_id`, and resolves client IP address via `x-forwarded-for` or socket remote address.
- **Non-Blocking Resilience**:
  - Audit logging is wrapped so database audit errors log a warning without aborting the user's primary business transaction.
- **Forced Row Level Security (RLS)**:
  - `activity_logs` enforces RLS: tenants cannot access or tamper with logs belonging to another organization.
- **Pre-Wired Event Hooks**:
  - Automatically logs `report.export` on report downloads.
  - Automatically logs `wallet.debit` on credit consumption.
  - Automatically logs `wallet.credit` on credit purchases and manual adjustments.

---

## Implementation Matrix: What Is Built vs. What Remains

| Component | Status | Implementation Details |
|---|---|---|
| **Credit Wallets** | **100% Complete** | `003_credit_wallets.sql`, `wallet.service.js`, atomic balance deductions, non-negative checks, 50-credit welcome bonus. |
| **Transaction Ledger** | **100% Complete** | `wallet_transactions` table with employee attribution (`user_id`, `userName`, `userEmail`), balance tracking, idempotency. |
| **Credit Rate Card** | **100% Complete** | `credits.config.js`: PDF (5), Excel (2), CSV (1), AI Query (3), Analytics Query (1). |
| **Razorpay Orders** | **100% Complete** | `POST /billing/orders`: Server-side order creation via Razorpay SDK with metadata notes and fixed credit pack tiers. |
| **Payment Verification** | **100% Complete** | `POST /billing/verify`: HMAC-SHA256 timing-safe verification, automatic idempotent wallet crediting. |
| **Razorpay Webhooks** | *Pending* | Raw body HMAC verification endpoint (`POST /billing/webhooks/razorpay`) and `webhook_events` deduplication table. |
| **PDF Report Export** | **100% Complete** | `PDFKit` vector document with executive branding, KPI metric summary cards, and zebra tables. |
| **Excel Report Export** | **100% Complete** | `ExcelJS` multi-tab workbook with formula injection protection and formatted columns. |
| **CSV Report Export** | **100% Complete** | RFC 4180 compliant CSV stream with formula neutralization (CWE-1236). |
| **Pre-Flight Credit Check** | **100% Complete** | Halts heavy exports before rendering if balance is deficient (HTTP 402 `INSUFFICIENT_CREDITS`). |
| **Email Invitations** | **100% Complete** | Brevo v3 + SMTP Nodemailer engine, responsive HTML email templates, development fallback URLs. |
| **Invite Resend / Revoke** | *Pending* | Optional dedicated endpoints to resend or invalidate pending invites before expiration. |
| **Activity & Audit Logs** | **100% Complete** | `004_activity_logs.sql`, `activity.service.js`, forced RLS, credential scrubbing, IP extraction. |
| **Activity API Feed** | **100% Complete** | `GET /workspaces/:workspaceId/activity` with pagination, action filtering, and user joins. |

---

## Cross-Team Integration Contract

### What Frontend Needs to Implement (React + Tailwind)

1. **Billing & Credit Wallet Screen (`/workspaces/:workspaceId/billing`)**:
   - **Balance Widget**: Call `GET /billing/wallet` to show available credits and currency.
   - **Credit Pack Selector**: Call `GET /billing/packs` and render tier cards:
     - Starter (100 credits — ₹499)
     - Growth (500 credits — ₹1,999 — Popular Badge)
     - Scale (2,000 credits — ₹6,999)
   - **Razorpay Checkout Integration**:
     - When user clicks "Buy Credits", call `POST /billing/orders` with `{ packId }`.
     - Open Razorpay modal with returned `orderId`, `amount`, `currency`, and `keyId`:
       ```javascript
       const options = {
         key: data.keyId,
         amount: data.amount,
         currency: data.currency,
         name: "Data Nexus",
         description: data.pack.name,
         order_id: data.orderId,
         handler: async function (response) {
           // Verify on server
           await api.post(`/workspaces/${workspaceId}/billing/verify`, {
             orderId: response.razorpay_order_id,
             paymentId: response.razorpay_payment_id,
             signature: response.razorpay_signature,
             packId: data.pack.id,
           });
           // Refresh wallet balance
         },
       };
       const rzp = new window.Razorpay(options);
       rzp.open();
       ```
   - **Transaction Ledger Table**:
     - Call `GET /billing/transactions?limit=20&offset=0`.
     - Render columns: Date, Description, Type (`credit`/`debit`), Amount, Balance After, and **Initiated By** (`userName` / `userEmail`).

2. **Report Export Dialog**:
   - In dataset and analytics views, render an **"Export Report"** button opening a modal with format options:
     - PDF (Cost: 5 Credits)
     - Excel (Cost: 2 Credits)
     - CSV (Cost: 1 Credit)
   - Trigger download via Axios with `responseType: "blob"`:
     ```javascript
     const response = await api.post(
       `/workspaces/${workspaceId}/reports/export`,
       { format: "pdf", title: "Sales Report", customColumns, customRows },
       { responseType: "blob" }
     );
     // Trigger browser file save from blob
     ```
   - Handle HTTP `402 INSUFFICIENT_CREDITS`: Prompt user with a modal: *"You need 5 credits to export this PDF. Your balance is 2. Click here to recharge."*

3. **Workspace Activity Feed Screen (`/workspaces/:workspaceId/activity`)**:
   - Call `GET /api/v1/workspaces/:workspaceId/activity`.
   - Render chronological event timeline showing: Actor Avatar/Name, Action Badge (`report.export`, `wallet.debit`, `member.invite`), Date/Time, and IP Address.

4. **Invitation Accept Route (`/invite?token=...`)**:
   - Read token from URL query parameters.
   - If user is not logged in, route to `/register` or `/login` with return URL.
   - Once authenticated, call `POST /api/v1/invitations/accept` with `{ token }`.

---

### What Analytics & AI Needs to Implement

1. **Credit Checking & Metering for AI Assistant**:
   - Before executing an LLM completion or structured SQL query, import and call:
     ```javascript
     import { assertSufficientCredits, debitWallet } from "../services/wallet.service.js";
     import { CREDIT_COSTS } from "../config/credits.config.js";

     // Pre-flight check (3 credits)
     await assertSufficientCredits(client, workspaceId, CREDIT_COSTS.ASSISTANT_QUERY);

     // Execute LLM query ...

     // Debit upon completion
     await debitWallet(userId, workspaceId, {
       amount: CREDIT_COSTS.ASSISTANT_QUERY,
       referenceType: "ai_query",
       description: "AI Query: " + promptSummary,
       client,
     });
     ```
2. **Export Feed**:
   - Direct output from Analytics KPIs and dynamic chart aggregation endpoints can be sent straight to `POST /reports/export` with `summaryMetrics`, `customColumns`, and `customRows`.

---

### What Data Engineering Needs to Implement

1. **Activity Logging**:
   - When dataset ingestion completes or when a dataset is deleted, call:
     ```javascript
     import { logActivity } from "../services/activity.service.js";

     await logActivity({
       organizationId,
       userId,
       action: "dataset.upload",
       entityType: "dataset",
       entityId: dataset.id,
       details: { name: dataset.name, rowCount: dataset.row_count },
     });
     ```

---

## Complete API Reference

All routes require standard session authentication via HTTP-only cookie (`credentials: "include"`).

### Billing & Wallet

| Method | Endpoint | Min Role | Description |
|---|---|---|---|
| `GET` | `/api/v1/workspaces/:workspaceId/billing/wallet` | `viewer` | Returns wallet balance (`balance`, `currency`, `updatedAt`). |
| `GET` | `/api/v1/workspaces/:workspaceId/billing/transactions` | `viewer` | Paginated transaction ledger with employee attribution (`limit`, `offset`, `type`). |
| `POST` | `/api/v1/workspaces/:workspaceId/billing/wallet/credit` | `owner` | Administrative manual credit top-up (`amount`, `description`). |
| `GET` | `/api/v1/workspaces/:workspaceId/billing/packs` | `viewer` | List available Razorpay credit bundles (`Starter`, `Growth`, `Scale`). |
| `POST` | `/api/v1/workspaces/:workspaceId/billing/orders` | `member` | Create server-side Razorpay order (`packId`). |
| `POST` | `/api/v1/workspaces/:workspaceId/billing/verify` | `member` | Cryptographically verify HMAC-SHA256 signature and credit wallet. |

### Reports & Exports

| Method | Endpoint | Min Role | Description |
|---|---|---|---|
| `POST` | `/api/v1/workspaces/:workspaceId/reports/export` | `viewer` | Exports arbitrary data/analytics to PDF (5 credits), Excel (2 credits), or CSV (1 credit). Streams binary file. |
| `POST` | `/api/v1/workspaces/:workspaceId/datasets/:datasetId/reports/export` | `viewer` | Direct export of a stored dataset. Streams binary file. |

### Activity & Audit Logs

| Method | Endpoint | Min Role | Description |
|---|---|---|---|
| `GET` | `/api/v1/workspaces/:workspaceId/activity` | `viewer` | Returns paginated audit logs with user info (`limit`, `offset`, `action`, `entityType`). |

### Invitations

| Method | Endpoint | Min Role | Description |
|---|---|---|---|
| `POST` | `/api/v1/workspaces/:workspaceId/invitations` | `admin` | Creates workspace invitation and sends styled Brevo/SMTP email (`email`, `role`). |
| `POST` | `/api/v1/invitations/accept` | Authenticated | Accepts pending invitation by token (`token`). |

---

## Database Migrations & Multi-Tenant Security (RLS)

All tenant tables in Data Nexus enforce **Forced Row Level Security (RLS)**. Queries execute within `withTenantTransaction(userId, organizationId, callback)` which applies `SET LOCAL app.current_organization_id = ...`.

### Migrations Added on `SaaS-Integration`:

1. **`003_credit_wallets.sql`**:
   - `organization_wallets`: Stores workspace credit balance with `CHECK (balance >= 0)`.
   - `wallet_transactions`: Double-entry transaction ledger with `user_id` foreign key, `balance_after`, `idempotency_key`, and compound index on `(organization_id, created_at DESC)`.
   - RLS enabled & forced. Table grants applied to `nexus_app`.
2. **`004_activity_logs.sql`**:
   - `activity_logs`: Audit trail recording actor `user_id`, `action`, `entity_type`, `entity_id`, sanitized `details` JSONB, and `ip_address`.
   - Compound indices on `(organization_id, created_at DESC)` and `(organization_id, action)`.
   - RLS enabled & forced. Table grants applied to `nexus_app`.

To run migrations:
```powershell
npm run db:migrate
```

---

## Environment Configuration

Create or update your `.env` file in `backend/` using the following variables:

```ini
# Application
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173
JWT_SECRET=super-secret-jwt-key-min-32-chars-long!

# Database Connections
DATABASE_URL=postgresql://nexus_app:app_password@localhost:5432/data_nexus
DATABASE_MIGRATION_URL=postgresql://nexus_migrator:migrator_password@localhost:5432/data_nexus

# Razorpay Payment Gateway
RAZORPAY_KEY_ID=rzp_test_YourKeyHere
RAZORPAY_KEY_SECRET=YourRazorpaySecretHere
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecretHere

# Transactional Email (Brevo REST API v3)
BREVO_API_KEY=xkeysib-your-brevo-api-key-here
BREVO_SENDER_NAME="Data Nexus"
BREVO_SENDER_EMAIL=notifications@yourdomain.com

# SMTP / Nodemailer Fallback (Optional if using Brevo)
SMTP_URL=smtp://user:pass@smtp.mailtrap.io:2525
EMAIL_FROM="Data Nexus <notifications@yourdomain.com>"
```

---

## Local Development & Automated Testing

### Install Dependencies
```powershell
cd backend
npm install
```

### Run Automated Tests
```powershell
npm test
```
- **Coverage**: 8 test suites, 41 passing tests (covering formula sanitization, PDF binary generation, Excel multi-tab formatting, wallet atomic locks, pre-flight checks, 402 errors, employee attribution, Razorpay HMAC-SHA256 signature verification, tamper resistance, and audit log credential sanitization).

### Run ESLint Quality Check
```powershell
npm run lint
```
- **Status**: 0 errors, 0 warnings.

### Start the Server
```powershell
npm run dev
```
Healthcheck: `GET http://localhost:5000/api/v1/health`
