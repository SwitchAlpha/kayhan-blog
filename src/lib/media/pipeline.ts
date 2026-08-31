import "server-only";
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { media } from "@/lib/db/schema";

export const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR ?? "./data/uploads");
export const VARIANT_WIDTHS = [480, 800, 1200, 1600, 2000] as const;
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export type StoredMedia = { id: string; variants: { w: number; key: string; bytes: number }[]; width: number; height: number; blurDataUrl: string | null; src: string; srcset: string };

function safeJoin(base: string, key: string): string {
  const p = path.resolve(base, key);
  if (!p.startsWith(base + path.sep)) throw new Error("bad path");
  return p;
}

/** Public base for media (CDN host). Falls back to same-origin /uploads. */
export const MEDIA_PUBLIC_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE ?? "").replace(/\/$/, "");
export function variantUrl(key: string): string {
  return `${MEDIA_PUBLIC_BASE}/uploads/${key}`;
}

export function srcsetFor(variants: { w: number; key: string }[]): string {
  return variants.map((v) => `${variantUrl(v.key)} ${v.w}w`).join(", ");
}

/** Validate, re-encode to WebP variants, store on disk, upsert the media row. Idempotent by sha256. */
export async function storeUpload(input: Buffer): Promise<StoredMedia> {
  if (input.byteLength > MAX_BYTES) throw new Error("Dosya 15 MB sınırını aşıyor");
  const ft = await fileTypeFromBuffer(input);
  if (!ft || !ALLOWED.has(ft.mime)) throw new Error("Desteklenmeyen dosya türü (jpeg/png/webp/gif/avif)");
  const sha = createHash("sha256").update(input).digest("hex");

  const existing = await db.query.media.findFirst({ where: eq(media.sha256, sha) });
  if (existing) return toStored(existing);

  const image = sharp(input, { failOn: "error", animated: false }).rotate();
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error("Görsel boyutu okunamadı");
  if (meta.width > 8192 || meta.height > 8192) throw new Error("Görsel çok büyük (maks 8192 px)");

  const year = String(new Date().getFullYear());
  await mkdir(path.join(UPLOADS_DIR, year), { recursive: true });
  const variants: { w: number; key: string; bytes: number }[] = [];
  for (const w of VARIANT_WIDTHS) {
    if (w > meta.width && variants.length > 0) break; // never upscale; keep at least one variant
    const width = Math.min(w, meta.width);
    const key = `${year}/${sha}-${width}.webp`;
    const buf = await sharp(input).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
    await writeFile(safeJoin(UPLOADS_DIR, key), buf);
    variants.push({ w: width, key, bytes: buf.byteLength });
    if (width < w) break;
  }
  const originalKey = `${year}/${sha}-o.${ft.ext}`;
  await writeFile(safeJoin(UPLOADS_DIR, originalKey), input);
  const blur = await sharp(input).rotate().resize({ width: 20 }).webp({ quality: 40 }).toBuffer();
  const blurDataUrl = `data:image/webp;base64,${blur.toString("base64")}`;

  const [row] = await db
    .insert(media)
    .values({ sha256: sha, mime: ft.mime, width: meta.width, height: meta.height, bytes: input.byteLength, originalKey, variants, blurDataUrl })
    .returning();
  return toStored(row);
}

function toStored(row: typeof media.$inferSelect): StoredMedia {
  const largest = row.variants[row.variants.length - 1];
  return { id: row.id, variants: row.variants, width: row.width, height: row.height, blurDataUrl: row.blurDataUrl, src: variantUrl(largest.key), srcset: srcsetFor(row.variants) };
}

/** Read a variant for the /uploads route. Only pre-generated .webp variants are served (never originals). */
export async function readVariant(key: string): Promise<{ body: Buffer; size: number } | null> {
  if (!/^\d{4}\/[a-f0-9]{64}-\d{2,4}\.webp$/.test(key)) return null;
  const p = safeJoin(UPLOADS_DIR, key);
  try {
    const s = await stat(p);
    return { body: await readFile(p), size: s.size };
  } catch {
    return null;
  }
}
