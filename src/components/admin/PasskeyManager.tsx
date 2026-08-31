"use client";
import { useEffect, useState, useTransition } from "react";
import { authClient } from "@/lib/auth/client";

type Passkey = { id: string; name?: string | null; createdAt?: Date | string; deviceType?: string };

export function PasskeyManager() {
  const [items, setItems] = useState<Passkey[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const load = async () => { const r = await authClient.passkey.listUserPasskeys(); setItems((r.data as Passkey[] | null) ?? []); };
  const [supported, setSupported] = useState(true);
  useEffect(() => { const t = setTimeout(() => { setSupported("PublicKeyCredential" in window); void load(); }, 0); return () => clearTimeout(t); }, []);
  return (
    <div className="card mt-6 max-w-xl text-[0.9rem]">
      <div className="label">Passkey&apos;ler (Touch ID / Face ID / güvenlik anahtarı)</div>
      {!supported && <p className="text-ink-3">Bu tarayıcı WebAuthn desteklemiyor.</p>}
      <ul className="mt-2 space-y-1">
        {items.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3">
            <span>{p.name || "Adsız passkey"} <span className="text-ink-3">· {p.deviceType ?? ""} · {p.createdAt ? new Date(p.createdAt).toLocaleDateString("tr-TR") : ""}</span></span>
            <button className="btn btn-sm btn-danger" disabled={pending} onClick={() => start(async () => { const r = await authClient.passkey.deletePasskey({ id: p.id }); setMsg(r.error ? (r.error.message ?? "Silinemedi") : "Passkey silindi"); await load(); })}>Sil</button>
          </li>
        ))}
        {items.length === 0 && <li className="text-ink-3">Henüz passkey yok.</li>}
      </ul>
      <div className="mt-4 flex gap-2">
        <input className="input" placeholder="Cihaz adı (ör. MacBook)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary whitespace-nowrap" disabled={pending || !supported} onClick={() => start(async () => {
          setMsg(null);
          const r = await authClient.passkey.addPasskey({ name: name || undefined });
          setMsg(r?.error ? (r.error.message ?? "Eklenemedi") : "Passkey eklendi");
          setName(""); await load();
        })}>Passkey ekle</button>
      </div>
      {msg && <p className="mt-2 text-ink-2">{msg}</p>}
    </div>
  );
}
