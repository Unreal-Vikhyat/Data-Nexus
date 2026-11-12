# Data Nexus API Reference — Phase 1 and Phase 2

Base path: `/api/v1`. All successful JSON responses use `{ "success": true, "message": "...", "data": ... }`; errors use `{ "success": false, "message": "...", "errors": {}, "code": "..." }`. IDs in examples are illustrative UUIDs. Timestamps are ISO 8601 UTC.

Browser requests that use the session cookie must use `credentials: "include"` (Axios `withCredentials: true`). State-changing browser requests use JSON and must originate from the configured `FRONTEND_URL`. The JWT is set in an HTTP-only cookie and is not included in JSON.

## Health

### `GET /health`

Authentication: none. Request: no body.

```json
{ "success": true, "message": "Data Nexus API is running", "data": { "status": "ok" } }
```

### `GET /health/ready`

Authentication: none. Request: no body. Checks database connectivity, runtime role privileges, and forced RLS on all phase 1/2 tenant tables.

```json
{ "success": true, "message": "API and database are ready", "data": { "status": "ready" } }
```

## Authentication

### `POST /auth/register`

Authentication: none. Creates a user, organization/workspace, and owner membership atomically. It does not create a login session.

Request:

```json
{ "name": "Mahi Sharma", "companyName": "ABC Technologies", "email": "user@example.com", "password": "example-password" }
```

Response `201`:

```json
{
  "success": true,
  "message": "Account created. Sign in to continue.",
  "data": {
    "user": { "id": "0ae5b005-b3e7-4b4c-83af-968fc230ed51", "name": "Mahi Sharma", "email": "user@example.com" },
    "workspace": { "id": "dafd587a-75a0-4ccd-b529-5aa03761321c", "name": "ABC Technologies", "role": "owner" }
  }
}
```

### `POST /auth/login`

Authentication: none. Sets the session cookie. Invalid email/password returns the same `401` response.

Request:

```json
{ "email": "user@example.com", "password": "example-password" }
```

Response `200`:

```json
{
  "success": true,
  "message": "Signed in",
  "data": {
    "user": { "id": "0ae5b005-b3e7-4b4c-83af-968fc230ed51", "name": "Mahi Sharma", "email": "user@example.com" },
    "workspaces": [{ "id": "dafd587a-75a0-4ccd-b529-5aa03761321c", "name": "ABC Technologies", "role": "owner" }],
    "expiresAt": "2026-11-07T10:00:00.000Z"
  }
}
```

### `POST /auth/logout`

Authentication: valid session cookie. Revokes the server-side session and clears the cookie.

Request: no body.

Response `200`:

```json
{ "success": true, "message": "Signed out", "data": {} }
```

### `GET /auth/me`

Authentication: valid session cookie.

Response `200`:

```json
{
  "success": true,
  "message": "Current user",
  "data": {
    "id": "0ae5b005-b3e7-4b4c-83af-968fc230ed51",
    "name": "Mahi Sharma",
    "email": "user@example.com",
    "created_at": "2026-11-07T09:00:00.000Z",
    "workspaces": [{ "id": "dafd587a-75a0-4ccd-b529-5aa03761321c", "name": "ABC Technologies", "role": "owner" }]
  }
}
```

### `POST /auth/forgot-password`

Authentication: none. Always returns a generic message to avoid account enumeration. SMTP delivery is required in production.

Request:

```json
{ "email": "user@example.com" }
```

Response `200` (development/test includes a local-only action URL if an account exists):

```json
{
  "success": true,
  "message": "If the account exists, password reset instructions have been sent.",
  "data": { "accepted": true, "developmentResetUrl": "http://localhost:5173/reset-password?token=one-time-token" }
}
```

### `POST /auth/reset-password`

Authentication: none. Token is single-use and expires according to `PASSWORD_RESET_EXPIRES_MINUTES`. Existing sessions are revoked when reset succeeds.

Request:

```json
{ "token": "one-time-token", "password": "new-example-password" }
```

Response `200`:

```json
{ "success": true, "message": "Password updated. Please sign in again.", "data": { "reset": true } }
```

## Workspaces and members

All workspace routes require an authenticated session. Workspace IDs are organization IDs. The API verifies membership before setting transaction-local tenant context.

### `GET /workspaces`

Request: no body.

Response `200`:

```json
{
  "success": true,
  "message": "Workspaces",
  "data": [{ "id": "dafd587a-75a0-4ccd-b529-5aa03761321c", "name": "ABC Technologies", "role": "owner", "joined_at": "2026-11-07T09:00:00.000Z", "status": "active" }]
}
```

### `POST /workspaces`

Request:

```json
{ "name": "New Workspace" }
```

Response `201`:

```json
{ "success": true, "message": "Workspace created", "data": { "id": "dafd587a-75a0-4ccd-b529-5aa03761321c", "name": "New Workspace", "role": "owner" } }
```

### `GET /workspaces/:workspaceId`

Permission: active member.

Response `200`:

```json
{
  "success": true,
  "message": "Workspace",
  "data": { "id": "dafd587a-75a0-4ccd-b529-5aa03761321c", "name": "ABC Technologies", "created_at": "2026-11-07T09:00:00.000Z", "role": "owner", "member_count": 1 }
}
```

### `PATCH /workspaces/:workspaceId`

Permission: owner or admin.

Request:

```json
{ "name": "ABC Technologies Group" }
```

Response `200`:

```json
{ "success": true, "message": "Workspace updated", "data": { "id": "dafd587a-75a0-4ccd-b529-5aa03761321c", "name": "ABC Technologies Group", "updated_at": "2026-11-07T09:30:00.000Z", "role": "owner" } }
```

### `GET /workspaces/:workspaceId/members`

Permission: active member.

Response `200`:

```json
{
  "success": true,
  "message": "Workspace members",
  "data": [{ "id": "c4134f8d-78a3-4e06-a6e9-60b889114222", "userId": "0ae5b005-b3e7-4b4c-83af-968fc230ed51", "name": "Mahi Sharma", "email": "user@example.com", "role": "owner", "status": "active", "joinedAt": "2026-11-07T09:00:00.000Z" }]
}
```

### `POST /workspaces/:workspaceId/invitations`

Permission: owner/admin. An admin may invite editors/viewers, not another admin.

Request:

```json
{ "email": "member@example.com", "role": "viewer" }
```

Response `201` (development/test includes a local-only URL; production sends email and omits it):

```json
{
  "success": true,
  "message": "Invitation created",
  "data": { "email": "member@example.com", "role": "viewer", "developmentInvitationUrl": "http://localhost:5173/invitations/accept?token=one-time-token" }
}
```

### `POST /invitations/accept`

Permission: authenticated account whose email matches the invitation.

Request:

```json
{ "token": "one-time-token" }
```

Response `200`:

```json
{ "success": true, "message": "Invitation accepted", "data": { "workspaceId": "dafd587a-75a0-4ccd-b529-5aa03761321c", "role": "viewer" } }
```

### `PATCH /workspaces/:workspaceId/members/:memberId`

Permission: owner/admin. Admins cannot manage admins. Owner role changes are rejected until ownership transfer is implemented.

Request:

```json
{ "role": "editor" }
```

Response `200`:

```json
{ "success": true, "message": "Member role updated", "data": { "id": "c4134f8d-78a3-4e06-a6e9-60b889114222", "role": "editor", "status": "active" } }
```

### `DELETE /workspaces/:workspaceId/members/:memberId`

Permission: owner/admin. Owner membership cannot be removed.

Request: no body.

Response `200`:

```json
{ "success": true, "message": "Member removed", "data": { "removed": true } }
```

## Reports and exports

Base path: `/api/v1`. Supports exporting authorized analytics results, dataset summaries, and custom query tables to PDF, Excel (.xlsx), and CSV.

### Supported formats
- `pdf`: Branded executive report with Data Nexus banner, KPI summary cards, and paginated data tables (`application/pdf`).
- `xlsx`: Structured Excel workbook with styled headers, auto-width columns, and separate Overview/Data sheets (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
- `csv`: High-performance CSV stream with RFC 4180 escaping and formula injection sanitization (`text/csv; charset=utf-8`).

### Security: Spreadsheet formula injection protection
Cells starting with formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically neutralized with a leading single quote (`'`) to prevent formula execution in spreadsheet software (CWE-1236).

### `POST /workspaces/:workspaceId/reports/export`

Permission: active member (viewer or above). Exports custom tabular data, KPI metrics, or query state.

Request:

```json
{
  "format": "pdf",
  "title": "Q4 Executive Performance & Revenue Report",
  "subtitle": "Comprehensive analytics summary covering regional sales and category performance.",
  "summaryMetrics": [
    { "label": "Total Revenue", "value": "₹ 2,45,000" },
    { "label": "Total Orders", "value": "1,420" }
  ],
  "customColumns": ["Region", "Category", "Orders", "Revenue"],
  "customRows": [
    ["North", "Electronics", 480, "₹ 1,12,000"],
    ["South", "Furniture", 340, "₹ 68,500"]
  ],
  "limit": 500
}
```

Response `200`: Binary file download stream with headers:
- `Content-Type: application/pdf` (or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` or `text/csv; charset=utf-8`)
- `Content-Disposition: attachment; filename="q4_executive_performance_2026-11-12.pdf"`
- `Content-Length: <byte_count>`

### `POST /workspaces/:workspaceId/datasets/:datasetId/reports/export`

Permission: active member (viewer or above). Exports data directly from an existing workspace dataset.

Request:

```json
{
  "format": "xlsx",
  "title": "Dataset Summary Export",
  "summaryMetrics": [
    { "label": "Total Records", "value": 1250 }
  ],
  "limit": 1000
}
```

Response `200`: Binary file download stream.

## Common failures

- `400 VALIDATION_ERROR` — invalid input; `errors` maps fields to validation messages.
- `401 UNAUTHENTICATED` — missing, invalid, expired, or revoked session.
- `403 FORBIDDEN` — authenticated member lacks the required workspace role.
- `404 WORKSPACE_NOT_FOUND` — workspace does not exist or is not visible to the caller.
- `409 EMAIL_IN_USE` / `ALREADY_A_MEMBER` — unique account or membership conflict.
- `500` — generic production message; internal details are logged with request ID, not returned.
