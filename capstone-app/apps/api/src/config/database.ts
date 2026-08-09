import { Pool } from "pg";
import { env, isProduction } from "./env";

const connectionString = env.databaseUrl;

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: isProduction ? { rejectUnauthorized: false } : undefined,
    })
  : null;

if (pool) {
  pool.on("connect", () => {
    console.log("PostgreSQL pool connected");
  });

  pool.on("error", (error) => {
    console.error("PostgreSQL pool error:", error);
  });
}

export async function query<T = Record<string, unknown>>(
  text: string,
  values: unknown[] = []
) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }

  return pool.query<T>(text, values as any[]);
}

export async function pingDatabase() {
  if (!pool) {
    return null;
  }

  const result = await query("SELECT 1 AS ok");
  return result.rows[0];
}
