"use client";

import { useEffect, useMemo, useState } from "react";
import type { BoardRental, Reservation, ReservationStatus } from "@/lib/types";
import type { RentalSettings } from "@/lib/board-rental";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<ReservationStatus, string> = { pending: "Čaká", confirmed: "Potvrdené", cancelled: "Zrušené" };
const STATUS_CLASS: Record<ReservationStatus, string> = {
  pending: "bg-yellow-soft text-ink border-yellow",
  confirmed: "bg-sage-soft text-ink border-sage",
  cancelled: "bg-rust-soft text-rust border-rust/40",
};

export default function CalendarPage() {
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [boardRentals, setBoardRentals] = useState<BoardRental[]>([]);
  const [settings, setSettings] = useState<RentalSettings | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [res, rentals, sett] = await Promise.all([
      fetch("/api/reservations").then((r) => r.json()),
      fetch("/api/board-rentals").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setReservations(Array.isArray(res) ? res : []);
    setBoardRentals(Array.isArray(rentals) ? rentals : []);
    setSettings(sett);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const cap = settings?.max_students_per_day ?? 8;

  const byDate = useMemo(() => {
    const map = new Map<string, number>();
    reservations.forEach((r) => {
      if (r.status === "cancelled") return;
      map.set(r.course_date, (map.get(r.course_date) ?? 0) + r.number_of_people);
    });
    return map;
  }, [reservations]);

  const weeks = useMemo(() => {
    const first = new Date(month);
    const startDay = (first.getDay() + 6) % 7; // Monday = 0
    const gridStart = new Date(first);
    gridStart.setDate(gridStart.getDate() - startDay);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    const rows: Date[][] = [];
    for (let i = 0; i < 6; i++) rows.push(days.slice(i * 7, i * 7 + 7));
    return rows;
  }, [month]);

  const today = ymd(new Date());

  const selectedReservations = reservations.filter((r) => r.course_date === selected).sort((a, b) => a.course_time.localeCompare(b.course_time));
  const selectedBoardRentals = boardRentals.filter((r) => r.rental_date === selected);

  async function setStatus(id: string, status: ReservationStatus) {
    await fetch(`/api/reservations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }
  async function setRentalStatus(id: string, status: ReservationStatus) {
    await fetch(`/api/board-rentals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {month.toLocaleDateString("sk-SK", { month: "long", year: "numeric" })}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; })} className="rounded-lg border border-line px-3 py-1.5 hover:bg-paper">←</button>
          <button onClick={() => { const d = new Date(); d.setDate(1); setMonth(d); }} className="rounded-lg border border-line px-3 py-1.5 hover:bg-paper">Dnes</button>
          <button onClick={() => setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; })} className="rounded-lg border border-line px-3 py-1.5 hover:bg-paper">→</button>
        </div>
      </div>

      {loading ? (
        <p className="text-ink-soft">Načítavam…</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-paper">
          <div className="grid grid-cols-7 border-b border-line bg-sand text-center text-xs font-semibold text-ink-soft">
            {["Po", "Ut", "St", "Št", "Pi", "So", "Ne"].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day) => {
                const dateStr = ymd(day);
                const inMonth = day.getMonth() === month.getMonth();
                const booked = byDate.get(dateStr) ?? 0;
                const isToday = dateStr === today;
                const full = booked >= cap;
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelected(dateStr)}
                    className={`min-h-20 border-b border-r border-line p-2 text-left align-top transition hover:bg-sand ${inMonth ? "" : "opacity-40"} ${selected === dateStr ? "ring-2 ring-inset ring-brown" : ""}`}
                  >
                    <div className={`text-sm font-semibold ${isToday ? "text-brown" : ""}`}>{day.getDate()}</div>
                    {booked > 0 && (
                      <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ${full ? "border-rust/40 bg-rust-soft text-rust" : "border-sage bg-sage-soft text-sage-dark"}`}>
                        {booked}/{cap}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <section className="mt-6 rounded-card border border-line bg-paper p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">
              {new Date(selected + "T00:00:00").toLocaleDateString("sk-SK", { weekday: "long", day: "numeric", month: "long" })}
              {" · "}{byDate.get(selected) ?? 0}/{cap} miest
            </h3>
            <button onClick={() => setSelected(null)} className="text-sm text-ink-soft hover:underline">Zavrieť</button>
          </div>

          {selectedReservations.length === 0 && selectedBoardRentals.length === 0 ? (
            <p className="text-ink-soft">Na tento deň zatiaľ nie sú žiadne rezervácie.</p>
          ) : (
            <div className="space-y-3">
              {selectedReservations.map((r) => (
                <div key={r.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{r.course_time} · {r.customer.first_name} {r.customer.last_name} · {r.number_of_people} os.</p>
                      <p className="text-sm text-ink-soft">{r.groups.map((g) => `${g.number_of_people}× ${g.course_name}`).join(", ")}</p>
                      <p className="text-sm text-ink-soft">{r.customer.phone}{r.customer.email ? ` · ${r.customer.email}` : ""}</p>
                      {r.special_requests && <p className="text-sm italic text-ink-soft">„{r.special_requests}"</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{r.total_price.toLocaleString()} Rs</p>
                      {r.discount > 0 && <p className="text-xs text-sage-dark">zľava −{r.discount.toLocaleString()} Rs</p>}
                      <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {r.status !== "confirmed" && <button onClick={() => setStatus(r.id, "confirmed")} className="rounded-lg bg-brown px-3 py-1.5 text-sm font-semibold text-white hover:bg-brown-dark">Potvrdiť</button>}
                    {r.status !== "cancelled" && <button onClick={() => setStatus(r.id, "cancelled")} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-sand">Zrušiť</button>}
                    {r.status !== "pending" && <button onClick={() => setStatus(r.id, "pending")} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-sand">Vrátiť na čakajúce</button>}
                  </div>
                </div>
              ))}

              {selectedBoardRentals.map((r) => (
                <div key={r.id} className="rounded-xl border border-line bg-sand/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">🏄 Doska: {r.guest_name} · {r.quantity}× {r.board_type}</p>
                      <p className="text-sm text-ink-soft">
                        {r.pricing === "day" ? "Celý deň" : `${r.planned_hours ?? 1} h od ${r.planned_start ?? "?"}`}
                        {r.guest_phone ? ` · ${r.guest_phone}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{r.amount.toLocaleString()} Rs</p>
                      <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {r.status !== "confirmed" && <button onClick={() => setRentalStatus(r.id, "confirmed")} className="rounded-lg bg-brown px-3 py-1.5 text-sm font-semibold text-white hover:bg-brown-dark">Potvrdiť</button>}
                    {r.status !== "cancelled" && <button onClick={() => setRentalStatus(r.id, "cancelled")} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-sand">Zrušiť</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
