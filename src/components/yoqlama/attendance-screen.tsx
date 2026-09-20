"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { enqueuePhoto, drainPhotoQueue, retryPhoto, getQueue } from "@/lib/photo-queue";
import { timeOf } from "@/lib/day";
import { CameraSheet } from "@/components/yoqlama/camera-sheet";
import type { AbsenceReason } from "@/lib/types";

interface ChildData {
  id: string;
  full_name: string;
}

interface AttendanceState {
  attendanceId: string;
  status: "present" | "absent";
  arrivedAt: string | null;
  absenceReason: AbsenceReason | null;
  hasPhotoQueued: boolean;
}

const REASON_LABEL: Record<AbsenceReason, string> = {
  sick: "Kasal",
  vacation: "Ta'til",
  unexcused: "Sababsiz",
};

export function AttendanceScreen({
  groupId,
  groupName,
  kindergartenId,
  day,
  children: initialChildren,
  initialAttendance,
  groups,
}: {
  groupId: string;
  groupName: string;
  kindergartenId: string;
  day: string;
  children: ChildData[];
  initialAttendance: Record<string, AttendanceState>;
  groups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [attendance, setAttendance] = useState<Record<string, AttendanceState>>(initialAttendance);
  const [finished, setFinished] = useState(
    () => Object.values(initialAttendance).some((a) => a.status === "absent"),
  );
  const [cameraChild, setCameraChild] = useState<ChildData | null>(null);
  const [undoToast, setUndoToast] = useState<{ childId: string; attendanceId: string } | null>(
    null,
  );
  const [finishing, setFinishing] = useState(false);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    drainPhotoQueue(() => setFailedCount(getQueue().filter((i) => i.status === "failed").length));
    setFailedCount(getQueue().filter((i) => i.status === "failed").length);
  }, []);

  useEffect(() => {
    if (!undoToast) return;
    const t = setTimeout(() => setUndoToast(null), 5000);
    return () => clearTimeout(t);
  }, [undoToast]);

  const { waiting, arrived, absent } = useMemo(() => {
    const w: ChildData[] = [];
    const a: ChildData[] = [];
    const ab: ChildData[] = [];
    for (const child of initialChildren) {
      const rec = attendance[child.id];
      if (!rec) w.push(child);
      else if (rec.status === "present") a.push(child);
      else ab.push(child);
    }
    return { waiting: w, arrived: a, absent: ab };
  }, [initialChildren, attendance]);

  const total = initialChildren.length;
  const arrivedCount = arrived.length;

  async function markPresent(child: ChildData, file: File | null) {
    setCameraChild(null);

    // TZ §7.2 — the tap moves the child to "Keldi" the instant a photo
    // is picked (or skipped); the network call happens after, never
    // before.
    const tempId = `temp-${child.id}-${Date.now()}`;
    setAttendance((prev) => ({
      ...prev,
      [child.id]: {
        attendanceId: tempId,
        status: "present",
        arrivedAt: new Date().toISOString(),
        absenceReason: null,
        hasPhotoQueued: !!file,
      },
    }));
    setUndoToast({ childId: child.id, attendanceId: tempId });

    try {
      const res = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ child_id: child.id, no_photo: !file }),
      });
      if (!res.ok) throw new Error(`mark ${res.status}`);
      const data = (await res.json()) as { attendance_id: string };

      setAttendance((prev) => ({
        ...prev,
        [child.id]: { ...prev[child.id], attendanceId: data.attendance_id },
      }));
      setUndoToast((prev) =>
        prev?.childId === child.id ? { childId: child.id, attendanceId: data.attendance_id } : prev,
      );

      if (file) {
        const compressed = await compressImage(file);
        const dataUrl = await blobToDataUrl(compressed);
        enqueuePhoto({
          attendanceId: data.attendance_id,
          childId: child.id,
          kindergartenId,
          day,
          dataUrl,
        });
        drainPhotoQueue(() =>
          setFailedCount(getQueue().filter((i) => i.status === "failed").length),
        );
      }
    } catch (err) {
      // TZ §10 — the local mark stands regardless: the record is what
      // matters, the photo/notification are best-effort. A failed
      // network call here just means the UI hasn't confirmed the real
      // attendance_id yet; the next tap or a refresh will reconcile.
      console.error("mark_failed", err);
    }
  }

  async function undo() {
    if (!undoToast) return;
    const { childId, attendanceId } = undoToast;
    setUndoToast(null);
    setAttendance((prev) => {
      const next = { ...prev };
      delete next[childId];
      return next;
    });
    if (!attendanceId.startsWith("temp-")) {
      const supabase = createClient();
      await supabase.from("attendance").delete().eq("id", attendanceId);
    }
  }

  async function setReason(child: ChildData, reason: AbsenceReason) {
    const rec = attendance[child.id];
    if (!rec) return;
    setAttendance((prev) => ({
      ...prev,
      [child.id]: { ...prev[child.id], absenceReason: reason },
    }));
    const supabase = createClient();
    await supabase.from("attendance").update({ absence_reason: reason }).eq("id", rec.attendanceId);
  }

  async function finish() {
    setFinishing(true);
    try {
      const res = await fetch("/api/attendance/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: groupId }),
      });
      if (res.ok) {
        setFinished(true);
        router.refresh();
      }
    } finally {
      setFinishing(false);
    }
  }

  function switchGroup(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("guruh", id);
    router.push(`/yoqlama?${params.toString()}`);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50 pb-24">
      <header className="bg-white px-4 py-4">
        {groups.length > 1 ? (
          <select
            value={groupId}
            onChange={(e) => switchGroup(e.target.value)}
            className="mb-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        ) : (
          <h1 className="text-lg font-semibold text-neutral-900">{groupName}</h1>
        )}

        <p className="mb-2 text-2xl font-semibold text-neutral-900">
          {arrivedCount} / {total} keldi
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: total > 0 ? `${(arrivedCount / total) * 100}%` : "0%" }}
          />
        </div>

        {failedCount > 0 && (
          <p className="mt-2 text-sm text-red-600">
            {failedCount} ta rasm yuborilmadi —{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                for (const item of getQueue().filter((i) => i.status === "failed")) {
                  retryPhoto(item.attendanceId, () =>
                    setFailedCount(getQueue().filter((i) => i.status === "failed").length),
                  );
                }
              }}
            >
              Qayta yuborish
            </button>
          </p>
        )}
      </header>

      <main className="flex-1 px-4 py-4">
        {waiting.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-medium text-neutral-500">Kutilmoqda</h2>
            <div className="grid grid-cols-3 gap-2">
              {waiting.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => setCameraChild(child)}
                  className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl bg-white p-2 text-center shadow-sm active:bg-neutral-100"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-neutral-200 text-base font-semibold text-neutral-700">
                    {child.full_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="line-clamp-2 text-xs font-medium text-neutral-800">
                    {child.full_name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {arrived.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-medium text-neutral-500">Keldi</h2>
            <div className="flex flex-col gap-1 rounded-xl bg-white shadow-sm">
              {arrived.map((child) => {
                const rec = attendance[child.id];
                return (
                  <div
                    key={child.id}
                    className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 last:border-0"
                  >
                    <span className="text-sm font-medium text-neutral-900">{child.full_name}</span>
                    <span className="text-xs text-neutral-500">
                      {rec.arrivedAt ? timeOf(new Date(rec.arrivedAt)) : ""} ✓
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {finished && absent.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-medium text-neutral-500">Kelmadi</h2>
            <div className="flex flex-col gap-1 rounded-xl bg-white shadow-sm">
              {absent.map((child) => {
                const rec = attendance[child.id];
                return (
                  <div
                    key={child.id}
                    className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-3 last:border-0"
                  >
                    <span className="text-sm font-medium text-neutral-900">{child.full_name}</span>
                    <div className="flex gap-1.5">
                      {(Object.keys(REASON_LABEL) as AbsenceReason[]).map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => setReason(child, reason)}
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            rec.absenceReason === reason
                              ? "bg-neutral-900 text-white"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {REASON_LABEL[reason]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {!finished && (
        <div className="fixed inset-x-0 bottom-0 bg-white p-4 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <button
            type="button"
            onClick={finish}
            disabled={finishing || waiting.length === 0}
            className="w-full rounded-xl bg-neutral-900 px-4 py-4 text-base font-medium text-white disabled:opacity-40"
          >
            {finishing ? "Yakunlanmoqda..." : `Kelmaganlarni yakunlash (${waiting.length})`}
          </button>
        </div>
      )}

      {cameraChild && (
        <CameraSheet
          childName={cameraChild.full_name}
          onClose={() => setCameraChild(null)}
          onSkip={() => markPresent(cameraChild, null)}
          onCapture={(file) => markPresent(cameraChild, file)}
        />
      )}

      {undoToast && (
        <div className="fixed inset-x-4 bottom-24 z-40 flex items-center justify-between rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg">
          <span>Belgilandi</span>
          <button type="button" onClick={undo} className="font-medium underline">
            Bekor qilish
          </button>
        </div>
      )}
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
