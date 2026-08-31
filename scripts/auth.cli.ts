// CLI-only auth config (no `server-only` import) used by `pnpm auth:generate`.
// Keep plugins in sync with src/lib/auth/auth.ts.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { SITE_NAME } from "../src/lib/site/config";

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  rateLimit: { enabled: true, storage: "database" },
  plugins: [twoFactor({ issuer: SITE_NAME }), passkey({ rpID: "localhost", rpName: SITE_NAME })],
});
