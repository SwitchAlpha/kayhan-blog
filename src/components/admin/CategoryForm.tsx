"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCategory } from "@/lib/posts/actions";

export function CategoryForm() {
  const router = useRouter();
  const [nameTr, setTr] = useState(""); const [nameEn, setEn] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-wrap items-end gap-2 text-[0.85rem]" onSubmit={(e) => { e.preventDefault(); start(async () => { await createCategory({ nameTr, nameEn }); setTr(""); setEn(""); router.refresh(); }); }}>
      <label className="label !mb-0">Kategori (TR)<input className="input mt-1 !w-44" value={nameTr} onChange={(e) => setTr(e.target.value)} required /></label>
      <label className="label !mb-0">Category (EN)<input className="input mt-1 !w-44" value={nameEn} onChange={(e) => setEn(e.target.value)} required /></label>
      <button className="btn" disabled={pending}>Kategori ekle</button>
    </form>
  );
}
