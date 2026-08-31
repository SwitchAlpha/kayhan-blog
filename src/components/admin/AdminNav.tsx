"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin/posts", label: "Yazılar" },
  { href: "/admin/pages", label: "Sabit sayfalar" },
  { href: "/admin/links", label: "İç bağlantılar" },
  { href: "/admin/indexnow", label: "IndexNow" },
  { href: "/admin/jobs", label: "İşler" },
  { href: "/admin/security", label: "Güvenlik" },
];

export function AdminNav() {
  const path = usePathname();
  return <>{ITEMS.map((i) => <Link key={i.href} href={i.href} aria-current={path.startsWith(i.href) ? "page" : undefined}>{i.label}</Link>)}</>;
}
