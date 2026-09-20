"use client";

/**
 * TZ v1 §10, §17.5 — client-side compression is not optional: an
 * uncompressed phone photo is 4-8 MB, and this MVP has no server-side
 * resizing step at all. Longest side 1024px, JPEG quality 0.7.
 */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const maxSide = 1024;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context olinmadi");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.7),
  );
  if (!blob) throw new Error("rasm siqilmadi");
  return blob;
}
