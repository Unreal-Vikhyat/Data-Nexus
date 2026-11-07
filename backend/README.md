# Data Nexus Backend

Phase 1 and Phase 2 implementation for the Data Nexus API. This is a standalone Node.js/Express service in the repository's `Backend` branch. The React application on `Frontend` is not changed.

## Stack and scope

- Node.js 20+, Express 5, JavaScript ES modules
- PostgreSQL through `pg`; SQL migrations are applied by `npm run db:migrate`
- Zod request validation, bcrypt password hashing, JWT sessions in HTTP-only cookies
- Helmet, strict credentialed CORS, rate limiting, Pino request logging
- Jest and Supertest, including a PostgreSQL integration suite

Implemented in this phase: API foundation and health endpoints; users, organizations/workspaces, memberships, invitations, password resets, revocable sessions, role authorization, and forced RLS on organization-scoped tables. Dataset processing, analytics, assistant, reporting, exports, credits and Razorpay are intentionally left for later approved phases.

## Run locally

1. Install PostgreSQL 14 or later and create a dedicated development database.
2. Create two separate login roles: `nexus_migrator` for migrations and `nexus_app` for the API. Neither may be a superuser or have `BYPASSRLS`. Do not make the app role the owner of application tables.
3. Run `scripts/bootstrap-roles.sql` as a database administrator against the existing `data_nexus` database, supplying passwords with psql variables. Then make `nexus_migrator` the database owner. The migration role owns the `app` schema and its tables; the script grants the API role connect, schema usage, and create rights for the migrator only.

   ```powershell
   psql -U postgres -d postgres -c "CREATE DATABASE data_nexus"
   psql -U postgres -d data_nexus -v migrator_password='replace-this' -v app_password='replace-this-too' -f scripts/bootstrap-roles.sql
   psql -U postgres -d postgres -c "ALTER DATABASE data_nexus OWNER TO nexus_migrator"
   ```

   Use unique development passwords. For production, provision secrets through the database/platform secret manager rather than command history.

4. Copy `.env.example` to `.env` and set distinct `DATABASE_URL` and `DATABASE_MIGRATION_URL` values for the two roles. Set a random `JWT_SECRET` of at least 32 characters and the exact browser origin in `FRONTEND_URL`.
5. Install and migrate, then start the API:

   ```powershell
   npm install
   npm run db:migrate
   npm run dev
   ```

6. Check `GET /api/v1/health` for liveness and `GET /api/v1/health/ready` for PostgreSQL connectivity plus runtime-role safety.

The API refuses to start if its current database role is a superuser, has/inherits `BYPASSRLS`, can assume the migration role, owns application tables, or can create objects in the protected schema. Migrations require the separate migration URL/role. The service can start without SMTP; password reset and invitation email delivery require SMTP in production. In development/test, those endpoints return a one-time action URL in the response so the flow can be exercised locally; the token itself is not logged.

## Database, migrations and tenant context

Migrations are ordered SQL files in `src/database/migrations/` and are recorded in `app.schema_migrations`. Run them with the migration credential, never with `nexus_app`. Migration files are transactional and safe to run repeatedly through the runner.

The phase 1/2 tenant tables (`organizations`, `organization_members`, `auth_sessions`, and `invitations`) have both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`. Their policies read transaction-local settings. For organization requests, the API starts a transaction, sets the authenticated user ID with `set_config(..., true)`, proves active membership, then sets the organization ID with `set_config(..., true)`. The transaction helper commits or rolls back and always releases the `pg` client. This makes context reset automatic when a pooled connection is reused. The app role is neither owner nor superuser and cannot bypass RLS; it receives DML privileges only. Workspace role checks are also enforced in API middleware/services.

RLS is defense in depth for the trusted API process. Like other shared-credential tenant-context designs, PostgreSQL cannot independently know the end user's JWT identity: a party with the app database credential and arbitrary SQL execution could set custom context values. Parameterized SQL, request validation, no raw SQL endpoints, the separate no-bypass app role, transaction-scoped context, and membership validation are therefore all required together. Restrict database credentials to the API runtime and keep migrations on a separate identity.

### Dataset storage decision for the later approved phase

The planned analytics layer creates one analytical table per dataset, using only internal identifiers (for example a UUID-derived table key and generated `c_0001` column names). User headers stay in metadata. The runtime `nexus_app` role will not receive `CREATE` on the analytics schema. A narrowly scoped provisioner function/worker identity will derive the table name from the authorized dataset UUID, accept only allow-listed detected types, validate generated names, and safely quote identifiers; it will never accept a client table or column name. Values remain parameterized. Each table will include organization and dataset IDs, forced RLS, and indexes derived only from approved mappings/query patterns. Creation/population/deletion will be transactional; failed imports and dataset deletion must drop the generated table through an idempotent cleanup operation, never by interpolating client input.

This approach gives PostgreSQL native typed columns and efficient generic aggregates, but it has trade-offs: many datasets create many catalog objects; schema changes require DDL; indexes consume storage and slow imports; wide datasets can hit PostgreSQL's column limit; and dataset deletion/retention requires coordinated metadata, file, and table cleanup. The implementation will cap file size, row count, and column count; create only useful indexes (including an organization/dataset access path and mapped-field indexes selected by query needs); keep the original file and immutable dataset versions; and run idempotent cleanup for failed imports, deleted datasets, and orphaned tables. Cleanup must verify the stored generated key against the dataset metadata before dropping anything. If scale makes DDL/catalog growth a problem, the storage layer can migrate to partitioned typed storage or a JSONB row store with typed projections.

### File storage decision for the later approved phase

Uploads will use a storage interface, with a local filesystem adapter as the development default. Dataset records store a generated storage key, not a client path. The adapter boundary will permit an S3-compatible implementation (bucket/key, signed downloads, and lifecycle rules) in production without changing controllers or dataset metadata. File content will be private and stored outside static web roots. No dataset upload or storage functionality is being implemented in this phase.

## API contract (`/api/v1`)

The complete request/response reference for each Phase 1/2 endpoint is in [`docs/API.md`](docs/API.md).

Success responses use `{ "success": true, "message": "...", "data": ... }`. Errors use `{ "success": false, "message": "...", "errors": {}, "code": "..." }`. IDs are UUIDs; timestamps are ISO 8601 UTC. Browser requests use `credentials: "include"`/Axios `withCredentials: true`. State-changing browser requests must use JSON and come from `FRONTEND_URL`. The session cookie is HTTP-only, `SameSite=Lax`, path `/api/v1`, and `Secure` in production.

### Authentication

`POST /api/v1/auth/register` creates the account, organization/workspace, and owner membership in one transaction; it does not log the new user in.

```json
{
  "name": "Mahi Sharma",
  "companyName": "ABC Technologies",
  "email": "user@example.com",
  "password": "example-password"
}
```

Response (`201`):

```json
{
  "success": true,
  "message": "Account created. Sign in to continue.",
  "data": {
    "user": { "id": "uuid", "name": "Mahi Sharma", "email": "user@example.com" },
    "workspace": { "id": "uuid", "name": "ABC Technologies", "role": "owner" }
  }
}
```

`POST /api/v1/auth/login` accepts `{ "email": "user@example.com", "password": "example-password" }`, sets the HTTP-only JWT cookie, and returns the user plus available workspaces. `GET /api/v1/auth/me` returns the authenticated user and memberships. `POST /api/v1/auth/logout` revokes the current session and clears the cookie. Invalid credentials return `401` without identifying whether the email exists.

`POST /api/v1/auth/forgot-password` accepts `{ "email": "user@example.com" }`; the response is generic to avoid account enumeration. `POST /api/v1/auth/reset-password` accepts `{ "token": "one-time-token", "password": "new-password" }`; a successful reset consumes the token and revokes all existing sessions. Reset tokens are stored hashed, single-use, and time-limited.

### Workspaces and membership

- `GET /api/v1/workspaces` — caller's active workspaces and roles.
- `POST /api/v1/workspaces` — `{ "name": "ABC Technologies" }`; creates a workspace and owner membership.
- `GET /api/v1/workspaces/:workspaceId` — workspace and member count; any active member.
- `PATCH /api/v1/workspaces/:workspaceId` — `{ "name": "New name" }`; owner/admin only.
- `GET /api/v1/workspaces/:workspaceId/members` — active members; any active member.
- `POST /api/v1/workspaces/:workspaceId/invitations` — `{ "email": "member@example.com", "role": "viewer" }`; owner/admin. Admins may invite editors/viewers but not admins.
- `POST /api/v1/invitations/accept` — `{ "token": "invitation-token" }`; authenticated account email must match the invite.
- `PATCH /api/v1/workspaces/:workspaceId/members/:memberId` — `{ "role": "editor" }`; owner/admin, with admins unable to manage admins.
- `DELETE /api/v1/workspaces/:workspaceId/members/:memberId` — owner/admin. The owner cannot be removed or demoted until ownership transfer is implemented.

Member list entries contain `id`, `userId`, `name`, `email`, `role`, `status`, and `joinedAt`. Missing or unauthorized workspaces return `404` to avoid confirming another tenant's existence. Authenticated members with insufficient role receive `403`.

### Health

- `GET /api/v1/health` — process liveness.
- `GET /api/v1/health/ready` — database connection and verification that the connected runtime role is not superuser/`BYPASSRLS`.

### Remaining application APIs

Dataset upload/schema/mapping/quality, cleaning, analytics, AI assistant, reports/exports, billing/credits/Razorpay, and activity APIs are not registered yet. They are explicitly deferred to the later approved phases; no placeholder routes are returned as successful responses.

## Tests

```powershell
npm test
npm run lint
```

Unit/security tests run without PostgreSQL. The end-to-end suite in `tests/integration/` runs migrations and exercises registration, login, logout, protected routes, tenant isolation, workspace role authorization, and RLS state only when both `TEST_DATABASE_URL` (restricted runtime role) and `TEST_MIGRATION_DATABASE_URL` (migration role) point to a disposable PostgreSQL database. It is skipped otherwise. Do not point it at production or valuable data; it creates test accounts and organizations.
