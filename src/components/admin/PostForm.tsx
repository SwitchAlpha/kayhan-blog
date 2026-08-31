"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { Editor } from "@/components/editor/Editor";
import { savePost, publishPost, unpublishPost, deleteDraft, type SaveInput } from "@/lib/posts/actions";
import { AiPanel } from "./AiPanel";
import { uploadImage } from "@/components/editor/upload";

type Category = { id: string; nameTr: string };
type Initial = {
  id?: string; locale: "tr" | "en"; title: string; slug: string; summary: string; seoTitle: string | null; seoDescription: string | null;
  categoryId: string; contentJson: JSONContent; status: string; scheduledAt: string | null; tags: string; cover: { id: string; src: string } | null;
};

export function PostForm({ initial, categories }: { initial: Initial; categories: Category[] }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [doc, setDoc] = useState<JSONContent>(initial.contentJson);
  const [substantive, setSubstantive] = useState(true);
  const [scheduleAt, setScheduleAt] = useState(initial.scheduledAt ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = "input";

  const payload = (): SaveInput => ({
    id: state.id, locale: state.locale, title: state.title, slug: state.slug || undefined, summary: state.summary,
    seoTitle: state.seoTitle || null, seoDescription: state.seoDescription || null, categoryId: state.categoryId,
    // ProseMirror attrs use null-prototype objects, which React cannot serialize into a Server Action → deep clone
    contentJson: JSON.parse(JSON.stringify(doc)), substantive, tags: state.tags, coverMediaId: state.cover?.id ?? null,
  });

  const run = (fn: () => Promise<unknown>, ok: string) =>
    start(async () => {
      setMsg(null);
      try { await fn(); setMsg(ok); router.refresh(); } catch (e) { setMsg(e instanceof Error ? e.message : "Hata"); }
    });

  const save = () => run(async () => {
    const r = await savePost(payload());
    if (!state.id) { router.replace(`/admin/posts/${r.id}`); }
    setState((s) => ({ ...s, id: r.id }));
  }, "Kaydedildi");

  const publish = () => run(async () => {
    const r = await savePost(payload());
    setState((s) => ({ ...s, id: r.id }));
    const res = await publishPost(r.id, scheduleAt || null);
    setState((s) => ({ ...s, status: res.status }));
    if (!state.id) router.replace(`/admin/posts/${r.id}`);
  }, scheduleAt ? "Zamanlandı" : "Yayınlandı");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <input className={`${input} !text-[1.6rem] !font-semibold !tracking-tight`} placeholder="Başlık" value={state.title} onChange={(e) => setState({ ...state, title: e.target.value })} />
        <textarea className={input} rows={2} placeholder="Özet (meta description için de kullanılır)" value={state.summary} onChange={(e) => setState({ ...state, summary: e.target.value })} />
        <Editor value={doc} onChange={setDoc} />
      </div>
      <aside className="space-y-4 text-[0.85rem]">
        <div className="card">
          <div className="mb-3 flex items-center justify-between"><span className="label !mb-0">Durum</span><span className={`badge ${state.status === "published" ? "badge-published" : state.status === "scheduled" ? "badge-scheduled" : "badge-draft"}`}>{state.status}</span></div>
          <div className="flex flex-wrap gap-2">
            <button className="btn" disabled={pending} onClick={save}>Kaydet</button>
            {state.status !== "published" && <button className="btn btn-primary" disabled={pending} onClick={publish}>{scheduleAt ? "Zamanla" : "Yayınla"}</button>}
            {state.status === "published" && state.id && <button className="btn" disabled={pending} onClick={() => run(() => unpublishPost(state.id!).then((r) => setState((s) => ({ ...s, status: r.status }))), "Yayından kaldırıldı")}>Yayından kaldır</button>}
            {state.id && state.status !== "published" && <button className="btn btn-danger" disabled={pending} onClick={() => { if (confirm("Taslak silinsin mi?")) start(() => deleteDraft(state.id!)); }}>Sil</button>}
          </div>
          {state.status !== "published" && (
            <label className="label mt-3">Zamanla (isteğe bağlı)
              <input className={input} type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
            </label>
          )}
          {state.status === "published" && (
            <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={substantive} onChange={(e) => setSubstantive(e.target.checked)} /> İçerik güncellemesi (lastmod&apos;u günceller)</label>
          )}
          {msg && <p className="mt-3 text-ink-2">{msg}</p>}
        </div>
        {state.id && <AiPanel localeId={state.id} locale={state.locale} status={state.status} doc={doc} onApplyDoc={setDoc} />}
        <label className="label">Dil
          <select className={input} value={state.locale} disabled={Boolean(state.id)} onChange={(e) => setState({ ...state, locale: e.target.value as "tr" | "en" })}>
            <option value="tr">Türkçe</option><option value="en">English</option>
          </select>
        </label>
        <label className="label">Kategori
          <select className={input} value={state.categoryId} onChange={(e) => setState({ ...state, categoryId: e.target.value })}>
            <option value="auto">Otomatik — içerikten seç</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nameTr}</option>)}
          </select>
        </label>
        <div>
          <div className="label">Kapak görseli <span className="font-normal text-ink-3">(≥1200×675, 16:9 önerilir — Discover/OG)</span></div>
          {state.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <div className="space-y-2"><img src={state.cover.src} alt="" className="aspect-video w-full rounded object-cover" /><button type="button" className="btn btn-sm" onClick={() => setState({ ...state, cover: null })}>Kapağı kaldır</button></div>
          ) : (
            <input type="file" accept="image/*" className="text-[0.8rem]" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const m = await uploadImage(f); setState((s) => ({ ...s, cover: { id: m.id, src: m.src } })); } catch (err) { setMsg(err instanceof Error ? err.message : "Yükleme başarısız"); } }} />
          )}
        </div>
        <label className="label">Etiketler (virgülle)
          <input className={input} placeholder="ör. nextjs, seo" value={state.tags} onChange={(e) => setState({ ...state, tags: e.target.value })} />
        </label>
        <label className="label">Slug
          <input className={input} placeholder="boş bırakılırsa başlıktan üretilir" value={state.slug} onChange={(e) => setState({ ...state, slug: e.target.value })} />
        </label>
        <label className="label">SEO başlığı
          <input className={input} value={state.seoTitle ?? ""} onChange={(e) => setState({ ...state, seoTitle: e.target.value })} />
        </label>
        <label className="label">SEO açıklaması
          <textarea className={input} rows={3} value={state.seoDescription ?? ""} onChange={(e) => setState({ ...state, seoDescription: e.target.value })} />
        </label>
      </aside>
    </div>
  );
}
