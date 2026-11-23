import { Router } from "express";
import { pool } from "../database/pool.js";
import { assertRlsConfiguration, assertRuntimeRole } from "../database/transaction.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
router.get("/health", (_req, res) => res.json({ success: true, message: "Data Nexus API is running", data: { status: "ok" } }));
router.get("/health/ready", asyncHandler(async (_req, res) => {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    await assertRuntimeRole(client);
    await assertRlsConfiguration(client);
  } finally {
    client.release();
  }
  res.json({ success: true, message: "API and database are ready", data: { status: "ready" } });
}));

export default router;
