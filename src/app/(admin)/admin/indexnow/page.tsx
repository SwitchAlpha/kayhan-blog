import { requireAdmin } from "@/lib/auth/dal";
import { AdminShell } from "@/components/admin/AdminShell";
import { listQueue, listSubmissions } from "@/lib/indexnow/submit";
import { db } from "@/lib/db/client";
import { inArray } from "drizzle-orm";
import { settings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function IndexNowAdmin() {
  await requireAdmin();
  const [queue, subs, st] = await Promise.all([listQueue(), listSubmissions(50), db.select().from(settings).where(inArray(settings.key, ["indexnow.enabled", "indexnow.backoff_until", "indexnow.paused_reason"]))]);
  const s = Object.fromEntries(st.map((r) => [r.key, r.value]));
  return (
    <AdminShell title="IndexNow">
      <p className="mt-1 text-ink-2">
        Anahtar: {process.env.INDEXNOW_KEY ? "tanımlı" : "YOK"} · Durum: {s["indexnow.enabled"] === false ? `duraklatıldı (${String(s["indexnow.paused_reason"] ?? "")})` : "açık"}
        {s["indexnow.backoff_until"] ? ` · backoff: ${String(s["indexnow.backoff_until"])}` : ""}
        {process.env.NODE_ENV !== "production" && " · geliştirme ortamında gönderim yapılmaz"}
      </p>
      <h2 className="label mt-8">Kuyruk ({queue.length})</h2>
      <div className="card mt-2 p-0"><table className="table"><thead><tr><th>URL</th><th>Eylem</th><th>En erken</th><th>Deneme</th><th>Hata</th></tr></thead>
        <tbody>{queue.map((q) => <tr key={q.url} ><td className="py-1">{q.url}</td><td>{q.action}</td><td>{q.notBefore.toLocaleString("tr-TR")}</td><td>{q.attempts}</td><td className="text-red-700">{q.lastError}</td></tr>)}</tbody>
      </table></div>
      <h2 className="label mt-8">Gönderimler</h2>
      <div className="card mt-2 p-0"><table className="table"><thead><tr><th>Zaman</th><th>HTTP</th><th>URL sayısı</th><th>Yanıt</th></tr></thead>
        <tbody>{subs.map((r) => <tr key={r.id} ><td className="py-1">{r.submittedAt.toLocaleString("tr-TR")}</td><td>{r.httpStatus ?? "ağ hatası"}</td><td>{r.urls.length}</td><td className="truncate">{r.responseBody?.slice(0, 120)}</td></tr>)}</tbody>
      </table></div>
    </AdminShell>
  );
}
