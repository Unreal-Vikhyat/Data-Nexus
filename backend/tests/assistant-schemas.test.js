/**
 * assistant-schemas.test.js
 *
 * Tests for Zod validation schemas used by the AI assistant.
 */

import {
  askQuestionSchema,
  assistantParamsSchema,
  sessionParamsSchema,
  sessionsListQuerySchema,
} from "../src/schemas/assistant.schemas.js";

describe("assistantParamsSchema", () => {
  test("accepts valid UUIDs", () => {
    const result = assistantParamsSchema.safeParse({
      workspaceId: "550e8400-e29b-41d4-a716-446655440000",
      datasetId: "550e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success).toBe(true);
  });

  test("rejects non-UUID strings", () => {
    const result = assistantParamsSchema.safeParse({
      workspaceId: "abc",
      datasetId: "123",
    });
    expect(result.success).toBe(false);
  });
});

describe("sessionParamsSchema", () => {
  test("accepts valid session params", () => {
    const result = sessionParamsSchema.safeParse({
      workspaceId: "550e8400-e29b-41d4-a716-446655440000",
      sessionId: "550e8400-e29b-41d4-a716-446655440002",
    });
    expect(result.success).toBe(true);
  });
});

describe("askQuestionSchema", () => {
  test("accepts valid question", () => {
    const result = askQuestionSchema.safeParse({
      question: "What is the total quantity by region?",
    });
    expect(result.success).toBe(true);
  });

  test("accepts question with session ID", () => {
    const result = askQuestionSchema.safeParse({
      question: "And for last month?",
      sessionId: "550e8400-e29b-41d4-a716-446655440003",
    });
    expect(result.success).toBe(true);
  });

  test("trims whitespace", () => {
    const result = askQuestionSchema.safeParse({
      question: "  What is the average price?  ",
    });
    expect(result.success).toBe(true);
    expect(result.data.question).toBe("What is the average price?");
  });

  test("rejects empty question", () => {
    const result = askQuestionSchema.safeParse({ question: "" });
    expect(result.success).toBe(false);
  });

  test("rejects whitespace-only question", () => {
    const result = askQuestionSchema.safeParse({ question: "   " });
    expect(result.success).toBe(false);
  });

  test("rejects question exceeding max length", () => {
    const result = askQuestionSchema.safeParse({
      question: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid session ID", () => {
    const result = askQuestionSchema.safeParse({
      question: "What is the total?",
      sessionId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("sessionsListQuerySchema", () => {
  test("provides defaults", () => {
    const result = sessionsListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(20);
    expect(result.data.offset).toBe(0);
  });

  test("accepts custom pagination", () => {
    const result = sessionsListQuerySchema.safeParse({ limit: "50", offset: "10" });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(50);
    expect(result.data.offset).toBe(10);
  });

  test("rejects limit above max", () => {
    const result = sessionsListQuerySchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });
});

