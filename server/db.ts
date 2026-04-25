import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Lazy initialization — only connect when actually needed.
// This prevents the serverless function from crashing at startup
// if DATABASE_URL is not configured (e.g., login route works without DB).
let _pool: InstanceType<typeof Pool> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool() {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Configure it in Vercel Environment Variables.",
      );
    }
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

// Legacy exports for backward compatibility
export const pool = new Proxy({} as InstanceType<typeof Pool>, {
  get(_target, prop) {
    return (getPool() as any)[prop];
  },
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

