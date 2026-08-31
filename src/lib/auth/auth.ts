import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { SITE_NAME } from "@/lib/site/config";

function rpId() {
  try { return new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").hostname; } catch { return "localhost"; }
}

/**
 * Single-admin auth. Sign-up is disabled; the admin row is created by `pnpm seed:admin`.
 * Rate limiting is stored in Postgres (survives restarts / multiple processes).
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  appName: SITE_NAME,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 10, max: 3 },
      "/two-factor/verify-totp": { window: 10, max: 3 },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    ipAddress: { ipAddressHeaders: ["x-real-ip", "cf-connecting-ip", "x-forwarded-for"] },
  },
  plugins: [
    twoFactor({ issuer: SITE_NAME }),
    passkey({ rpID: rpId(), rpName: SITE_NAME, origin: process.env.BETTER_AUTH_URL }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
