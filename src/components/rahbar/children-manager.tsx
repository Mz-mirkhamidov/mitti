"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ChildRow {
  id: string;
  full_name: string;
  group_id: string | null;
  active: boolean;
  parent_linked_at: string | null;
  parent_link_code: string | null;
}

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/**
 * TZ v1 §7.5 — plain CRUD plus the one-time Telegram link code per
 * child. Every write here goes through `children_owner_write` RLS
 * (owner-only) directly from the browser client — no dedicated API
 * route, since there's nothing here an authenticated owner couldn't do
 * with the same permission set anyway.
 */
export function ChildrenManager({
  kindergartenId,
  botUsername,
  groups,
  children: initialChildren,
}: {
  kindergartenId: string;
  botUsername: string;
  groups: { id: string; name: string }[];
  children: ChildRow[];
}) {
  const router = useRouter();
  const [children, setChildren] = useState(initialChildren);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addChild(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("children")
      .insert({ kindergarten_id: kindergartenId, full_name: name.trim(), group_id: groupId || null })
      .select("id, full_name, group_id, active, parent_linked_at, parent_link_code")
      .single();
    setSaving(false);
    if (!error && data) {
      setChildren((prev) => [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setName("");
    }
  }

  async function toggleActive(child: ChildRow) {
    const supabase = createClient();
    await supabase.from("children").update({ active: !child.active }).eq("id", child.id);
    setChildren((prev) => prev.map((c) => (c.id === child.id ? { ...c, active: !c.active } : c)));
    router.refresh();
  }

  async function generateLink(child: ChildRow) {
    const code = randomCode();
    const supabase = createClient();
    await supabase.from("children").update({ parent_link_code: code }).eq("id", child.id);
    setChildren((prev) => prev.map((c) => (c.id === child.id ? { ...c, parent_link_code: code } : c)));

    const url = `https://t.me/${botUsername}?start=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(child.id);
      setTimeout(() => setCopiedId((prev) => (prev === child.id ? null : prev)), 2000);
    } catch {
      // Clipboard can fail (permissions, non-HTTPS) — the link is still
      // shown on screen either way, just not auto-copied.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={addChild} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ism familiya"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Qo&apos;shish
        </button>
      </form>

      <div className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {children.map((child) => {
          const group = groups.find((g) => g.id === child.group_id);
          return (
            <div key={child.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${child.active ? "text-neutral-900" : "text-neutral-400 line-through"}`}>
                  {child.full_name}
                </p>
                <p className="text-xs text-neutral-400">{group?.name ?? "Guruhsiz"}</p>
              </div>

              {child.parent_linked_at ? (
                <span className="shrink-0 text-xs text-emerald-600">
                  Ulangan{" "}
                  {new Date(child.parent_linked_at).toLocaleDateString("uz-UZ")}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => generateLink(child)}
                  className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700"
                >
                  {copiedId === child.id ? "Nusxalandi!" : "Havola yaratish"}
                </button>
              )}

              <button
                type="button"
                onClick={() => toggleActive(child)}
                className="shrink-0 text-xs text-neutral-400 underline"
              >
                {child.active ? "O'chirish" : "Faollashtirish"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
