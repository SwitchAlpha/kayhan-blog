import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { revalidateTags } from "@/lib/cache/revalidate";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const secret = process.env.INTERNAL_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { tags?: unknown };
  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string" && t.length < 200).slice(0, 100) : [];
  revalidateTags(tags);
  return NextResponse.json({ ok: true, count: tags.length });
}
