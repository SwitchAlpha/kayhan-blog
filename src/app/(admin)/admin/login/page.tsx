export const dynamic = "force-dynamic";
import { LoginForm } from "@/components/admin/LoginForm";
import { Wordmark } from "@/components/site/Wordmark";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <p className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-3"><Wordmark /></p>
      <h1 className="mb-6 mt-1 text-[1.6rem] font-semibold tracking-tight">Yönetim girişi</h1>
      <LoginForm />
    </main>
  );
}
