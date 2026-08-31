import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPublishedPostBySlug } from "@/lib/db/queries/posts";
import type { Locale } from "@/lib/db/schema";
import { SITE_WORDMARK } from "@/lib/site/config";

export const runtime = "nodejs";

let fontPromise: Promise<ArrayBuffer | null> | null = null;
function font() {
  fontPromise ??= readFile(path.join(process.cwd(), "public/fonts/Inter-SemiBold.woff")).then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer).catch(() => null);
  return fontPromise;
}

export async function GET(_req: Request, ctx: RouteContext<"/og/[locale]/[slug]">) {
  const { locale: l, slug: raw } = await ctx.params;
  const locale: Locale = l === "en" ? "en" : "tr";
  const slug = raw.replace(/\.png$/, "");
  const post = await getPublishedPostBySlug(locale, slug);
  if (!post) return new Response("Not found", { status: 404 });
  const f = await font();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "#18181b", color: "#fafafa", fontFamily: f ? "Inter" : "sans-serif" }}>
        <div style={{ fontSize: 28, color: "#a1a1aa" }}>{locale === "en" ? post.post.category.nameEn : post.post.category.nameTr}</div>
        <div style={{ fontSize: post.title.length > 60 ? 52 : 64, fontWeight: 600, lineHeight: 1.15 }}>{post.title}</div>
        <div style={{ fontSize: 28, color: "#a1a1aa" }}>{SITE_WORDMARK}</div>
      </div>
    ),
    { width: 1200, height: 630, fonts: f ? [{ name: "Inter", data: f, weight: 600 }] : [], headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
