import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const isProduction = process.env.NODE_ENV === "production";

export const db = connectionString
  ? new Pool({
      connectionString,
      ssl: isProduction ? { rejectUnauthorized: false } : undefined,
    })
  : null;

export async function pingDatabase() {
  if (!db) {
    return null;
  }

  const result = await db.query("SELECT 1 AS ok");
  return result.rows[0];
}
