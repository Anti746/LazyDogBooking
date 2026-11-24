"use client";

import { useEffect, useState } from "react";
import type { Course } from "@/lib/types";
import type { BoardType, RentalSettings } from "@/lib/board-rental";

export default function SettingsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [boardTypes, setBoardTypes] = useState<BoardType[]>([]);
  const [settings, setSettings] = useState<RentalSettings | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function load() {
    const [c, b, s] = await Promise.all([
      fetch("/api/courses").then((r) => r.json()),
      fetch("/api/board-types").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setCourses(c);
    setBoardTypes(b);
    setSettings(s);
  }

  useEffect(() => { load(); }, []);

  function flash(msg: string) {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(null), 2000);
  }

  async function saveCourses() {
    await fetch("/api/courses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(courses) });
    flash("Ceny lekcií uložené ✓");
  }
  async function saveBoards() {
    await fetch("/api/board-types", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(boardTypes) });
    flash("Ceny dosiek uložené ✓");
  }
  async function saveSettings() {
    if (!settings) return;
    await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    flash("Nastavenia uložené ✓");
  }

  return (
    <div className="space-y-8">
      {savedMsg && <div className="rounded-xl bg-sage-soft px-4 py-2 font-semibold text-sage-dark">{savedMsg}</div>}

      <section className="rounded-card border border-line bg-paper p-5">
        <h2 className="mb-4 text-lg font-bold">Kapacita a časy</h2>
        {settings && (
          <div className="grid grid-cols-3 gap-4">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink-soft">Max. žiakov / deň</span>
              <input type="number" min={1} className="input" value={settings.max_students_per_day}
                onChange={(e) => setSettings({ ...settings, max_students_per_day: Math.max(1, Number(e.target.value)) })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink-soft">Dosky od (vyzdvihnutie)</span>
              <input type="time" className="input" value={settings.pickup_from}
                onChange={(e) => setSettings({ ...settings, pickup_from: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink-soft">Dosky vrátiť do</span>
              <input type="time" className="input" value={settings.back_by}
                onChange={(e) => setSettings({ ...settings, back_by: e.target.value })} />
            </label>
          </div>
        )}
        <button onClick={saveSettings} className="mt-4 rounded-lg bg-brown px-4 py-2 font-semibold text-white hover:bg-brown-dark">Uložiť</button>
      </section>

      <section className="rounded-card border border-line bg-paper p-5">
        <h2 className="mb-4 text-lg font-bold">Ceny lekcií</h2>
        <div className="space-y-2">
          {courses.map((c, i) => (
            <div key={c.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
              <input className="input" value={c.name}
                onChange={(e) => setCourses((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <div className="flex items-center gap-1">
                <input type="number" min={0} className="input w-28" value={c.price}
                  onChange={(e) => setCourses((prev) => prev.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))} />
                <span className="text-sm text-ink-soft">Rs</span>
              </div>
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={c.is_active}
                  onChange={(e) => setCourses((prev) => prev.map((x, j) => j === i ? { ...x, is_active: e.target.checked } : x))} />
                aktívne
              </label>
            </div>
          ))}
        </div>
        <button onClick={saveCourses} className="mt-4 rounded-lg bg-brown px-4 py-2 font-semibold text-white hover:bg-brown-dark">Uložiť</button>
      </section>

      <section className="rounded-card border border-line bg-paper p-5">
        <h2 className="mb-4 text-lg font-bold">Ceny a počty dosiek</h2>
        <div className="space-y-2">
          {boardTypes.map((t, i) => (
            <div key={t.key} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3">
              <input className="input" value={t.name}
                onChange={(e) => setBoardTypes((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <div className="flex items-center gap-1">
                <input type="number" min={0} className="input w-24" value={t.hourly_price}
                  onChange={(e) => setBoardTypes((prev) => prev.map((x, j) => j === i ? { ...x, hourly_price: Number(e.target.value) } : x))} />
                <span className="text-xs text-ink-soft">Rs/h</span>
              </div>
              <div className="flex items-center gap-1">
                <input type="number" min={0} className="input w-24" value={t.day_price}
                  onChange={(e) => setBoardTypes((prev) => prev.map((x, j) => j === i ? { ...x, day_price: Number(e.target.value) } : x))} />
                <span className="text-xs text-ink-soft">Rs/deň</span>
              </div>
              <div className="flex items-center gap-1">
                <input type="number" min={0} className="input w-20" value={t.quantity}
                  onChange={(e) => setBoardTypes((prev) => prev.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} />
                <span className="text-xs text-ink-soft">ks</span>
              </div>
            </div>
          ))}
        </div>
        <button onClick={saveBoards} className="mt-4 rounded-lg bg-brown px-4 py-2 font-semibold text-white hover:bg-brown-dark">Uložiť</button>
      </section>
    </div>
  );
}
