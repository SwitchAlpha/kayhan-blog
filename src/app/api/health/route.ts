import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = { time: new Date().toISOString() };
  let ok = true;
  try {
    await db.execute(sql`select 1`);
    checks.db = "ok";
  } catch (e) {
    ok = false;
    checks.db = e instanceof Error ? e.message : "error";
  }
  return NextResponse.json({ ok, ...checks }, { status: ok ? 200 : 503 });
}
