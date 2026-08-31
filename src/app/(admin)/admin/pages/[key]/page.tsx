export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";
import { AdminShell } from "@/components/admin/AdminShell";
import { db } from "@/lib/db/client";
import { pages } from "@/lib/db/schema";
import { PAGE_KEYS, type PageKey } from "@/lib/db/queries/site";
import { PageForm } from "@/components/admin/PageForm";

export default async function EditPage({ params, searchParams }: PageProps<"/admin/pages/[key]">) {
  const { key } = await params;
  const sp = await searchParams;
  const locale = sp.locale === "en" ? "en" : "tr";
  if (!(PAGE_KEYS as readonly string[]).includes(key)) notFound();
  const row = await db.query.pages.findFirst({ where: and(eq(pages.key, key), eq(pages.locale, locale)) });
  return (
    <AdminShell title={`Sayfa: ${key} (${locale})`} wide>
      <PageForm pageKey={key as PageKey} locale={locale} initialTitle={row?.title ?? ""} initialContent={(row?.contentJson as JSONContent) ?? { type: "doc", content: [{ type: "paragraph" }] }} />
    </AdminShell>
  );
}
