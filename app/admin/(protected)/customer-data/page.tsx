"use client";

import { useState } from "react";
import type { Reservation } from "@/lib/types";

// GDPR data-subject requests: find everything stored about one person, hand
// them a copy (Art. 15 access / Art. 20 portability) or erase it (Art. 17).
export default function CustomerDataPage() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Reservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/customer-data?q=${encodeURIComponent(term)}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setResults(null); setError(data.error ?? "Search failed"); return; }
    setResults(data);
  }

  function exportJson() {
    if (!results) return;
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), controller: "LazyDog Surf", bookings: results }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lazydog-personal-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function eraseAll() {
    if (!results?.length) return;
    if (!window.confirm(`Permanently delete ${results.length} booking(s) and all participant data for this person? This cannot be undone.`)) return;
    for (const r of results) await fetch(`/api/reservations/${r.id}`, { method: "DELETE" });
    await search();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-card border border-line bg-paper p-5">
        <h2 className="text-lg font-bold">Customer data requests (GDPR)</h2>
        <p className="mt-1 text-sm text-ink-soft">
          When someone asks what data we hold about them, or asks us to delete it, search by their email, phone number or booking reference.
          Answer within one month. Check the request really comes from that person (e.g. reply from the same email / WhatsApp number) before sending or deleting anything.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); search(); }} className="mt-4 flex gap-2">
          <input className="input flex-1" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="email, phone or LD-XXXXXXXX" />
          <button disabled={loading || term.trim().length < 3} className="rounded-lg bg-brown px-4 py-2 font-semibold text-white hover:bg-brown-dark disabled:opacity-50">Search</button>
        </form>
        {error && <p className="mt-3 text-sm font-semibold text-rust">{error}</p>}
      </section>

      {results && (
        <section className="rounded-card border border-line bg-paper p-5">
          {results.length === 0 ? (
            <p className="text-ink-soft">No data found for “{term}”.</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{results.length} booking(s) found</p>
                <div className="flex gap-2">
                  <button onClick={exportJson} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-sand">Export (JSON)</button>
                  <button onClick={eraseAll} className="rounded-lg border border-rust/40 px-3 py-1.5 text-sm font-semibold text-rust hover:bg-rust-soft">Delete all</button>
                </div>
              </div>
              <ul className="space-y-3">
                {results.map((r) => (
                  <li key={r.id} className="rounded-xl border border-line p-4 text-sm">
                    <p className="font-semibold">{r.order_ref} · {r.course_date} {r.course_time} · {r.status}</p>
                    <p className="text-ink-soft">{r.customer_name} · {r.customer_phone}{r.customer_email ? ` · ${r.customer_email}` : ""}</p>
                    <p className="text-ink-soft">{r.participants.map((p) => `${p.gender === "male" ? "M" : "F"} ${p.age}y ${p.weight_kg}kg ${p.swimmer ? "swimmer" : "non-swimmer"}`).join(" · ")}</p>
                    {r.special_requests && <p className="italic text-ink-soft">“{r.special_requests}”</p>}
                    <p className="text-xs text-ink-soft">Booked {new Date(r.created_at).toLocaleString("en-GB")} · waiver v{r.waiver_version}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
