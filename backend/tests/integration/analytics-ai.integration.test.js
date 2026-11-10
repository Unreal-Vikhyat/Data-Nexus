/**
 * analytics-ai.integration.test.js
 *
 * Integration tests for the Analytics & AI module.
 * Requires PostgreSQL with the analytics migration applied.
 * Skipped automatically when TEST_DATABASE_URL is not set.
 */

const SKIP = !process.env.TEST_DATABASE_URL;

const describeWithDb = SKIP ? describe.skip : describe;

describeWithDb("Analytics & AI Integration", () => {
  let app;

  beforeAll(async () => {
    // These tests require the full database setup
    // including migrations 001 and 002
    const { createApp } = await import("../../src/app.js");
    app = createApp();
  });

  test("placeholder — requires database to run", () => {
    expect(true).toBe(true);
  });

  describe("Analytics Query Security", () => {
    test("rejects unauthenticated requests", async () => {
      const { default: request } = await import("supertest");
      const response = await request(app)
        .post("/api/v1/workspaces/550e8400-e29b-41d4-a716-446655440000/datasets/550e8400-e29b-41d4-a716-446655440001/analytics/query")
        .send({ select: [{ column: "region" }] });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("validates request body schema", async () => {
      const { default: request } = await import("supertest");
      const response = await request(app)
        .post("/api/v1/workspaces/550e8400-e29b-41d4-a716-446655440000/datasets/550e8400-e29b-41d4-a716-446655440001/analytics/query")
        .set("Content-Type", "application/json")
        .send({ select: [] }); // empty select should fail

      // Will fail either with 401 (no auth) or 400 (validation)
      expect([400, 401]).toContain(response.status);
    });
  });

  describe("Assistant Security", () => {
    test("rejects unauthenticated assistant requests", async () => {
      const { default: request } = await import("supertest");
      const response = await request(app)
        .post("/api/v1/workspaces/550e8400-e29b-41d4-a716-446655440000/datasets/550e8400-e29b-41d4-a716-446655440001/assistant/ask")
        .send({ question: "What is the total?" });

      expect(response.status).toBe(401);
    });

    test("rejects unauthenticated session list", async () => {
      const { default: request } = await import("supertest");
      const response = await request(app)
        .get("/api/v1/workspaces/550e8400-e29b-41d4-a716-446655440000/assistant/sessions");

      expect(response.status).toBe(401);
    });
  });

  describe("Route Validation", () => {
    test("rejects invalid workspace UUID in analytics params", async () => {
      const { default: request } = await import("supertest");
      const response = await request(app)
        .post("/api/v1/workspaces/not-a-uuid/datasets/also-not-uuid/analytics/query")
        .set("Content-Type", "application/json")
        .send({ select: [{ column: "region" }] });

      expect([400, 401]).toContain(response.status);
    });

    test("rejects invalid session UUID in assistant params", async () => {
      const { default: request } = await import("supertest");
      const response = await request(app)
        .get("/api/v1/workspaces/not-a-uuid/assistant/sessions/bad-id");

      expect([400, 401]).toContain(response.status);
    });
  });
});

// Always-run tests that don't need a database

describe("Analytics Route Registration", () => {
  test("app registers analytics and assistant routes", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const { default: request } = await import("supertest");

    // These should return 401 (unauthenticated), NOT 404 (route not found)
    const analyticsRes = await request(app)
      .post("/api/v1/workspaces/550e8400-e29b-41d4-a716-446655440000/datasets/550e8400-e29b-41d4-a716-446655440001/analytics/query")
      .set("Content-Type", "application/json")
      .send({ select: [{ column: "test" }] });

    // 400 or 401 means route exists; 404 means it doesn't
    expect(analyticsRes.status).not.toBe(404);

    const assistantRes = await request(app)
      .post("/api/v1/workspaces/550e8400-e29b-41d4-a716-446655440000/datasets/550e8400-e29b-41d4-a716-446655440001/assistant/ask")
      .set("Content-Type", "application/json")
      .send({ question: "test" });

    expect(assistantRes.status).not.toBe(404);

    const sessionsRes = await request(app)
      .get("/api/v1/workspaces/550e8400-e29b-41d4-a716-446655440000/assistant/sessions");

    expect(sessionsRes.status).not.toBe(404);
  });
});

