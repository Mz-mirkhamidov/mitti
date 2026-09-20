"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function KindergartenSettings({
  kindergartenId,
  initialName,
  initialMealNorm,
  initialKitchenChatId,
}: {
  kindergartenId: string;
  initialName: string;
  initialMealNorm: number;
  initialKitchenChatId: number | null;
}) {
  const [name, setName] = useState(initialName);
  const [mealNorm, setMealNorm] = useState(initialMealNorm);
  const [kitchenChatId, setKitchenChatId] = useState(initialKitchenChatId?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await Promise.all([
      supabase.from("kindergartens").update({ name }).eq("id", kindergartenId),
      supabase.from("settings").upsert(
        {
          kindergarten_id: kindergartenId,
          meal_norm_per_day: mealNorm,
          kitchen_chat_id: kitchenChatId ? Number(kitchenChatId) : null,
        },
        { onConflict: "kindergarten_id" },
      ),
    ]);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-500">Bog&apos;cha nomi</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-500">Ovqat normasi (so&apos;m/kun/bola)</span>
        <input
          type="number"
          value={mealNorm}
          onChange={(e) => setMealNorm(Number(e.target.value))}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-500">Oshxona Telegram chat id</span>
        <input
          value={kitchenChatId}
          onChange={(e) => setKitchenChatId(e.target.value)}
          placeholder="masalan, -100123456789"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="self-start rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saqlanmoqda..." : "Saqlash"}
      </button>
      {saved && <p className="text-xs text-emerald-600">Saqlandi</p>}
    </div>
  );
}
