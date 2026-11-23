/**
 * assistant.service.js
 *
 * AI Data Assistant — interprets natural-language questions about datasets.
 *
 * Flow:
 * 1. User asks a question about a specific dataset.
 * 2. LLM receives the dataset schema and produces a STRICT structured JSON query plan.
 * 3. The plan is validated against the real schema, permissions, and allowed operations.
 * 4. Safe, parameterized SQL is built from the validated plan (never raw LLM SQL).
 * 5. PostgreSQL executes the query; the result is returned with a natural-language summary.
 *
 * The LLM never sees raw data rows unless explicitly approved.
 * The LLM never produces SQL — only a structured plan.
 */

import { withTenantTransaction } from "../database/transaction.js";
import { logger } from "../config/logger.js";
import { buildQueryFromPlan } from "./query-builder.service.js";
import { newId } from "../utils/crypto.js";

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

// ─── LLM Integration Layer ──────────────────────
// Uses the configured LLM SDK through the backend service layer.
// Defaults to a structured prompt that returns JSON only.

/**
 * Get the LLM client. In production this uses the configured SDK.
 * Falls back to a rule-based parser for development/testing without an LLM.
 */
function getLLMClient() {
  // Check if LLM is configured through env
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.warn("No LLM API key configured — using rule-based query plan parser");
    return null;
  }
  return { apiKey, provider: process.env.LLM_PROVIDER || "openai" };
}

/**
 * Build the system prompt for the LLM.
 * Includes dataset schema so the LLM knows what columns exist.
 */
function buildSystemPrompt(columns) {
  const columnDescriptions = columns.map((c) =>
    `  - "${c.column_name}" (${c.data_type})${c.is_aggregatable ? " [aggregatable]" : ""}${c.is_groupable ? " [groupable]" : ""}`,
  ).join("\n");

  return `You are a data analytics assistant. The user will ask questions about a dataset.
Your job is to interpret the question and return a STRICT JSON query plan.

DATASET SCHEMA:
${columnDescriptions}

RULES:
- Return ONLY valid JSON. No markdown, no explanation, no SQL.
- The JSON must follow this exact structure:
{
  "intent": "aggregate" | "list" | "filter" | "compare" | "summary",
  "fields": ["column_name", ...],
  "aggregations": [{ "column": "col", "function": "SUM|AVG|COUNT|MIN|MAX", "alias": "label" }],
  "filters": [{ "column": "col", "operator": "eq|neq|gt|gte|lt|lte|in|like|is_null|is_not_null", "value": ... }],
  "groupBy": ["column_name", ...],
  "orderBy": [{ "column": "col", "direction": "ASC|DESC" }],
  "limit": 100,
  "explanation": "Brief explanation of what this query does"
}
- Only use column names that exist in the schema above.
- Only use aggregation functions: COUNT, SUM, AVG, MIN, MAX.
- If the question is ambiguous, set "clarification_needed": true and "clarification_message": "your question".
- Never produce SQL. Only produce the JSON plan.`;
}

/**
 * Call the LLM to interpret a question into a query plan.
 * If no LLM is configured, falls back to rule-based parsing.
 */
async function interpretQuestion(question, columns, conversationHistory) {
  const llmClient = getLLMClient();

  if (!llmClient) {
    return fallbackParser(question, columns);
  }

  const systemPrompt = buildSystemPrompt(columns);
  const messages = [
    { role: "system", content: systemPrompt },
  ];

  // Add conversation history for context (last 6 messages max)
  if (conversationHistory && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-6);
    for (const msg of recent) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: question });

  try {
    let response;

    if (llmClient.provider === "gemini") {
      // Google Gemini API
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(llmClient.apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const chat = model.startChat({
        history: messages.slice(0, -1).map((m) => ({
          role: m.role === "assistant" ? "model" : m.role === "system" ? "user" : m.role,
          parts: [{ text: m.content }],
        })),
      });
      const result = await chat.sendMessage(question);
      response = result.response.text();
    } else {
      // OpenAI-compatible API
      const url = process.env.LLM_BASE_URL || "https://api.openai.com/v1/chat/completions";
      const model = process.env.LLM_MODEL || "gpt-4o-mini";

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmClient.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1,
          max_tokens: 1000,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        logger.error({ status: res.status, body: errBody }, "LLM API error");
        throw httpError(502, "LLM_ERROR", "Failed to get response from AI service");
      }

      const data = await res.json();
      response = data.choices?.[0]?.message?.content;
    }

    if (!response) {
      throw httpError(502, "LLM_EMPTY_RESPONSE", "AI service returned an empty response");
    }

    // Parse the JSON response
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const plan = JSON.parse(cleaned);
    return plan;
  } catch (error) {
    if (error.status) throw error; // Re-throw our own errors
    if (error instanceof SyntaxError) {
      logger.error({ err: error }, "LLM returned invalid JSON");
      throw httpError(502, "LLM_INVALID_RESPONSE", "AI service returned an unparseable response");
    }
    logger.error({ err: error }, "LLM call failed");
    throw httpError(502, "LLM_ERROR", "Failed to communicate with AI service");
  }
}

// ─── Rule-based fallback parser ──────────────────
// Provides basic query planning without an LLM, for development and testing.

function fallbackParser(question, columns) {
  const q = question.toLowerCase();
  const numericCols = columns.filter((c) => c.is_aggregatable);
  const groupableCols = columns.filter((c) => c.is_groupable && !c.is_aggregatable);

  // Detect aggregation keywords
  const aggMap = {
    total: "SUM", sum: "SUM", average: "AVG", avg: "AVG", mean: "AVG",
    count: "COUNT", "how many": "COUNT", number: "COUNT",
    minimum: "MIN", min: "MIN", lowest: "MIN", smallest: "MIN",
    maximum: "MAX", max: "MAX", highest: "MAX", largest: "MAX", top: "MAX",
  };

  let detectedAgg = null;
  for (const [keyword, func] of Object.entries(aggMap)) {
    if (q.includes(keyword)) {
      detectedAgg = func;
      break;
    }
  }

  // Detect mentioned columns
  const mentionedCols = columns.filter((c) =>
    q.includes(c.column_name.toLowerCase()) ||
    (c.display_name && q.includes(c.display_name.toLowerCase())),
  );

  // Detect grouping keywords
  const hasGrouping = /\b(by|per|each|group|for each|breakdown)\b/.test(q);

  const plan = {
    intent: "list",
    fields: [],
    aggregations: [],
    filters: [],
    groupBy: [],
    orderBy: [],
    limit: 100,
    explanation: "",
  };

  if (detectedAgg) {
    plan.intent = "aggregate";
    const aggCol = mentionedCols.find((c) => c.is_aggregatable) || numericCols[0];

    if (aggCol) {
      plan.aggregations.push({
        column: aggCol.column_name,
        function: detectedAgg,
        alias: `${detectedAgg.toLowerCase()}_${aggCol.column_name}`,
      });
    }

    if (hasGrouping) {
      const groupCol = mentionedCols.find((c) => c.is_groupable && !c.is_aggregatable) || groupableCols[0];
      if (groupCol) {
        plan.groupBy.push(groupCol.column_name);
      }
    }

    plan.explanation = `${detectedAgg} of ${aggCol?.column_name || "values"}${plan.groupBy.length ? ` grouped by ${plan.groupBy.join(", ")}` : ""}`;
  } else if (mentionedCols.length > 0) {
    plan.intent = "list";
    plan.fields = mentionedCols.map((c) => c.column_name);
    plan.explanation = `Listing ${plan.fields.join(", ")}`;
  } else {
    plan.intent = "summary";
    plan.fields = columns.slice(0, 5).map((c) => c.column_name);
    plan.explanation = "Showing a sample of the dataset";
    plan.limit = 20;
  }

  return plan;
}

// ─── Query plan validation ──────────────────────

/**
 * Validate a query plan against the real dataset schema.
 * Ensures no column injection, no disallowed operations.
 */
function validateQueryPlan(plan, columns) {
  const columnNames = new Set(columns.map((c) => c.column_name));
  const errors = [];

  // Validate fields
  if (plan.fields) {
    for (const f of plan.fields) {
      if (!columnNames.has(f)) {
        errors.push(`Unknown column in fields: "${f}"`);
      }
    }
  }

  // Validate aggregations
  if (plan.aggregations) {
    const allowedFuncs = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX"]);
    for (const agg of plan.aggregations) {
      if (!columnNames.has(agg.column)) {
        errors.push(`Unknown column in aggregation: "${agg.column}"`);
      }
      if (!allowedFuncs.has(agg.function?.toUpperCase())) {
        errors.push(`Invalid aggregation function: "${agg.function}"`);
      }
    }
  }

  // Validate filters
  if (plan.filters) {
    for (const f of plan.filters) {
      if (!columnNames.has(f.column)) {
        errors.push(`Unknown column in filter: "${f.column}"`);
      }
    }
  }

  // Validate groupBy
  if (plan.groupBy) {
    for (const g of plan.groupBy) {
      if (!columnNames.has(g)) {
        errors.push(`Unknown column in groupBy: "${g}"`);
      }
    }
  }

  // Validate orderBy
  if (plan.orderBy) {
    for (const o of plan.orderBy) {
      // Allow ordering by aliases
      const isAlias = plan.aggregations?.some((a) => a.alias === o.column);
      if (!isAlias && !columnNames.has(o.column)) {
        errors.push(`Unknown column in orderBy: "${o.column}"`);
      }
    }
  }

  // Enforce limit
  if (plan.limit && plan.limit > 10000) {
    plan.limit = 10000;
  }

  if (errors.length > 0) {
    logger.warn({ errors, plan }, "Query plan validation failed");
    throw httpError(400, "INVALID_QUERY_PLAN", `Query plan validation failed: ${errors.join("; ")}`);
  }

  return plan;
}

// ─── Public API ──────────────────────────────────

/**
 * Process a natural-language question about a dataset.
 */
export async function askQuestion(userId, organizationId, datasetId, question, sessionId) {
  return withTenantTransaction(userId, organizationId, async (client) => {
    // 1. Get dataset schema
    const dsResult = await client.query(
      `SELECT d.id, d.name, d.storage_table, d.status
       FROM datasets d WHERE d.id = $1`,
      [datasetId],
    );

    if (!dsResult.rowCount) throw httpError(404, "DATASET_NOT_FOUND", "Dataset not found");
    const dataset = dsResult.rows[0];
    if (dataset.status !== "ready") {
      throw httpError(409, "DATASET_NOT_READY", `Dataset is "${dataset.status}" and not available for queries`);
    }

    const colResult = await client.query(
      `SELECT column_name, display_name, data_type, is_aggregatable, is_groupable, is_filterable
       FROM dataset_columns WHERE dataset_id = $1 ORDER BY ordinal`,
      [datasetId],
    );
    const columns = colResult.rows;

    if (!columns.length) {
      throw httpError(409, "DATASET_NO_COLUMNS", "Dataset has no column metadata");
    }

    // 2. Get or create conversation session
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      activeSessionId = newId();
      await client.query(
        `INSERT INTO assistant_sessions (id, organization_id, dataset_id, user_id, title)
         VALUES ($1, $2, $3, $4, $5)`,
        [activeSessionId, organizationId, datasetId, userId, question.substring(0, 100)],
      );
    } else {
      // Verify session exists and belongs to user
      const sessResult = await client.query(
        `SELECT id FROM assistant_sessions WHERE id = $1 AND user_id = $2`,
        [activeSessionId, userId],
      );
      if (!sessResult.rowCount) {
        throw httpError(404, "SESSION_NOT_FOUND", "Conversation session not found");
      }
    }

    // 3. Save user message
    const userMsgId = newId();
    await client.query(
      `INSERT INTO assistant_messages (id, session_id, role, content) VALUES ($1, $2, 'user', $3)`,
      [userMsgId, activeSessionId, question],
    );

    // 4. Get conversation history for context
    const historyResult = await client.query(
      `SELECT role, content FROM assistant_messages
       WHERE session_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [activeSessionId],
    );
    const conversationHistory = historyResult.rows.reverse();

    // 5. Interpret question → structured query plan
    let plan;
    try {
      plan = await interpretQuestion(question, columns, conversationHistory);
    } catch (error) {
      // Save error as assistant message
      const errMsgId = newId();
      const errContent = error.status === 502
        ? "I'm having trouble connecting to the AI service. Please try again later."
        : `I couldn't understand that question: ${error.message}`;
      await client.query(
        `INSERT INTO assistant_messages (id, session_id, role, content) VALUES ($1, $2, 'assistant', $3)`,
        [errMsgId, activeSessionId, errContent],
      );
      throw error;
    }

    // 6. Check if clarification is needed
    if (plan.clarification_needed) {
      const clarifyMsgId = newId();
      const clarifyContent = plan.clarification_message || "Could you be more specific about what you'd like to know?";
      await client.query(
        `INSERT INTO assistant_messages (id, session_id, role, content, query_plan)
         VALUES ($1, $2, 'assistant', $3, $4)`,
        [clarifyMsgId, activeSessionId, clarifyContent, JSON.stringify(plan)],
      );

      return {
        sessionId: activeSessionId,
        answer: clarifyContent,
        clarificationNeeded: true,
        queryPlan: plan,
      };
    }

    // 7. Validate the plan against real schema
    const validatedPlan = validateQueryPlan(plan, columns);

    // 8. Build safe SQL from the validated plan
    const { sql, params } = buildQueryFromPlan(
      dataset.storage_table,
      validatedPlan,
      columns,
    );

    // 9. Execute the safe query (read-only with timeout)
    await client.query("SET LOCAL statement_timeout = 8000");
    await client.query("SET LOCAL default_transaction_read_only = ON");

    const queryResult = await client.query(sql, params);

    // 10. Build the answer
    const explanation = validatedPlan.explanation || "Here are the results";
    const resultSummary = {
      rowCount: queryResult.rows.length,
      columns: queryResult.fields?.map((f) => f.name) || Object.keys(queryResult.rows[0] || {}),
    };

    // 11. Save assistant response
    const assistantMsgId = newId();
    await client.query(
      `INSERT INTO assistant_messages (id, session_id, role, content, query_plan, result_summary)
       VALUES ($1, $2, 'assistant', $3, $4, $5)`,
      [
        assistantMsgId,
        activeSessionId,
        explanation,
        JSON.stringify(validatedPlan),
        JSON.stringify(resultSummary),
      ],
    );

    // 12. Update session timestamp
    await client.query(
      `UPDATE assistant_sessions SET updated_at = now() WHERE id = $1`,
      [activeSessionId],
    );

    return {
      sessionId: activeSessionId,
      answer: explanation,
      queryPlan: validatedPlan,
      data: queryResult.rows,
      resultSummary,
    };
  });
}

