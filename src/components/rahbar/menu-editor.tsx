"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** TZ v1 §7.4 — three free-text fields. "Biz ovqat normalarini tekshirmaymiz." */
export function MenuEditor({
  kindergartenId,
  day,
  initial,
  hasLastWeek,
}: {
  kindergartenId: string;
  day: string;
  initial: { breakfast: string; lunch: string; snack: string };
  hasLastWeek: boolean;
}) {
  const router = useRouter();
  const [breakfast, setBreakfast] = useState(initial.breakfast);
  const [lunch, setLunch] = useState(initial.lunch);
  const [snack, setSnack] = useState(initial.snack);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase
      .from("menus")
      .upsert(
        { kindergarten_id: kindergartenId, day, breakfast, lunch, snack },
        { onConflict: "kindergarten_id,day" },
      );
    setSaving(false);
    setSaved(true);
  }

  async function copyFromLastWeek() {
    const supabase = createClient();
    const lastWeekDay = shiftDay(day, -7);
    const { data } = await supabase
      .from("menus")
      .select("breakfast, lunch, snack")
      .eq("kindergarten_id", kindergartenId)
      .eq("day", lastWeekDay)
      .maybeSingle();
    if (data) {
      setBreakfast(data.breakfast ?? "");
      setLunch(data.lunch ?? "");
      setSnack(data.snack ?? "");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push(`/rahbar/menyu?sana=${shiftDay(day, -1)}`)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
          >
            ←
          </button>
          <span className="px-2 py-1.5 text-sm font-medium text-neutral-900">{day}</span>
          <button
            type="button"
            onClick={() => router.push(`/rahbar/menyu?sana=${shiftDay(day, 1)}`)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
          >
            →
          </button>
        </div>
        {hasLastWeek && (
          <button
            type="button"
            onClick={copyFromLastWeek}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700"
          >
            O&apos;tgan haftadan nusxa olish
          </button>
        )}
      </div>

      <Field label="Nonushta" value={breakfast} onChange={setBreakfast} />
      <Field label="Tushlik" value={lunch} onChange={setLunch} />
      <Field label="Kechki ovqat" value={snack} onChange={setSnack} />

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saqlanmoqda..." : "Saqlash"}
      </button>
      {saved && <p className="text-xs text-emerald-600">Saqlandi</p>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
