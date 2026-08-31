"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ADSENSE_CLIENT } from "@/lib/ads/config";

type Props = { slot: string; variant?: "in-article" | "end" | "list"; initiallyAllowed: boolean };

/**
 * Reserved-height ad container (CLS-safe). Pushes exactly once per mount; remounts on navigation via key.
 * When ads are not allowed (TR before consent, dev, no client) the box keeps its height and stays empty.
 */
export function AdUnit({ slot, variant = "in-article", initiallyAllowed }: Props) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(initiallyAllowed);
  const ins = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent<{ ads: boolean }>).detail?.ads) setAllowed(true); };
    window.addEventListener("kb:consent", on);
    return () => window.removeEventListener("kb:consent", on);
  }, []);

  useEffect(() => {
    if (!allowed || !slot || !ADSENSE_CLIENT || pushed.current) return;
    const el = ins.current;
    if (!el || el.getAttribute("data-adsbygoogle-status")) return;
    pushed.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch { /* ignore */ }
  }, [allowed, slot]);

  const minH = variant === "end" ? "min-h-[90px] md:min-h-[250px]" : variant === "list" ? "min-h-[250px]" : "min-h-[280px] md:min-h-[250px]";
  return (
    <div className={`ad-slot my-8 ${minH}`} aria-hidden={!allowed}>
      {allowed && slot && ADSENSE_CLIENT && (
        <ins key={`${slot}-${pathname}`} ref={ins} className="adsbygoogle" style={{ display: "block" }} data-ad-client={ADSENSE_CLIENT} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
      )}
    </div>
  );
}
