import "server-only";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./client";

/** Apply pending Drizzle migrations (idempotent; single instance so no lock coordination needed). */
export async function runMigrations() {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log(JSON.stringify({ level: "info", src: "db", msg: "migrations applied" }));
}
