export const dynamic = "force-dynamic";
import Link from "next/link";
import { listPostsForAdmin } from "@/lib/db/queries/posts";
import { db } from "@/lib/db/client";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { AdminShell } from "@/components/admin/AdminShell";

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Taslak", cls: "badge-draft" }, scheduled: { label: "Zamanlandı", cls: "badge-scheduled" }, publishing: { label: "Yayınlanıyor", cls: "badge-scheduled" },
  published: { label: "Yayında", cls: "badge-published" }, unpublished: { label: "Kaldırıldı", cls: "badge-draft" },
};

export default async function PostsPage() {
  const [rows, cats] = await Promise.all([listPostsForAdmin(), db.query.categories.findMany()]);
  return (
    <AdminShell title="Yazılar" actions={<Link className="btn btn-primary" href="/admin/posts/new">Yeni yazı</Link>}>
      <div className="card mb-6">
        <div className="mb-2 text-[0.85rem] text-ink-2">Kategoriler: {cats.map((c) => c.nameTr).join(", ") || "henüz yok"}</div>
        <CategoryForm />
      </div>
      <div className="card p-0">
        <table className="table">
          <thead><tr><th>Başlık</th><th>Dil</th><th>Durum</th><th>Kategori</th><th>Kelime</th><th>Güncellendi</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const st = STATUS[r.status] ?? { label: r.status, cls: "" };
              return (
                <tr key={r.id}>
                  <td><Link className="font-medium hover:text-pen" href={`/admin/posts/${r.id}`}>{r.title || "(başlıksız)"}</Link></td>
                  <td className="font-mono text-[0.75rem] uppercase">{r.locale}</td>
                  <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td>{r.categoryName}</td><td>{r.wordCount}</td>
                  <td className="text-ink-3">{r.updatedAt.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td className="py-6 text-ink-3" colSpan={6}>Henüz yazı yok. İlk notunu yazmak için “Yeni yazı”.</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
