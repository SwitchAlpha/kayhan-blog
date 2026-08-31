import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 py-16 md:px-0">
      <p className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-3">404</p>
      <h1 className="mt-2 font-display text-[2rem] font-semibold tracking-tight">Bu sayfa yok</h1>
      <p className="mt-3 text-ink-2">Aradığın yazı taşınmış ya da hiç yazılmamış olabilir. <Link className="link" href="/">Günlüğe dön</Link> · <Link className="link" href="/arama">Ara</Link></p>
    </main>
  );
}
