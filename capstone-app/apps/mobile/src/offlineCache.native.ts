import * as SQLite from "expo-sqlite";

type CachedPayloadRow = {
  payload: string;
  updated_at: number;
};

const DATABASE_NAME = "capstone-mobile-cache.db";
const CACHE_TABLE = "cached_payloads";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS ${CACHE_TABLE} (
          cache_key TEXT PRIMARY KEY NOT NULL,
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      return db;
    });
  }

  return databasePromise;
}

export async function setCachedValue<T>(key: string, value: T) {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO ${CACHE_TABLE} (cache_key, payload, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       payload = excluded.payload,
       updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), Date.now()]
  );
}

export async function getCachedValue<T>(key: string) {
  const db = await getDatabase();

  const row = await db.getFirstAsync<CachedPayloadRow>(
    `SELECT payload, updated_at FROM ${CACHE_TABLE} WHERE cache_key = ?`,
    [key]
  );

  if (!row) {
    return null;
  }

  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

export async function getCachedTimestamp(key: string) {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ updated_at: number }>(
    `SELECT updated_at FROM ${CACHE_TABLE} WHERE cache_key = ?`,
    [key]
  );

  return row?.updated_at ?? null;
}

export async function deleteCachedValue(key: string) {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM ${CACHE_TABLE} WHERE cache_key = ?`, [key]);
}
