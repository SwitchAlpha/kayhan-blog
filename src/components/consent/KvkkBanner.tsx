"use client";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/db/schema";
import { CONSENT_COOKIE, CONSENT_ID_COOKIE, CONSENT_TTL_DAYS, consentDecided, serializeConsent } from "@/lib/consent/config";
import { ADSENSE_LOADER } from "@/lib/ads/config";

const T = {
  tr: {
    text: "Bu sitede reklam göstermek için Google AdSense çerezleri kullanılır. Reklam çerezleri yalnızca izin verirseniz yüklenir; veriler Google LLC (ABD) ile paylaşılır ve yurt dışına aktarılır.",
    accept: "Kabul et", reject: "Reddet", prefs: "Tercihler", save: "Kaydet", required: "Zorunlu çerezler (her zaman açık)", ads: "Reklam çerezleri (Google AdSense)", policy: "Çerez Aydınlatma Metni", privacy: "Gizlilik Politikası",
    hrefPolicy: "/cerez-politikasi", hrefPrivacy: "/gizlilik-politikasi",
  },
  en: {
    text: "This site uses Google AdSense cookies to show ads. Advertising cookies load only with your consent; data is shared with Google LLC (USA).",
    accept: "Accept", reject: "Reject", prefs: "Preferences", save: "Save", required: "Required cookies (always on)", ads: "Advertising cookies (Google AdSense)", policy: "Cookie policy", privacy: "Privacy policy",
    hrefPolicy: "/en/cookie-policy", hrefPrivacy: "/en/privacy-policy",
  },
};

function readCookie(name: string) {
  return document.cookie.split("; ").find((c) => c.startsWith(name + "="))?.split("=")[1];
}
function writeCookie(name: string, value: string, days: number) {
  document.cookie = `${name}=${value}; Max-Age=${days * 86400}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}
function loadAdsense(loader: string) {
  if (!loader || document.querySelector(`script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]`)) return;
  const s = document.createElement("script");
  s.async = true; s.src = loader; s.crossOrigin = "anonymous";
  document.head.appendChild(s);
}

/** KVKK-compliant banner for TR/unknown visitors: equal-weight buttons, off by default, withdrawable via footer link. */
export function KvkkBanner({ locale, loaderEnabled, showInitially }: { locale: Locale; loaderEnabled: boolean; showInitially: boolean }) {
  const loader = loaderEnabled ? ADSENSE_LOADER : ""; // NEXT_PUBLIC_ var is inlined client-side; never serialized into the HTML
  const t = T[locale];
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(false);
  const [ads, setAds] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(showInitially && !consentDecided(readCookie(CONSENT_COOKIE))));
    const handler = () => { setOpen(true); setPrefs(true); };
    document.querySelectorAll("[data-consent-open]").forEach((el) => el.addEventListener("click", handler));
    return () => { cancelAnimationFrame(raf); document.querySelectorAll("[data-consent-open]").forEach((el) => el.removeEventListener("click", handler)); };
  }, [showInitially]);

  async function decide(granted: boolean) {
    writeCookie(CONSENT_COOKIE, serializeConsent(granted), CONSENT_TTL_DAYS);
    let cid = readCookie(CONSENT_ID_COOKIE);
    if (!cid) { cid = crypto.randomUUID(); writeCookie(CONSENT_ID_COOKIE, cid, CONSENT_TTL_DAYS); }
    const g = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    g?.("consent", "update", { ad_storage: granted ? "granted" : "denied", ad_user_data: granted ? "granted" : "denied", ad_personalization: granted ? "granted" : "denied" });
    if (granted) loadAdsense(loader);
    window.dispatchEvent(new CustomEvent("kb:consent", { detail: { ads: granted } }));
    setOpen(false);
    void fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consentId: cid, choice: granted ? "granted" : "denied", categories: granted ? ["ads"] : [] }), keepalive: true }).catch(() => {});
  }

  if (!open) return null;
  const btn = "btn"; // equal weight for all three (KVKK)
  return (
    <div role="dialog" aria-modal="false" aria-label={t.policy} className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-paper-2 p-4 font-display text-[0.9rem] text-ink shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
      <div className="mx-auto max-w-[720px]">
        <p>{t.text} <a className="link" href={t.hrefPolicy}>{t.policy}</a> · <a className="link" href={t.hrefPrivacy}>{t.privacy}</a></p>
        {prefs && (
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked disabled /> {t.required}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={ads} onChange={(e) => setAds(e.target.checked)} /> {t.ads}</label>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {prefs ? (
            <button className={btn} onClick={() => decide(ads)}>{t.save}</button>
          ) : (
            <>
              <button className={btn} onClick={() => decide(true)}>{t.accept}</button>
              <button className={btn} onClick={() => decide(false)}>{t.reject}</button>
              <button className={btn} onClick={() => setPrefs(true)}>{t.prefs}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
