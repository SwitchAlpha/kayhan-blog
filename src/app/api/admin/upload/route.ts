import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/dal";
import { storeUpload } from "@/lib/media/pipeline";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  try {
    const stored = await storeUpload(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(stored);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "upload failed" }, { status: 400 });
  }
}
