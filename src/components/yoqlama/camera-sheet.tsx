"use client";

import { useRef } from "react";

/**
 * TZ v1 §7.2 — opens the device's own camera via `<input capture>`, never
 * a custom camera UI. The two outcomes (photo taken, or "Rasmsiz
 * belgilash") both call back into the parent, which marks the child
 * immediately either way — this sheet never blocks on anything.
 */
export function CameraSheet({
  childName,
  onCapture,
  onSkip,
  onClose,
}: {
  childName: string;
  onCapture: (file: File) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
    e.target.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-center text-base font-medium text-neutral-900">{childName}</p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mb-2 w-full rounded-xl bg-neutral-900 px-4 py-4 text-base font-medium text-white"
        >
          Rasm olish
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full rounded-xl border border-neutral-300 px-4 py-4 text-base font-medium text-neutral-700"
        >
          Rasmsiz belgilash
        </button>
      </div>
    </div>
  );
}
