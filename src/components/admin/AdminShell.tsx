import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { SignOutButton } from "./SignOutButton";
import { AdminNav } from "./AdminNav";
import { Wordmark } from "@/components/site/Wordmark";

export async function AdminShell({ title, actions, children, wide = false }: { title: string; actions?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  const user = await requireAdmin();
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-rule bg-paper px-3 py-5 md:block">
        <Link href="/admin" className="block px-2 text-[1.05rem] font-semibold tracking-tight"><Wordmark /></Link>
        <p className="mt-0.5 px-2 font-mono text-[0.65rem] uppercase tracking-wider text-ink-3">yönetim</p>
        <nav className="admin-nav mt-6 space-y-0.5"><AdminNav /></nav>
        <div className="mt-8 border-t border-rule px-2 pt-4 text-[0.8rem] text-ink-3">
          <div className="truncate">{user.email}</div>
          <div className="mt-2"><SignOutButton /></div>
          <Link href="/" target="_blank" className="mt-3 block text-ink-2 hover:text-ink">Siteyi aç ↗</Link>
        </div>
      </aside>
      <div className={`min-w-0 flex-1 px-5 py-6 md:px-8 ${wide ? "" : "max-w-6xl"}`}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[1.5rem] font-semibold tracking-tight">{title}</h1>
          <div className="flex gap-2">{actions}</div>
        </div>
        {children}
      </div>
    </div>
  );
}
