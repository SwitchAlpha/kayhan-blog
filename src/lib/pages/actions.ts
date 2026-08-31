"use server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import type { JSONContent } from "@tiptap/core";
import { db } from "@/lib/db/client";
import { pages } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { deriveContent } from "@/lib/content/derive";
import { tags } from "@/lib/cache/tags";
import { PAGE_KEYS } from "@/lib/db/queries/site";

const Input = z.object({
  key: z.enum(PAGE_KEYS),
  locale: z.enum(["tr", "en"]),
  title: z.string().trim().min(1).max(200),
  contentJson: z.custom<JSONContent>((v) => typeof v === "object" && v !== null && (v as { type?: unknown }).type === "doc"),
});

export async function savePage(raw: z.input<typeof Input>) {
  await requireAdmin();
  const input = Input.parse(raw);
  const d = await deriveContent(input.contentJson, input.locale);
  await db
    .insert(pages)
    .values({ key: input.key, locale: input.locale, title: input.title, contentJson: d.contentJson, contentHtml: d.html, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [pages.key, pages.locale], set: { title: input.title, contentJson: d.contentJson, contentHtml: d.html, updatedAt: new Date() } });
  revalidateTag(tags.page(input.key), { expire: 0 });
  revalidateTag(tags.sitemap, "max");
  return { ok: true };
}
