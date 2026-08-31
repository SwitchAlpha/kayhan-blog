import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/** Verified session or null. Cached per request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/**
 * Every admin Server Action / Route Handler / page must call this first.
 * proxy.ts only does an optimistic cookie check — it is not a security boundary.
 */
export const requireAdmin = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session.user;
});
