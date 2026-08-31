export const dynamic = "force-dynamic";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { db } from "@/lib/db/client";
import { PAGE_KEYS } from "@/lib/db/queries/site";

const LABELS: Record<string, string> = { about: "Hakkımda", contact: "İletişim", privacy: "Gizlilik ve Aydınlatma", cookies: "Çerez Aydınlatma", disclosure: "Bu blog nasıl yazılıyor" };

export default async function PagesAdmin() {
  const rows = await db.query.pages.findMany();
  return (
    <AdminShell title="Sabit sayfalar">
      <div className="card p-0"><table className="table">
        <thead><tr><th>Sayfa</th><th>TR</th><th>EN</th></tr></thead>
        <tbody>
          {PAGE_KEYS.map((k) => (
            <tr key={k}>
              <td className="font-medium">{LABELS[k]}</td>
              {(["tr", "en"] as const).map((loc) => {
                const has = rows.some((r) => r.key === k && r.locale === loc);
                return <td key={loc}><Link className={has ? "link" : "btn btn-sm"} href={`/admin/pages/${k}?locale=${loc}`}>{has ? "Düzenle" : "Oluştur"}</Link></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table></div>
    </AdminShell>
  );
}
