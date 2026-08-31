export const dynamic = "force-dynamic";
import { db } from "@/lib/db/client";
import { PostForm } from "@/components/admin/PostForm";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function NewPostPage() {
  const cats = await db.query.categories.findMany();
  return (
    <AdminShell title="Yeni yazı" wide>
      <PostForm categories={cats} initial={{ locale: "tr", title: "", slug: "", summary: "", seoTitle: null, seoDescription: null, categoryId: "auto", contentJson: { type: "doc", content: [{ type: "paragraph" }] }, status: "draft", scheduledAt: null, tags: "", cover: null }} />
    </AdminShell>
  );
}
