import { NextResponse, type NextRequest } from "next/server";
import { geoBucket } from "@/lib/geo/bucket";

/**
 * Public-URL → internal-route rewrite (TR at root, EN under /en/), geo bucket derivation,
 * and an optimistic cookie check for /admin. Real auth happens in requireAdmin().
 */
const TR_SEGMENTS: Record<string, string> = {
  kategori: "k", etiket: "t", arama: "s", sayfa: "p",
  hakkimda: "pg/about", iletisim: "pg/contact",
  "gizlilik-politikasi": "pg/privacy", "cerez-politikasi": "pg/cookies", "bu-blog-nasil-yaziliyor": "pg/disclosure",
};
const EN_SEGMENTS: Record<string, string> = {
  category: "k", tag: "t", search: "s", page: "p",
  about: "pg/about", contact: "pg/contact",
  "privacy-policy": "pg/privacy", "cookie-policy": "pg/cookies", "how-this-blog-is-written": "pg/disclosure",
};

function translate(rest: string, table: Record<string, string>): string {
  // rest: '' | '/foo' | '/kategori/x/sayfa/2'
  if (rest === "" || rest === "/") return "";
  const parts = rest.split("/").filter(Boolean);
  const out: string[] = [];
  for (const p of parts) out.push(table[p] ?? p);
  return "/" + out.join("/");
}

export function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // IndexNow key file: /<INDEXNOW_KEY>.txt (public ownership token, not a secret)
  const indexnowKey = process.env.INDEXNOW_KEY;
  if (indexnowKey && path === `/${indexnowKey}.txt`) {
    return new NextResponse(indexnowKey, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
  }

  // Admin: optimistic cookie presence check only.
  if (path.startsWith("/admin")) {
    if (path !== "/admin/login" && !req.cookies.get("better-auth.session_token") && !req.cookies.get("__Secure-better-auth.session_token")) {
      return NextResponse.redirect(new URL("/admin/login", url));
    }
    return NextResponse.next();
  }

  // Trailing slash → canonical (308 keeps method)
  if (path.length > 1 && path.endsWith("/")) {
    return NextResponse.redirect(new URL(path.slice(0, -1) + url.search, url), 308);
  }
  // Internal locale paths are never public
  if (path === "/tr" || path.startsWith("/tr/")) return new NextResponse(null, { status: 404 });

  const locale = path === "/en" || path.startsWith("/en/") ? "en" : "tr";
  const rest = locale === "en" ? path.slice(3) : path;
  const internal = translate(rest, locale === "en" ? EN_SEGMENTS : TR_SEGMENTS);

  const override = process.env.GEO_OVERRIDE_ENABLED === "1" ? url.searchParams.get("geo") : null;
  const country = override ?? req.headers.get("cf-ipcountry");
  const bucket = geoBucket(country);

  const headers = new Headers(req.headers);
  headers.set("x-geo-bucket", bucket);
  headers.set("x-locale", locale);
  return NextResponse.rewrite(new URL(`/${locale}${internal}${url.search}`, url), { request: { headers } });
}

export const config = {
  matcher: [
    // everything except static files, API, metadata routes and well-known files
    "/((?!_next/|api/|health$|uploads/|og/|llms/|llms\\.txt|llms-full\\.txt|favicon\\.ico|robots\\.txt|sitemap\\.xml|ads\\.txt|manifest\\.webmanifest|feed\\.xml|en/feed\\.xml|.*\\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$).*)",
  ],
};
