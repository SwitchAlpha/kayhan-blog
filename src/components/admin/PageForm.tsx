"use client";
import { useState, useTransition } from "react";
import type { JSONContent } from "@tiptap/core";
import { Editor } from "@/components/editor/Editor";
import { savePage } from "@/lib/pages/actions";
import type { PageKey } from "@/lib/db/queries/site";

export function PageForm({ pageKey, locale, initialTitle, initialContent }: { pageKey: PageKey; locale: "tr" | "en"; initialTitle: string; initialContent: JSONContent }) {
  const [title, setTitle] = useState(initialTitle);
  const [doc, setDoc] = useState<JSONContent>(initialContent);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <input className="input !text-[1.4rem] !font-semibold" placeholder="Başlık" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Editor value={doc} onChange={setDoc} />
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}
          onClick={() => start(async () => { setMsg(null); try { await savePage({ key: pageKey, locale, title, contentJson: JSON.parse(JSON.stringify(doc)) }); setMsg("Kaydedildi"); } catch (e) { setMsg(e instanceof Error ? e.message : "Hata"); } })}>
          Kaydet
        </button>
        {msg && <span className="text-[0.85rem] text-ink-2">{msg}</span>}
      </div>
    </div>
  );
}
