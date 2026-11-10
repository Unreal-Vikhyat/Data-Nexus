/**
 * assistant.controller.js
 *
 * Handles HTTP requests for the AI data assistant and conversation history.
 */

import * as assistantService from "../services/assistant.service.js";
import * as historyService from "../services/assistant-history.service.js";

export async function ask(req, res) {
  const data = await assistantService.askQuestion(
    req.auth.userId,
    req.params.workspaceId,
    req.params.datasetId,
    req.body.question,
    req.body.sessionId,
  );
  res.json({ success: true, message: "Assistant response", data });
}

export async function listSessions(req, res) {
  const data = await historyService.listSessions(
    req.auth.userId,
    req.params.workspaceId,
    req.query,
  );
  res.json({ success: true, message: "Assistant sessions", data });
}

export async function getSession(req, res) {
  const data = await historyService.getSession(
    req.auth.userId,
    req.params.workspaceId,
    req.params.sessionId,
  );
  res.json({ success: true, message: "Assistant session", data });
}

export async function getSessionMessages(req, res) {
  const data = await historyService.getSessionMessages(
    req.auth.userId,
    req.params.workspaceId,
    req.params.sessionId,
  );
  res.json({ success: true, message: "Session messages", data });
}

export async function deleteSession(req, res) {
  const data = await historyService.deleteSession(
    req.auth.userId,
    req.params.workspaceId,
    req.params.sessionId,
  );
  res.json({ success: true, message: "Session deleted", data });
}

