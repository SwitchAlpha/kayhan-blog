"use server";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { JSONContent } from "@tiptap/core";
import { db } from "@/lib/db/client";
import { auditLog, categories, postLocales, postTags, posts, redirects, tags as tagsTable, type Locale } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { deriveContent } from "@/lib/content/derive";
import { categorizePost } from "@/lib/ai/categorize";
import { clampSeo, generateSeo } from "@/lib/ai/seo";
import { isValidSlug, toSlug } from "@/lib/content/slug";
import { tags } from "@/lib/cache/tags";
import { href } from "@/lib/seo/routes";
import { finalizePublish, affectedPaths } from "./publish";
import { enqueueIndexNow } from "@/lib/indexnow/queue";
import { revalidateTags } from "@/lib/cache/revalidate";

const jsonDoc = z.custom<JSONContent>((v) => typeof v === "object" && v !== null && (v as { type?: unknown }).type === "doc", "Geçersiz içerik");

const SaveInput = z.object({
  id: z.string().uuid().optional(),
  locale: z.enum(["tr", "en"]),
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().optional(),
  summary: z.string().trim().max(500).default(""),
  seoTitle: z.string().trim().max(120).optional().nullable(),
  seoDescription: z.string().trim().max(300).optional().nullable(),
  /** A uuid, or "auto" to let the content decide (see lib/ai/categorize). */
  categoryId: z.union([z.string().uuid(), z.literal("auto")]),
  coverMediaId: z.string().uuid().nullable().optional(),
  contentJson: jsonDoc,
  substantive: z.boolean().default(true),
  /** comma-separated tag names (TR names; EN slug/name filled later) */
  tags: z.string().max(500).default(""),
});
export type SaveInput = z.input<typeof SaveInput>;

async function syncTags(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], postId: string, raw: string) {
  const names = Array.from(new Set(raw.split(",").map((t) => t.trim()).filter(Boolean))).slice(0, 10);
  await tx.delete(postTags).where(eq(postTags.postId, postId));
  const ids: string[] = [];
  for (const name of names) {
    const slug = toSlug(name);
    if (!slug) continue;
    const [row] = await tx
      .insert(tagsTable)
      .values({ nameTr: name, slugTr: slug, nameEn: name, slugEn: slug })
      .onConflictDoUpdate({ target: tagsTable.slugTr, set: { nameTr: name } })
      .returning({ id: tagsTable.id });
    ids.push(row.id);
  }
  if (ids.length) await tx.insert(postTags).values(ids.map((tagId) => ({ postId, tagId }))).onConflictDoNothing();
  return names.join(" ");
}

function revalidatePostLocale(row: { id: string; locale: string; slug: string; postId: string }) {
  revalidateTag(tags.post(row.postId), "max");
  revalidateTag(tags.posts(row.locale), { expire: 0 }); // read-your-writes on lists (single instance, cheap)
  revalidateTag(`post-slug:${row.locale}:${row.slug}`, { expire: 0 });
  revalidateTag(tags.sitemap, "max");
  revalidateTag(tags.feed(row.locale), "max");
}

/** Create or update a post locale (draft/edit). Returns the post_locales id. */
export async function savePost(raw: SaveInput): Promise<{ id: string }> {
  const user = await requireAdmin();
  const input = SaveInput.parse(raw);
  const derived = await deriveContent(input.contentJson, input.locale);
  const slug = input.slug?.trim() ? toSlug(input.slug) : toSlug(input.title);
  if (!isValidSlug(slug)) throw new Error("Geçersiz veya rezerve slug: " + slug);

  // "auto" only reaches here when the author left the picker alone. A chosen
  // category is never revisited: silently reassigning someone's post is the one
  // behaviour that would make this untrustworthy.
  let categoryId = input.categoryId;
  if (categoryId === "auto") {
    const outcome = await categorizePost({
      title: input.title,
      summary: input.summary,
      contentMd: derived.md,
      contentHash: derived.contentHash,
    });
    if (outcome.kind === "skipped") {
      // The author asked not to choose, so a save must not fail because the AI
      // budget ran out or the key is missing. Keep the post's own category when
      // editing; otherwise the first existing one; and on a blog with none at
      // all, make the fallback rather than refusing to save.
      const current = input.id
        ? await db.query.postLocales.findFirst({ where: eq(postLocales.id, input.id) })
        : null;
      let fallback = current
        ? (await db.query.posts.findFirst({ where: eq(posts.id, current.postId) }))?.categoryId
        : (await db.query.categories.findFirst({ orderBy: (c, { asc }) => [asc(c.sort)] }))?.id;
      if (!fallback) {
        const [made] = await db
          .insert(categories)
          .values({ nameTr: "Genel", nameEn: "General", slugTr: "genel", slugEn: "general" })
          .onConflictDoUpdate({ target: categories.slugTr, set: { nameTr: "Genel" } })
          .returning({ id: categories.id });
        fallback = made.id;
      }
      categoryId = fallback;
    } else {
      categoryId = outcome.categoryId;
      if (outcome.kind === "created") revalidateTag(tags.sitemap, "max");
    }
  }

  const cat = await db.query.categories.findFirst({ where: eq(categories.id, categoryId) });
  if (!cat) throw new Error("Kategori bulunamadı");

  // Search metadata: only ever fills what the author left empty. A model
  // writing a better title than the one that was typed is not a reason to
  // replace it, and a save must not fail because the AI is unavailable.
  let { summary, seoTitle, seoDescription } = {
    summary: input.summary,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
  };
  let tagsRaw = input.tags;
  const needsSeo = !summary.trim() || !seoTitle?.trim() || !seoDescription?.trim() || !tagsRaw.trim();
  if (needsSeo) {
    const raw = await generateSeo({
      locale: input.locale as Locale,
      title: input.title,
      contentMd: derived.md,
      contentHash: derived.contentHash,
    }).catch(() => null);
    if (raw) {
      const seo = clampSeo(raw);
      if (!summary.trim()) summary = seo.summary;
      if (!seoTitle?.trim()) seoTitle = seo.seo_title;
      if (!seoDescription?.trim()) seoDescription = seo.seo_description;
      if (!tagsRaw.trim()) tagsRaw = seo.tags.join(", ");
    }
  }

  const values = {
    title: input.title, summary, seoTitle, seoDescription,
    contentJson: derived.contentJson, contentHtml: derived.html, contentMd: derived.md, contentPlain: derived.plain,
    toc: derived.toc, wordCount: derived.wordCount, readingTimeSec: derived.readingTimeSec, contentHash: derived.contentHash,
    updatedAt: new Date(),
  };

  if (!input.id) {
    const id = await db.transaction(async (tx) => {
      const [post] = await tx.insert(posts).values({ categoryId, coverMediaId: input.coverMediaId ?? null }).returning({ id: posts.id });
      const tagNames = await syncTags(tx, post.id, tagsRaw);
      const [row] = await tx
        .insert(postLocales)
        .values({ ...values, tagNames, postId: post.id, locale: input.locale as Locale, slug })
        .returning({ id: postLocales.id });
      await tx.insert(auditLog).values({ actor: user.email, action: "post.create", entity: "post_locale", entityId: row.id });
      return row.id;
    });
    return { id };
  }

  const existing = await db.query.postLocales.findFirst({ where: eq(postLocales.id, input.id) });
  if (!existing) throw new Error("Yazı bulunamadı");

  await db.transaction(async (tx) => {
    await tx.update(posts).set({ categoryId, coverMediaId: input.coverMediaId ?? null, updatedAt: new Date() }).where(eq(posts.id, existing.postId));
    const tagNames = await syncTags(tx, existing.postId, tagsRaw);
    const contentChanged = existing.contentHash !== derived.contentHash;
    await tx
      .update(postLocales)
      .set({
        ...values,
        tagNames,
        slug,
        contentUpdatedAt: existing.status === "published" && contentChanged && input.substantive ? new Date() : existing.contentUpdatedAt,
      })
      .where(eq(postLocales.id, input.id!));
    if (existing.status === "published" && existing.slug !== slug) {
      // slug change: 301 old → new
      await tx
        .insert(redirects)
        .values({ fromPath: href(existing.locale, "post", { slug: existing.slug }), toPath: href(existing.locale, "post", { slug }), statusCode: 301, postLocaleId: existing.id })
        .onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: href(existing.locale, "post", { slug }), statusCode: 301 } });
      revalidateTag(tags.redirects, { expire: 0 });
    }
    await tx.insert(auditLog).values({ actor: user.email, action: "post.update", entity: "post_locale", entityId: existing.id, diff: { contentChanged, slug } });
  });
  if (existing.status === "published") {
    revalidatePostLocale({ ...existing, slug });
    const contentChanged = existing.contentHash !== derived.contentHash;
    if (existing.slug !== slug) {
      await enqueueIndexNow([href(existing.locale, "post", { slug: existing.slug })], "redirect", 60);
      await enqueueIndexNow(await affectedPaths({ ...existing, slug }), "publish", 60);
    } else if (contentChanged && input.substantive) {
      await enqueueIndexNow([href(existing.locale, "post", { slug })], "update", 60);
    }
    if (contentChanged) {
      try {
        const { getBoss, QUEUES } = await import("@/lib/jobs/boss");
        await getBoss().send(QUEUES.postRelink, { localeId: existing.id }, { singletonKey: `relink:${existing.id}`, singletonSeconds: 120, startAfter: 60, retryLimit: 2 });
      } catch { /* jobs not running (e.g. build) */ }
    }
  }
  return { id: existing.id };
}

export async function publishPost(id: string, scheduledAt?: string | null) {
  const user = await requireAdmin();
  const row = await db.query.postLocales.findFirst({ where: eq(postLocales.id, id) });
  if (!row) throw new Error("Yazı bulunamadı");
  const when = scheduledAt ? new Date(scheduledAt) : null;
  if (when && when.getTime() > Date.now() + 60_000) {
    await db.update(postLocales).set({ status: "scheduled", scheduledAt: when, updatedAt: new Date() }).where(eq(postLocales.id, id));
    await db.insert(auditLog).values({ actor: user.email, action: "post.schedule", entity: "post_locale", entityId: id, diff: { scheduledAt: when } });
    return { status: "scheduled" as const };
  }
  await finalizePublish(id, user.email, (t) => revalidateTags(t));
  return { status: "published" as const };
}

export async function unpublishPost(id: string) {
  const user = await requireAdmin();
  const row = await db.query.postLocales.findFirst({ where: eq(postLocales.id, id) });
  if (!row) throw new Error("Yazı bulunamadı");
  await db.transaction(async (tx) => {
    await tx.update(postLocales).set({ status: "unpublished", unpublishedAt: new Date(), updatedAt: new Date() }).where(eq(postLocales.id, id));
    await tx
      .insert(redirects)
      .values({ fromPath: href(row.locale, "post", { slug: row.slug }), statusCode: 410, postLocaleId: id })
      .onConflictDoUpdate({ target: redirects.fromPath, set: { statusCode: 410, toPath: null } });
    await tx.insert(auditLog).values({ actor: user.email, action: "post.unpublish", entity: "post_locale", entityId: id });
  });
  revalidatePostLocale(row);
  revalidateTag(tags.redirects, { expire: 0 });
  await enqueueIndexNow(await affectedPaths(row), "delete", 120);
  return { status: "unpublished" as const };
}

export async function deleteDraft(id: string) {
  const user = await requireAdmin();
  const row = await db.query.postLocales.findFirst({ where: eq(postLocales.id, id) });
  if (!row) return;
  if (row.status === "published") throw new Error("Yayındaki yazı silinemez; önce yayından kaldırın");
  await db.delete(posts).where(eq(posts.id, row.postId));
  await db.insert(auditLog).values({ actor: user.email, action: "post.delete", entity: "post_locale", entityId: id });
  redirect("/admin/posts");
}

const CategoryInput = z.object({ nameTr: z.string().trim().min(1), nameEn: z.string().trim().min(1) });
export async function createCategory(raw: z.input<typeof CategoryInput>) {
  await requireAdmin();
  const input = CategoryInput.parse(raw);
  const [row] = await db
    .insert(categories)
    .values({ nameTr: input.nameTr, nameEn: input.nameEn, slugTr: toSlug(input.nameTr), slugEn: toSlug(input.nameEn) })
    .returning({ id: categories.id });
  revalidateTag(tags.posts("tr"), "max");
  revalidateTag(tags.posts("en"), "max");
  return row;
}
