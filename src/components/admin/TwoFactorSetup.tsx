"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function TwoFactorSetup() {
  const [password, setPassword] = useState("");
  const [uri, setUri] = useState<string | null>(null);
  const [backup, setBackup] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function enable() {
    setMsg(null);
    const res = await authClient.twoFactor.enable({ password });
    if (res.error) return setMsg(res.error.message ?? "Hata");
    if (res.data.method !== "totp") return setMsg("TOTP kurulumu beklenmedik yanıt döndürdü");
    setUri(res.data.totpURI);
    setBackup(res.data.backupCodes);
  }
  async function verify() {
    const res = await authClient.twoFactor.verifyTotp({ code });
    setMsg(res.error ? (res.error.message ?? "Kod hatalı") : "2FA etkinleştirildi. Sayfayı yenileyin.");
  }
  const input = "input";
  return (
    <div className="card mt-2 max-w-xl space-y-4 text-[0.9rem]">
      {!uri ? (
        <>
          <label className="label">Şifreni doğrula
            <input className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn btn-primary" onClick={enable}>2FA&apos;yı başlat</button>
        </>
      ) : (
        <>
          <p>Bu URI&apos;yi kimlik doğrulayıcı uygulamana ekle (QR üretmek için kopyala):</p>
          <code className="block break-all rounded-md bg-paper-2 p-2 font-mono text-[0.72rem]">{uri}</code>
          <p>Yedek kodlar (güvenli bir yere kaydet):</p>
          <code className="block whitespace-pre rounded-md bg-paper-2 p-2 font-mono text-[0.72rem]">{backup.join("\n")}</code>
          <label className="label">Uygulamadaki kodu gir
            <input className={input} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button className="btn btn-primary" onClick={verify}>Doğrula ve etkinleştir</button>
        </>
      )}
      {msg && <p className="text-zinc-700">{msg}</p>}
    </div>
  );
}
