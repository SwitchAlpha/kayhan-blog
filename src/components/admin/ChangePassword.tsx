"use client";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth/client";

export function ChangePassword() {
  const [cur, setCur] = useState(""); const [next, setNext] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="card mt-6 max-w-xl space-y-3 text-[0.9rem]" onSubmit={(e) => { e.preventDefault(); start(async () => {
      setMsg(null);
      if (next.length < 12) return setMsg("Yeni şifre en az 12 karakter olmalı");
      const r = await authClient.changePassword({ currentPassword: cur, newPassword: next, revokeOtherSessions: true });
      setMsg(r.error ? (r.error.message ?? "Değiştirilemedi") : "Şifre değiştirildi; diğer oturumlar kapatıldı");
      if (!r.error) { setCur(""); setNext(""); }
    }); }}>
      <div className="label">Şifre değiştir</div>
      <label className="label">Mevcut şifre<input className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></label>
      <label className="label">Yeni şifre (≥12 karakter)<input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></label>
      <button className="btn btn-primary" disabled={pending}>Şifreyi değiştir</button>
      {msg && <p className="text-ink-2">{msg}</p>}
    </form>
  );
}
