"use client";

import { useEffect, useState } from "react";
import type { Course, Settings } from "@/lib/types";

export default function SettingsPage() {
  const [course, setCourse] = useState<Course | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/courses").then((r) => r.json()).then(setCourse);
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  function flash(msg: string) {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(null), 2000);
  }

  async function saveCourse() {
    if (!course) return;
    const res = await fetch("/api/courses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(course) });
    if (res.ok) { setCourse(await res.json()); flash("Course saved ✓"); }
  }
  async function saveSettings() {
    if (!settings) return;
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    if (res.ok) { setSettings(await res.json()); flash("Settings saved ✓"); }
  }

  return (
    <div className="space-y-8">
      {savedMsg && <div className="rounded-xl bg-sage-soft px-4 py-2 font-semibold text-sage-dark">{savedMsg}</div>}

      <section className="rounded-card border border-line bg-paper p-5">
        <h2 className="mb-4 text-lg font-bold">Course</h2>
        {course && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink-soft">Name</span>
              <input className="input" value={course.name} onChange={(e) => setCourse({ ...course, name: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink-soft">Price per person (Rs)</span>
              <input type="number" min={0} className="input w-36" value={course.price} onChange={(e) => setCourse({ ...course, price: Number(e.target.value) })} />
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" checked={course.is_active} onChange={(e) => setCourse({ ...course, is_active: e.target.checked })} />
              Bookings open
            </label>
          </div>
        )}
        <p className="mt-3 text-sm text-ink-soft">Lesson times: 08:30 and 10:00.</p>
        <button onClick={saveCourse} className="mt-4 rounded-lg bg-brown px-4 py-2 font-semibold text-white hover:bg-brown-dark">Save</button>
      </section>

      <section className="rounded-card border border-line bg-paper p-5">
        <h2 className="mb-4 text-lg font-bold">Capacity</h2>
        {settings && (
          <label className="block max-w-xs text-sm">
            <span className="mb-1 block font-semibold text-ink-soft">Max students / day</span>
            <input type="number" min={1} className="input" value={settings.max_students_per_day}
              onChange={(e) => setSettings({ ...settings, max_students_per_day: Math.max(1, Number(e.target.value)) })} />
          </label>
        )}
        <button onClick={saveSettings} className="mt-4 rounded-lg bg-brown px-4 py-2 font-semibold text-white hover:bg-brown-dark">Save</button>
      </section>
    </div>
  );
}
