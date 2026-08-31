"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "totp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (res.error) return setError(res.error.message ?? "Giriş başarısız");
    const data = res.data as { twoFactorRedirect?: boolean } | null;
    if (data?.twoFactorRedirect) return setStep("totp");
    router.replace("/admin");
  }

  async function onPasskey() {
    setBusy(true); setError(null);
    const res = await authClient.signIn.passkey();
    setBusy(false);
    if (res?.error) return setError(res.error.message ?? "Passkey ile giriş başarısız");
    router.replace("/admin");
  }

  async function onTotp(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
    setBusy(false);
    if (res.error) return setError(res.error.message ?? "Kod doğrulanamadı");
    router.replace("/admin");
  }

  const input = "input";
  const button = "btn btn-primary w-full justify-center";

  if (step === "totp") {
    return (
      <form onSubmit={onTotp} className="space-y-3">
        <label className="label">Doğrulama kodu (TOTP)
          <input className={input} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className={button} disabled={busy}>Doğrula</button>
      </form>
    );
  }
  return (
    <form onSubmit={onPassword} className="space-y-3">
      <label className="label">E-posta
        <input className={input} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="label">Şifre
        <input className={input} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className={button} disabled={busy}>Giriş yap</button>
      <button type="button" className="btn w-full justify-center" disabled={busy} onClick={onPasskey}>Passkey ile giriş</button>
    </form>
  );
}
