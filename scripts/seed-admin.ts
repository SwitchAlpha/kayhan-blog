// pnpm seed:admin — creates the single admin user from ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD.
// Uses a private auth instance with sign-up enabled (the app instance has disableSignUp: true).
import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";
import { SITE_AUTHOR, SITE_NAME } from "../src/lib/site/config";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_INITIAL_PASSWORD;
if (!email || !password) throw new Error("ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD are required");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
const seedAuth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  plugins: [twoFactor({ issuer: SITE_NAME })],
});

async function main() {
  const existing = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, email!) });
  if (existing) {
    console.log(`admin already exists: ${email}`);
  } else {
    await seedAuth.api.signUpEmail({ body: { email: email!, password: password!, name: SITE_AUTHOR } });
    console.log(`admin created: ${email} — enable 2FA at /admin/security after first login`);
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
