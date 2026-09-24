import "dotenv/config";
import fs from "node:fs";
import { Client } from "pg";

const sql = fs.readFileSync(new URL("./.tmp-schema.sql", import.meta.url), "utf8");
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 20000,
});

await client.connect();
const existing = await client.query(
  "select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations' order by 1",
);
if (existing.rows.length > 0) {
  console.error("Database already has tables:", existing.rows.map((row) => row.tablename).join(", "));
  await client.end();
  process.exit(1);
}

await client.query("BEGIN");
try {
  await client.query(sql);
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
}

const created = await client.query(
  "select tablename from pg_tables where schemaname = 'public' order by 1",
);
console.log(`Schema applied. ${created.rows.length} tables.`);
await client.end();
