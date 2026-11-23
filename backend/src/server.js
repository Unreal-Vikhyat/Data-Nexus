import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { closePool, pool } from "./database/pool.js";
import { assertRuntimeRole } from "./database/transaction.js";

const client = await pool.connect();
try {
  await assertRuntimeRole(client);
} finally {
  client.release();
}

const app = createApp();
const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, "Data Nexus API listening"));

async function shutdown(signal) {
  logger.info({ signal }, "Shutting down API");
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
