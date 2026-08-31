import type { GeoBucket } from "@/lib/geo/bucket";
import { ADSENSE_LOADER } from "@/lib/ads/config";

/**
 * Head scripts for the public site.
 * - Consent Mode v2 defaults (denied) before any Google tag.
 * - AdSense loader is server-rendered ONLY when the regime allows it:
 *   eea/row → yes (Google's own TCF CMP handles EEA); tr → only after explicit KVKK consent.
 * The loader must be a raw <script async> (React 19 hoists it into <head>); next/script would not
 * produce a server-side tag that AdSense's verification crawler can see.
 */
export function ConsentScripts({ bucket, adsAllowed, loaderEnabled }: { bucket: GeoBucket; adsAllowed: boolean; loaderEnabled: boolean }) {
  const consentDefaults = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});window.__kbGeo='${bucket}';`;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: consentDefaults }} />
      {loaderEnabled && adsAllowed && <script async src={ADSENSE_LOADER} crossOrigin="anonymous" />}
    </>
  );
}
