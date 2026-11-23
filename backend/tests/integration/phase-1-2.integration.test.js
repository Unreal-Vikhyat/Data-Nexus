import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { migrate } from "../../src/database/migrate.js";
import { pool, closePool } from "../../src/database/pool.js";
import { createApp } from "../../src/app.js";

const databaseReady = Boolean(process.env.TEST_DATABASE_URL && process.env.TEST_MIGRATION_DATABASE_URL);
const suite = databaseReady ? describe : describe.skip;
const app = createApp();

suite("Phase 1 and 2 PostgreSQL integration", () => {
  beforeAll(async () => {
    await migrate();
  });

  afterAll(async () => {
    await closePool();
  });

  test("runs migrations and confirms the runtime role cannot bypass RLS", async () => {
    const response = await request(app).get("/api/v1/health/ready");
    expect(response.status).toBe(200);
    const rls = await pool.query(`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'app' AND c.relname IN ('organizations', 'organization_members', 'auth_sessions', 'invitations')
    `);
    expect(rls.rowCount).toBe(4);
    expect(rls.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });

  test("registers, logs in, protects routes, isolates tenants and enforces viewer permissions", async () => {
    const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const ownerEmail = `owner-${nonce}@example.com`;
    const memberEmail = `member-${nonce}@example.com`;
    const outsiderEmail = `outsider-${nonce}@example.com`;
    const password = "phase-two-test-password";

    const ownerSignup = await request(app).post("/api/v1/auth/register").send({ name: "Owner", companyName: "Owner Org", email: ownerEmail, password });
    expect(ownerSignup.status).toBe(201);
    const owner = request.agent(app);
    const ownerLogin = await owner.post("/api/v1/auth/login").send({ email: ownerEmail, password });
    expect(ownerLogin.status).toBe(200);
    const workspaceId = ownerLogin.body.data.workspaces[0].id;
    expect((await owner.get("/api/v1/auth/me")).status).toBe(200);

    const memberSignup = await request(app).post("/api/v1/auth/register").send({ name: "Member", companyName: "Member Org", email: memberEmail, password });
    expect(memberSignup.status).toBe(201);
    const invite = await owner.post(`/api/v1/workspaces/${workspaceId}/invitations`).send({ email: memberEmail, role: "viewer" });
    expect(invite.status).toBe(201);
    const token = new URL(invite.body.data.developmentInvitationUrl).searchParams.get("token");
    const member = request.agent(app);
    expect((await member.post("/api/v1/auth/login").send({ email: memberEmail, password })).status).toBe(200);
    expect((await member.post("/api/v1/invitations/accept").send({ token })).status).toBe(200);
    expect((await member.patch(`/api/v1/workspaces/${workspaceId}`).send({ name: "Unauthorized Rename" })).status).toBe(403);
    expect((await owner.patch(`/api/v1/workspaces/${workspaceId}`).send({ name: "Authorized Rename" })).status).toBe(200);

    const outsiderSignup = await request(app).post("/api/v1/auth/register").send({ name: "Outsider", companyName: "Other Org", email: outsiderEmail, password });
    expect(outsiderSignup.status).toBe(201);
    const outsider = request.agent(app);
    expect((await outsider.post("/api/v1/auth/login").send({ email: outsiderEmail, password })).status).toBe(200);
    expect((await outsider.get(`/api/v1/workspaces/${workspaceId}`)).status).toBe(404);

    expect((await owner.post("/api/v1/auth/logout")).status).toBe(200);
    expect((await owner.get("/api/v1/auth/me")).status).toBe(401);
  });
});
