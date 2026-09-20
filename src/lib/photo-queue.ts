"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * TZ v1 §10 — the upload retry queue, kept in `localStorage` as base64
 * data URLs. Not IndexedDB, not a service worker: both are explicitly
 * out of scope (§16). A compressed photo is ~100-150KB, which becomes
 * ~150-200KB as base64 — comfortably inside localStorage's ~5-10MB quota
 * even with several queued at once.
 *
 * This is deliberately NOT offline-first: the queue only drains while
 * the tab is open and JS is running. If the teacher closes the tab
 * mid-retry, the photo stays queued in localStorage and resumes next
 * time /yoqlama loads — but nothing pushes it in the background.
 */
export interface QueuedPhoto {
  attendanceId: string;
  childId: string;
  kindergartenId: string;
  day: string;
  dataUrl: string;
  attempts: number;
  status: "queued" | "uploading" | "failed";
}

const KEY = "mitti:photo-queue:v1";
const BACKOFF_MS = [5000, 15000, 60000];
const MAX_ATTEMPTS = 3;

function load(): QueuedPhoto[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedPhoto[]) : [];
  } catch {
    return [];
  }
}

function save(items: QueuedPhoto[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (err) {
    console.error("photo_queue_save_failed", err);
  }
}

export function getQueue(): QueuedPhoto[] {
  return load();
}

export function enqueuePhoto(item: Omit<QueuedPhoto, "attempts" | "status">) {
  const items = load();
  items.push({ ...item, attempts: 0, status: "queued" });
  save(items);
}

function updateItem(attendanceId: string, patch: Partial<QueuedPhoto>) {
  const items = load().map((i) => (i.attendanceId === attendanceId ? { ...i, ...patch } : i));
  save(items);
}

function removeItem(attendanceId: string) {
  save(load().filter((i) => i.attendanceId !== attendanceId));
}

async function uploadOne(item: QueuedPhoto): Promise<boolean> {
  updateItem(item.attendanceId, { status: "uploading" });

  try {
    const res = await fetch(item.dataUrl);
    const blob = await res.blob();

    const supabase = createClient();
    const path = `${item.kindergartenId}/${item.day}/${item.childId}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("attendance-photos")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw uploadError;

    const apiRes = await fetch("/api/attendance/photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendance_id: item.attendanceId, storage_path: path }),
    });
    if (!apiRes.ok) throw new Error(`photo route ${apiRes.status}`);

    removeItem(item.attendanceId);
    return true;
  } catch (err) {
    console.error("photo_upload_failed", err);
    const attempts = item.attempts + 1;
    updateItem(item.attendanceId, {
      attempts,
      status: attempts >= MAX_ATTEMPTS ? "failed" : "queued",
    });
    return false;
  }
}

/**
 * Call once when /yoqlama mounts and again after every `enqueuePhoto`.
 * Drains everything currently `queued`, with the 5/15/60s backoff
 * between each item's own retries — TZ's exact ladder.
 */
export function drainPhotoQueue(onChange?: () => void) {
  for (const item of load()) {
    if (item.status !== "queued") continue;
    const delay = BACKOFF_MS[Math.min(item.attempts, BACKOFF_MS.length - 1)];
    const run = item.attempts === 0 ? 0 : delay;
    setTimeout(async () => {
      await uploadOne(item);
      onChange?.();
    }, run);
  }
}

/** The row-level "Qayta yuborish" button after 3 failures. */
export function retryPhoto(attendanceId: string, onChange?: () => void) {
  const item = load().find((i) => i.attendanceId === attendanceId);
  if (!item) return;
  updateItem(attendanceId, { status: "queued", attempts: 0 });
  uploadOne({ ...item, attempts: 0, status: "queued" }).then(() => onChange?.());
}
