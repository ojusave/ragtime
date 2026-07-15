import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { envNumber } from "@ragtime/core";
import * as schema from "./schema.js";

export type Db = PostgresJsDatabase<typeof schema>;

let _db: Db | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export function getDb(): Db {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  // REVIEW M5 (Medium, security): rejectUnauthorized:false disables certificate
  // verification for every non-localhost connection — a MITM can impersonate the
  // database. Default to rejectUnauthorized:true with a CA bundle from config, and make
  // insecure local mode an explicit dev flag rather than a hostname substring check.
  _client = postgres(url, {
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
    max: envNumber("DB_POOL_MAX", 3),
    idle_timeout: 20,
    connect_timeout: 30,
  });
  _db = drizzle(_client, { schema });
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
  }
}

export { schema };
