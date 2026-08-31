export const dynamic = "force-dynamic";
import { requireAdmin } from "@/lib/auth/dal";
import { AdminShell } from "@/components/admin/AdminShell";
import { TwoFactorSetup } from "@/components/admin/TwoFactorSetup";
import { PasskeyManager } from "@/components/admin/PasskeyManager";
import { ChangePassword } from "@/components/admin/ChangePassword";

export default async function SecurityPage() {
  const user = await requireAdmin();
  const enabled = Boolean((user as { twoFactorEnabled?: boolean }).twoFactorEnabled);
  return (
    <AdminShell title="Güvenlik">
      <p className="mb-4 text-ink-2">İki adımlı doğrulama: {enabled ? "açık" : "kapalı"}</p>
      {!enabled && <TwoFactorSetup />}
      <PasskeyManager />
      <ChangePassword />
    </AdminShell>
  );
}
