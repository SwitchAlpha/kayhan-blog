import { buildRss } from "@/lib/seo/feeds";
export async function GET() {
  return new Response(await buildRss("tr"), { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
