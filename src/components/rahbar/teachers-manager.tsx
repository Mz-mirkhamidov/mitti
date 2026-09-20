"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TeacherRow {
  id: string;
  full_name: string;
  phone: string;
  active: boolean;
}

/** TZ v1 §7.6 — teacher creation always goes through the server (POST /api/teachers), never a direct RLS write, since it needs the service-role client. */
export function TeachersManager({ teachers }: { teachers: TeacherRow[] }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addTeacher(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi.");
        return;
      }
      setFullName("");
      setPhone("");
      setPassword("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {teachers.length === 0 && (
          <p className="px-4 py-3 text-sm text-neutral-400">Hali tarbiyachi yo&apos;q.</p>
        )}
        {teachers.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm font-medium text-neutral-900">{t.full_name}</span>
            <span className="text-xs text-neutral-400">{t.phone}</span>
          </div>
        ))}
      </div>

      <form onSubmit={addTeacher} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3">
        <p className="text-xs font-medium text-neutral-500">Yangi tarbiyachi</p>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Ism familiya"
          required
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+998 90 123 45 67"
          type="tel"
          required
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Parol"
          type="password"
          required
          minLength={6}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Qo'shilmoqda..." : "Qo'shish"}
        </button>
      </form>
    </div>
  );
}
