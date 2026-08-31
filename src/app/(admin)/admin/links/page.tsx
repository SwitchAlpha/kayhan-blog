import Link from "next/link";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireAdmin } from "@/lib/auth/dal";
import { AdminShell } from "@/components/admin/AdminShell";
import { db } from "@/lib/db/client";
import { appliedLinks, postLocales } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function LinksAdmin() {
  await requireAdmin();
  const src = alias(postLocales, "src"); const tgt = alias(postLocales, "tgt");
  const rows = await db.select({ id: appliedLinks.id, anchor: appliedLinks.anchorText, createdBy: appliedLinks.createdBy, appliedAt: appliedLinks.appliedAt, srcId: src.id, srcTitle: src.title, tgtTitle: tgt.title, tgtSlug: tgt.slug })
    .from(appliedLinks).innerJoin(src, eq(src.id, appliedLinks.sourceLocaleId)).innerJoin(tgt, eq(tgt.id, appliedLinks.targetLocaleId)).where(isNull(appliedLinks.revertedAt)).orderBy(desc(appliedLinks.appliedAt)).limit(200);
  const orphans = await db.execute(sql`SELECT pl.id, pl.title, pl.locale FROM post_locales pl WHERE pl.status='published' AND pl.published_at < now() - interval '3 days'
    AND NOT EXISTS (SELECT 1 FROM applied_links al WHERE al.target_locale_id = pl.id AND al.reverted_at IS NULL) ORDER BY pl.published_at DESC LIMIT 50`);
  return (
    <AdminShell title="İç bağlantılar">
      <h2 className="label mt-6">Gelen bağlantısı olmayan yazılar (orphan) — {orphans.rows.length}</h2>
      <ul className="mt-1 list-disc pl-5">{(orphans.rows as { id: string; title: string; locale: string }[]).map((o) => <li key={o.id}><Link className="underline" href={`/admin/posts/${o.id}`}>{o.title}</Link> <span className="text-zinc-500">({o.locale})</span></li>)}</ul>
      <h2 className="label mt-8">Aktif bağlantılar ({rows.length})</h2>
      <div className="card mt-2 p-0"><table className="table"><thead><tr><th>Kaynak</th><th>Anchor</th><th>Hedef</th><th>Kim</th><th>Tarih</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id} ><td className="py-1"><Link className="underline" href={`/admin/posts/${r.srcId}`}>{r.srcTitle}</Link></td><td>“{r.anchor}”</td><td>{r.tgtTitle}</td><td>{r.createdBy}</td><td>{r.appliedAt.toLocaleDateString("tr-TR")}</td></tr>)}</tbody>
      </table></div>
    </AdminShell>
  );
}
