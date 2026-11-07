import { logger } from "../config/logger.js";

export function notFound(_req, res) {
  res.status(404).json({ success: false, message: "Route not found", errors: {} });
}

export function errorHandler(error, req, res, _next) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) logger.error({ err: error, requestId: req.id }, "Request failed");
  const message = status >= 500 && process.env.NODE_ENV === "production"
    ? "Internal server error"
    : error.message || "Request failed";
  const errors = error.details ?? {};
  res.status(status).json({ success: false, message, errors, ...(error.code ? { code: error.code } : {}) });
}
