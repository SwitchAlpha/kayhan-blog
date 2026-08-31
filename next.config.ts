import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const siteHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, // required by Google's CMP
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Accel-Buffering", value: "no" }, // RSC streaming behind nginx
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const adminHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "no-store" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Variants are pre-generated with sharp at upload time; the optimizer is disabled and /_next/image is blocked at the proxy.
  images: { unoptimized: true, qualities: [75] },
  outputFileTracingIncludes: { "/*": ["./drizzle/**", "./public/fonts/**"] },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    taint: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: siteHeaders },
      { source: "/admin/:path*", headers: adminHeaders },
      { source: "/admin", headers: adminHeaders },
    ];
  },
};

export default nextConfig;
