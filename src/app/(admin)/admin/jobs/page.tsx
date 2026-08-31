import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/dal";
import { AdminShell } from "@/components/admin/AdminShell";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

type JobRow = { id: string; name: string; state: string; created_on: string; started_on: string | null; completed_on: string | null; retry_count: number; output: unknown };

export default async function JobsAdmin() {
  await requireAdmin();
  let rows: JobRow[] = [];
  let error: string | null = null;
  try {
    const r = await db.execute(sql`SELECT id, name, state, created_on, started_on, completed_on, retry_count, output FROM pgboss.job WHERE name NOT IN ('scheduler.tick','indexnow.drain') OR state = 'failed' ORDER BY created_on DESC LIMIT 100`);
    rows = r.rows as JobRow[];
  } catch (e) {
    error = e instanceof Error ? e.message : "pg-boss şeması yok (iş kuyruğu henüz başlatılmadı)";
  }
  return (
    <AdminShell title="İşler">
      {error && <p className="card mt-2 text-red-700">{error}</p>}
      <div className="card mt-2 p-0"><table className="table"><thead><tr><th>Kuyruk</th><th>Durum</th><th>Oluşturuldu</th><th>Bitti</th><th>Deneme</th><th>Çıktı</th></tr></thead>
        <tbody>{rows.map((j) => <tr key={j.id} ><td className="py-1">{j.name}</td><td>{j.state}</td><td>{new Date(j.created_on).toLocaleString("tr-TR")}</td><td>{j.completed_on ? new Date(j.completed_on).toLocaleString("tr-TR") : "-"}</td><td>{j.retry_count}</td><td className="truncate">{j.output ? JSON.stringify(j.output).slice(0, 100) : ""}</td></tr>)}</tbody>
      </table></div>
    </AdminShell>
  );
}
