import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { env } from "../config/env.js";

const { Client } = pg;
const migrationsDirectory = fileURLToPath(new URL("./migrations/", import.meta.url));
const connectionString = env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL;

export async function migrate(client = new Client({ connectionString })) {
  const ownsClient = !client._connected;
  if (ownsClient) await client.connect();
  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION CURRENT_USER");
    await client.query("SET search_path TO app, public");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();
    const applied = new Set((await client.query("SELECT id FROM schema_migrations")).rows.map((row) => row.id));
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
      }
    }
    return files.filter((file) => !applied.has(file));
  } finally {
    if (ownsClient) await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate().then((files) => {
    console.info(files.length ? `Applied migrations: ${files.join(", ")}` : "Database is up to date");
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
