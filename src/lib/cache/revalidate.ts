import "server-only";
import { revalidateTag } from "next/cache";

/**
 * Revalidate tags. Inside a Server Action/Route Handler call `revalidateTags` directly;
 * from background jobs (no request scope) use `revalidateViaLoopback`.
 */
export function revalidateTags(tagList: string[]) {
  for (const t of tagList) revalidateTag(t, { expire: 0 });
}

export async function revalidateViaLoopback(tagList: string[]) {
  const port = process.env.PORT ?? "3000";
  const res = await fetch(`http://127.0.0.1:${port}/api/internal/revalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.INTERNAL_SECRET ?? ""}` },
    body: JSON.stringify({ tags: tagList }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`revalidate loopback failed: ${res.status}`);
}
