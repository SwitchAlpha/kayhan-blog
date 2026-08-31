import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "@/app/globals.css";
import { SITE_NAME } from "@/lib/site/config";

const display = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono", display: "swap", weight: ["400", "600"] });

export const metadata: Metadata = { title: `Yönetim | ${SITE_NAME}`, robots: { index: false, follow: false } };

export default function AdminRootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${display.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-paper-2 font-display text-[0.95rem] text-ink">{children}</body>
    </html>
  );
}
