import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { Bricolage_Grotesque, JetBrains_Mono, Literata } from "next/font/google";
import "@/app/globals.css";
import type { GeoBucket } from "@/lib/geo/bucket";
import type { Locale } from "@/lib/db/schema";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { ConsentScripts } from "@/components/consent/ConsentScripts";
import { KvkkBanner } from "@/components/consent/KvkkBanner";
import { ADS_ENABLED, ADSENSE_CLIENT } from "@/lib/ads/config";
import { CONSENT_COOKIE, consentGranted } from "@/lib/consent/config";
import { SITE_NAME } from "@/lib/site/config";

const display = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], variable: "--font-display", display: "swap" });
const body = Literata({ subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono", display: "swap", weight: ["400", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  ...(ADSENSE_CLIENT ? { other: { "google-adsense-account": ADSENSE_CLIENT } } : {}),
  alternates: { types: { "application/rss+xml": [{ url: "/feed.xml", title: `${SITE_NAME} (TR)` }, { url: "/en/feed.xml", title: `${SITE_NAME} (EN)` }] } },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

export default async function SiteLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (locale !== "tr" && locale !== "en") notFound();
  const h = await headers();
  const bucket = (h.get("x-geo-bucket") ?? "row") as GeoBucket;
  const consent = (await cookies()).get(CONSENT_COOKIE)?.value;
  // eea → Google's certified CMP inside adsbygoogle.js; row → load; tr/unknown → only after KVKK opt-in
  const adsAllowed = bucket === "eea" || bucket === "row" || consentGranted(consent);
  return (
    <html lang={locale} className={`${display.variable} ${body.variable} ${mono.variable}`} data-geo={bucket} data-ads={adsAllowed ? "on" : "off"}>
      <head>
        <ConsentScripts bucket={bucket} adsAllowed={adsAllowed} loaderEnabled={ADS_ENABLED} />
      </head>
      <body className="min-h-screen">
        <SiteHeader locale={locale as Locale} />
        {children}
        <SiteFooter locale={locale as Locale} />
        <KvkkBanner locale={locale as Locale} loaderEnabled={ADS_ENABLED} showInitially={bucket === "tr"} />
      </body>
    </html>
  );
}
