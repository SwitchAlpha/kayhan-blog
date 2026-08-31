import { getPostLlms } from "@/lib/seo/llms";

export async function GET(_req: Request, ctx: RouteContext<"/llms/[locale]/[slug]">) {
  const { locale: l, slug: raw } = await ctx.params;
  if (l !== "tr" && l !== "en") return new Response("Not found", { status: 404 });
  const slug = raw.replace(/\.(txt|md)$/, "");
  const text = await getPostLlms(l, slug);
  if (!text) return new Response("Not found", { status: 404 });
  return new Response(text, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600", "X-Robots-Tag": "noindex" } });
}
