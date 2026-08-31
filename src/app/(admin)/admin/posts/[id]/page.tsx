export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { AdminShell } from "@/components/admin/AdminShell";
import { db } from "@/lib/db/client";
import { getPostLocaleForAdmin } from "@/lib/db/queries/posts";
import { PostForm } from "@/components/admin/PostForm";
import { variantUrl } from "@/lib/media/pipeline";

export default async function EditPostPage({ params }: PageProps<"/admin/posts/[id]">) {
  const { id } = await params;
  const [row, cats] = await Promise.all([getPostLocaleForAdmin(id), db.query.categories.findMany()]);
  if (!row) notFound();
  return (
    <AdminShell title="Yazıyı düzenle" wide>
      <PostForm
        categories={cats}
        initial={{
          id: row.id, locale: row.locale, title: row.title, slug: row.slug, summary: row.summary, seoTitle: row.seoTitle, seoDescription: row.seoDescription,
          categoryId: row.post.categoryId, contentJson: row.contentJson as JSONContent, status: row.status,
          tags: row.post.postTags.map((pt) => pt.tag.nameTr).join(", "),
          cover: row.post.cover ? { id: row.post.cover.id, src: variantUrl(row.post.cover.variants[row.post.cover.variants.length - 1].key) } : null,
          scheduledAt: row.scheduledAt ? new Date(row.scheduledAt.getTime() - row.scheduledAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : null,
        }}
      />
    </AdminShell>
  );
}
