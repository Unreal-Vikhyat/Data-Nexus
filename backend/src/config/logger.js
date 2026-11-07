import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ["req.headers.cookie", "req.headers.authorization", "password", "passwordHash", "token", "jwt"],
    censor: "[REDACTED]",
  },
  base: { service: "data-nexus-backend" },
});
