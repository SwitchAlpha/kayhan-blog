import { Pool } from "pg";

export const testPool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://kb:kb@localhost:5432/blog",
  max: 2,
});

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await testPool.query(text, params);
  return r.rows as T[];
}
