"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { JSONContent } from "@tiptap/core";
import { createEnglishDraft, enhancePostText, getPostAiPanel, revertAiLink, runLinkerNow, runSeoReview } from "@/lib/ai/actions";

type Panel = Awaited<ReturnType<typeof getPostAiPanel>>;
type Check = { id: string; level: "error" | "warn" | "ok"; message: string };

export function AiPanel({
  localeId,
  locale,
  status,
  doc,
  onApplyDoc,
}: {
  localeId: string;
  locale: "tr" | "en";
  status: string;
  /** The editor's current content — enhanced text is proposed from what is on
   *  screen, not from the last save, so unsaved edits are never discarded. */
  doc: JSONContent;
  onApplyDoc: (next: JSONContent) => void;
}) {
  const [data, setData] = useState<Panel | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  /** The proposal awaiting a decision, and the document it would replace. */
  const [enhanced, setEnhanced] = useState<{ doc: JSONContent; notes: string[] } | null>(null);
  const [beforeEnhance, setBeforeEnhance] = useState<JSONContent | null>(null);
  const reload = () => getPostAiPanel(localeId).then(setData).catch(() => {});
  useEffect(() => { void reload(); }, [localeId]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = (fn: () => Promise<unknown>, ok: string) => start(async () => { setMsg(null); try { await fn(); setMsg(ok); await reload(); } catch (e) { setMsg(e instanceof Error ? e.message : "Hata"); } });
  const btn = "btn btn-sm";
  const det = (data?.review?.deterministic as Check[] | undefined) ?? [];
  const llm = data?.review?.llm as null | { title: { issues: string[]; suggestions: string[] }; description: { suggestions: string[] }; outline: { issues: string[]; suggested: string[] }; coverage: { search_intent: string; missing_subtopics: string[] }; eeat_notes: string[]; risk_flags: string[]; clickbait_risk: string };
  return (
    <div className="card text-[0.85rem]">
      <div className="mb-2 flex flex-wrap gap-2">
        <button className={btn} disabled={pending} onClick={() => run(() => runSeoReview(localeId), "SEO incelemesi tamamlandı")}>SEO incelemesi</button>
        {status === "published" && <button className={btn} disabled={pending} onClick={() => run(() => runLinkerNow(localeId), "Linkleme çalıştı")}>İç linkleri şimdi üret</button>}
        {locale === "tr" && <button className={btn} disabled={pending} onClick={() => run(() => createEnglishDraft(localeId), "EN taslağı oluşturuldu (Yazılar listesinde)")}>Çeviri taslağı (EN)</button>}
        <button
          className={btn}
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMsg(null);
              try {
                setEnhanced(await enhancePostText(locale, JSON.parse(JSON.stringify(doc))));
              } catch (e) {
                setMsg(e instanceof Error ? e.message : "Hata");
              }
            })
          }
        >
          Metni iyileştir (AI)
        </button>
        {beforeEnhance && (
          <button
            className={btn}
            onClick={() => { onApplyDoc(beforeEnhance); setBeforeEnhance(null); setMsg("Önceki metin geri alındı"); }}
          >
            Geri al
          </button>
        )}
      </div>

      {enhanced && (
        <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-2">
          <div className="label !mb-1">Önerilen düzenleme</div>
          {enhanced.notes.length > 0 && (
            <ul className="mb-2 list-disc pl-4 text-xs text-zinc-700">
              {enhanced.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          <p className="mb-2 text-xs text-zinc-600">
            Uygulamak metni editörde değiştirir. Kaydetmediğin sürece kalıcı olmaz; “Geri al” ile eski haline dönebilirsin.
          </p>
          <div className="flex gap-2">
            <button
              className={btn}
              onClick={() => { setBeforeEnhance(doc); onApplyDoc(enhanced.doc); setEnhanced(null); setMsg("Uygulandı — kaydetmeyi unutma"); }}
            >
              Uygula
            </button>
            <button className={btn} onClick={() => setEnhanced(null)}>Vazgeç</button>
          </div>
        </div>
      )}
      {msg && <p className="mb-2 text-ink-2">{msg}</p>}
      {data?.review && (
        <div className="space-y-2">
          <div className="label !mb-0">SEO skoru: {data.review.score ?? "-"}/100 <span className="text-xs text-zinc-500">({new Date(data.review.createdAt).toLocaleString("tr-TR")})</span></div>
          <ul className="space-y-0.5">
            {det.map((c) => <li key={c.id} className={c.level === "error" ? "text-red-700" : c.level === "warn" ? "text-amber-700" : "text-ink-2"}>{c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✕"} {c.message}</li>)}
          </ul>
          {llm && (
            <details className="mt-2"><summary className="cursor-pointer">AI önerileri</summary>
              <div className="mt-1 space-y-1 text-xs text-zinc-700">
                <div><b>Arama niyeti:</b> {llm.coverage.search_intent}</div>
                <div><b>Başlık önerileri:</b> {llm.title.suggestions.join(" · ")}</div>
                <div><b>Açıklama önerileri:</b> {llm.description.suggestions.join(" · ")}</div>
                {llm.outline.issues.length > 0 && <div><b>Yapı:</b> {llm.outline.issues.join(" · ")}</div>}
                {llm.coverage.missing_subtopics.length > 0 && <div><b>Eksik alt konular:</b> {llm.coverage.missing_subtopics.join(" · ")}</div>}
                {llm.eeat_notes.length > 0 && <div><b>E-E-A-T:</b> {llm.eeat_notes.join(" · ")}</div>}
                {llm.risk_flags.length > 0 && <div className="text-red-700"><b>Riskler:</b> {llm.risk_flags.join(" · ")}</div>}
                <div><b>Clickbait riski:</b> {llm.clickbait_risk}</div>
              </div>
            </details>
          )}
        </div>
      )}
      {data && (
        <div className="mt-3">
          <div className="label">İç bağlantılar ({data.links.length})</div>
          <ul className="mt-1 space-y-1">
            {data.links.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2">
                <span>“{l.anchor}” → <Link className="underline" href={`/${l.targetSlug}`} target="_blank">{l.targetTitle}</Link> <span className="text-xs text-zinc-500">({l.createdBy}, ¶{l.paragraph})</span></span>
                {l.createdBy === "ai" && <button className={btn} disabled={pending} onClick={() => run(() => revertAiLink(localeId, l.aiLinkId), "Bağlantı geri alındı")}>Geri al</button>}
              </li>
            ))}
          </ul>
          {data.links.some((l) => l.createdBy === "ai") && <button className={`${btn} mt-2`} disabled={pending} onClick={() => run(() => revertAiLink(localeId, null), "Tüm AI bağlantıları geri alındı")}>Tüm AI bağlantılarını geri al</button>}
          {data.rejected.length > 0 && (
            <details className="mt-2 text-xs text-zinc-500"><summary className="cursor-pointer">Reddedilen öneriler ({data.rejected.length})</summary>
              <ul>{data.rejected.map((r, i) => <li key={i}>“{r.anchor}” → {r.targetTitle}: {r.reason}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
