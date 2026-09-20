"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * TZ v1 §8 — "Biz davlat to'lov tizimiga ulanmaymiz. 'Kelgan summa' —
 * rahbar kiritadigan raqam." Stated in the UI itself, not just the spec.
 */
export function SubsidyInput({
  kindergartenId,
  month,
  expectedAmount,
  initialReceived,
}: {
  kindergartenId: string;
  month: string; // YYYY-MM
  expectedAmount: number;
  initialReceived: number;
}) {
  const [received, setReceived] = useState(initialReceived);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase.from("subsidy_reports").upsert(
      {
        kindergarten_id: kindergartenId,
        month: `${month}-01`,
        received_amount: received,
      },
      { onConflict: "kindergarten_id,month" },
    );
    setSaving(false);
    setSaved(true);
  }

  const diff = received - expectedAmount;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="mb-1 text-sm font-medium text-neutral-900">Ovqat subsidiyasi hisobi</h3>
      <p className="mb-3 text-xs text-neutral-400">
        Biz davlat to&apos;lov tizimiga ulanmaymiz — &quot;kelgan summa&quot;ni o&apos;zingiz kiritasiz.
      </p>

      <dl className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-neutral-500">Kutilgan summa</dt>
        <dd className="text-right font-medium text-neutral-900">
          {expectedAmount.toLocaleString("uz-UZ")} so&apos;m
        </dd>
      </dl>

      <div className="mb-2 flex items-center gap-2">
        <input
          type="number"
          value={received}
          onChange={(e) => setReceived(Number(e.target.value))}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Davlatdan kelgan summa"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "..." : "Saqlash"}
        </button>
      </div>

      {saved && <p className="mb-2 text-xs text-emerald-600">Saqlandi</p>}

      <div
        className={`rounded-lg px-3 py-2 text-sm font-medium ${
          diff === 0
            ? "bg-neutral-50 text-neutral-600"
            : diff < 0
              ? "bg-red-50 text-red-700"
              : "bg-emerald-50 text-emerald-700"
        }`}
      >
        Farq: {diff > 0 ? "+" : ""}
        {diff.toLocaleString("uz-UZ")} so&apos;m
      </div>
    </div>
  );
}
