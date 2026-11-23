import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  DATABASE_MIGRATION_URL: z.string().min(1).optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_SSL: z.enum(["true", "false"]).default("false"),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("1h"),
  COOKIE_NAME: z.string().min(1).default("data_nexus_session"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  LOCAL_STORAGE_PATH: z.string().default("./storage"),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  INVITATION_EXPIRES_HOURS: z.coerce.number().int().positive().default(72),
  PASSWORD_RESET_EXPIRES_MINUTES: z.coerce.number().int().positive().default(30),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default("Data Nexus <no-reply@example.com>"),
  LLM_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
  LLM_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  const details = result.error.issues.map(({ path, message }) => `${path.join(".")}: ${message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = Object.freeze(result.data);
