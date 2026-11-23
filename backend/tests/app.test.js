import request from "supertest";
import { describe, expect, test } from "@jest/globals";
import { createApp } from "../src/app.js";

const app = createApp();

describe("API foundation", () => {
  test("serves the versioned liveness endpoint", async () => {
    const response = await request(app).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ok");
  });

  test("does not expose unversioned API paths", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(404);
  });

  test("blocks browser requests from an unapproved origin", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", "https://unexpected.example")
      .set("Content-Type", "application/json")
      .send({});
    expect(response.status).toBe(403);
  });

  test("validates registration before touching the database", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Content-Type", "application/json")
      .send({ name: "", companyName: "", email: "bad-email", password: "short" });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  test("protects current-user, logout, and workspace routes without a valid cookie", async () => {
    const responses = await Promise.all([
      request(app).get("/api/v1/auth/me"),
      request(app).post("/api/v1/auth/logout"),
      request(app).get("/api/v1/workspaces"),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
  });
});
