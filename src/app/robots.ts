import type { MetadataRoute } from "next";
import { absolute } from "@/lib/seo/routes";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/arama", "/en/search", "/*?q=", "/tr/"] },
      { userAgent: ["Mediapartners-Google", "AdsBot-Google"], allow: "/" }, // AdSense crawlers ignore the '*' group
    ],
    sitemap: absolute("/sitemap.xml"),
  };
}
