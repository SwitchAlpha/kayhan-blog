import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { consentLog } from "@/lib/db/schema";
import { CONSENT_POLICY_VERSION } from "@/lib/consent/config";
import { geoBucket } from "@/lib/geo/bucket";

const Body = z.object({ consentId: z.string().uuid(), choice: z.enum(["granted", "denied", "partial"]), categories: z.array(z.string()).max(10) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const h = await headers();
  const country = h.get("cf-ipcountry");
  const ua = h.get("user-agent") ?? "";
  const uaFamily = /Mobile|Android|iPhone/i.test(ua) ? "mobile" : "desktop";
  await db.insert(consentLog).values({ consentId: parsed.data.consentId, geoBucket: geoBucket(country), country: country?.slice(0, 2) ?? null, choice: parsed.data.choice, categories: parsed.data.categories, policyVersion: CONSENT_POLICY_VERSION, uaFamily });
  return NextResponse.json({ ok: true });
}
