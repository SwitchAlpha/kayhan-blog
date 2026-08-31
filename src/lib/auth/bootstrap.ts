import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { SITE_AUTHOR, SITE_NAME } from "@/lib/site/config";

/**
 * First-boot admin bootstrap: if ADMIN_EMAIL/ADMIN_INITIAL_PASSWORD are set and no user exists,
 * create the single admin. Uses a private auth instance with sign-up enabled (the app one disables it).
 */
export async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!email || !password) return;
  const existing = await db.query.user.findFirst();
  if (existing) return;
  const seed = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true },
    plugins: [twoFactor({ issuer: SITE_NAME })],
  });
  await seed.api.signUpEmail({ body: { email, password, name: SITE_AUTHOR } });
  console.log(JSON.stringify({ level: "info", src: "bootstrap", msg: `admin user created: ${email}` }));
}
