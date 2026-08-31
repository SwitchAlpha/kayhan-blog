import { buildLlmsIndex } from "@/lib/seo/llms";
export async function GET() {
  return new Response(await buildLlmsIndex(), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
