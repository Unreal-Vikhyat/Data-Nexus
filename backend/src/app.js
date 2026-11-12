import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import authRoutes from "./routes/auth.routes.js";
import healthRoutes from "./routes/health.routes.js";
import workspaceRoutes from "./routes/workspace.routes.js";
import reportRoutes from "./routes/report.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || origin === env.FRONTEND_URL) return callback(null, true);
      const error = new Error("Origin is not allowed by CORS");
      error.status = 403;
      error.code = "ORIGIN_NOT_ALLOWED";
      return callback(error);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Request-Id"],
  }));
  app.use((req, _res, next) => {
    req.id = req.get("x-request-id")?.slice(0, 100) || randomUUID();
    next();
  });
  app.use(pinoHttp({ logger, genReqId: (req) => req.id }));
  app.use((req, _res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
      const origin = req.get("origin");
      if (origin && origin !== env.FRONTEND_URL) {
        const error = new Error("Request origin is not allowed");
        error.status = 403;
        error.code = "ORIGIN_NOT_ALLOWED";
        return next(error);
      }
      if (origin && !req.is("application/json")) {
        const error = new Error("State-changing browser requests must use JSON");
        error.status = 415;
        error.code = "UNSUPPORTED_MEDIA_TYPE";
        return next(error);
      }
    }
    return next();
  });
  app.use(express.json({ limit: "1mb", type: "application/json" }));
  app.use(cookieParser());
  app.use("/api/v1", healthRoutes);
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1", workspaceRoutes);
  app.use("/api/v1", reportRoutes);
  app.use("/api/v1", billingRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
