"use client";
import imageCompression from "browser-image-compression";

export type UploadedMedia = { id: string; src: string; srcset: string; width: number; height: number; blurDataUrl: string | null };

export async function uploadImage(file: File): Promise<UploadedMedia> {
  const compressed = file.type === "image/gif" ? file : await imageCompression(file, { maxWidthOrHeight: 2000, initialQuality: 0.85, useWebWorker: true, maxSizeMB: 8 });
  const fd = new FormData();
  fd.append("file", compressed, file.name);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Yükleme başarısız");
  return json as UploadedMedia;
}
