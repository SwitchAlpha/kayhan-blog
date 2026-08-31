import { readVariant } from "@/lib/media/pipeline";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path } = await ctx.params;
  const v = await readVariant(path.join("/"));
  if (!v) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(v.body), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(v.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
