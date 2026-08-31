import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __kbPool?: Pool };

export const pool =
  globalForDb.__kbPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  });
if (process.env.NODE_ENV !== "production") globalForDb.__kbPool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
