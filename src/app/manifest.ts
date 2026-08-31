import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_SHORT_NAME } from "@/lib/site/config";

// The image is built without the runtime .env, so prerendering this at build
// time baked the default name into every deployment's manifest.
export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  return { name: SITE_NAME, short_name: SITE_SHORT_NAME, start_url: "/", display: "minimal-ui", background_color: "#ffffff", theme_color: "#18181b", icons: [{ src: "/favicon.ico", sizes: "any" }] };
}
