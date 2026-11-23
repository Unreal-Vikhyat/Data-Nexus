import pg from "pg";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  application_name: "data-nexus-api",
  options: "-c search_path=app,public -c statement_timeout=10000 -c idle_in_transaction_session_timeout=10000",
});

pool.on("error", (error) => {
  // Pool errors are emitted for idle clients and must be logged without taking down the process.
  logger.error({ err: error }, "Unexpected idle PostgreSQL client error");
});

export async function closePool() {
  await pool.end();
}
