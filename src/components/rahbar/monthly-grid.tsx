"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Cell {
  attendanceId: string;
  status: "present" | "absent";
  photoPath: string | null;
  arrivedAt: string | null;
  correctionCount: number;
}

interface ChildRow {
  id: string;
  full_name: string;
}

/**
 * TZ v1 §7.3 point 2-3 — the evidence table. Every correction is already
 * visible as the "N marta tuzatilgan" badge (attendance_audit is
 * populated by the DB trigger, never by this UI); clicking a cell opens
 * the panel with the photo, time, and that badge.
 */
export function MonthlyGrid({
  children,
  days,
  cells,
}: {
  children: ChildRow[];
  days: string[];
  cells: Record<string, Record<string, Cell>>;
}) {
  const [panel, setPanel] = useState<{ child: ChildRow; day: string; cell: Cell } | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);

  async function openPanel(child: ChildRow, day: string, cell: Cell) {
    setPanel({ child, day, cell });
    setPhotoUrl(null);
    if (cell.photoPath) {
      setLoadingPhoto(true);
      const supabase = createClient();
      const { data } = await supabase.storage
        .from("attendance-photos")
        .createSignedUrl(cell.photoPath, 60 * 60);
      setPhotoUrl(data?.signedUrl ?? null);
      setLoadingPhoto(false);
    }
  }

  return (
    <div className="relative overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[160px] border-b border-neutral-200 bg-white px-3 py-2 text-left font-medium text-neutral-500">
              Bola
            </th>
            {days.map((d) => (
              <th
                key={d}
                className="min-w-[36px] border-b border-neutral-200 px-1 py-2 text-center font-medium text-neutral-400"
              >
                {Number(d.slice(-2))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children.map((child) => (
            <tr key={child.id}>
              <td className="sticky left-0 z-10 min-w-[160px] border-b border-neutral-100 bg-white px-3 py-2 font-medium text-neutral-800">
                {child.full_name}
              </td>
              {days.map((d) => {
                const cell = cells[child.id]?.[d];
                return (
                  <td
                    key={d}
                    onClick={() => cell && openPanel(child, d, cell)}
                    className={`min-w-[36px] border-b border-neutral-100 px-1 py-2 text-center ${
                      cell ? "cursor-pointer hover:bg-neutral-50" : ""
                    }`}
                  >
                    {cell ? (
                      <span
                        className={cell.status === "present" ? "text-emerald-600" : "text-neutral-300"}
                      >
                        {cell.status === "present" ? "✓" : "–"}
                        {cell.correctionCount > 0 && (
                          <sup className="text-[9px] text-amber-600">{cell.correctionCount}</sup>
                        )}
                      </span>
                    ) : (
                      <span className="text-neutral-200">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {panel && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setPanel(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-white p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-neutral-900">{panel.child.full_name}</h3>
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>

            <p className="mb-2 text-sm text-neutral-500">
              {panel.day} ·{" "}
              {panel.cell.status === "present"
                ? panel.cell.arrivedAt
                  ? new Date(panel.cell.arrivedAt).toLocaleTimeString("uz-UZ", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "keldi"
                : "kelmadi"}
            </p>

            {loadingPhoto && <p className="py-8 text-center text-sm text-neutral-400">Yuklanmoqda...</p>}
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- signed URL, not an optimizable static asset
              <img src={photoUrl} alt={panel.child.full_name} className="mb-3 w-full rounded-xl" />
            )}
            {!panel.cell.photoPath && !loadingPhoto && (
              <p className="mb-3 rounded-xl bg-neutral-100 py-8 text-center text-sm text-neutral-400">
                Rasm yo&apos;q
              </p>
            )}

            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                panel.cell.correctionCount > 0
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {panel.cell.correctionCount > 0
                ? `${panel.cell.correctionCount} marta tuzatilgan`
                : "O'zgartirilmagan"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
