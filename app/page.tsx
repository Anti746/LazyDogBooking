"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_PEOPLE_PER_BOOKING, TIME_SLOTS, WEIGHT_MAX, WEIGHT_MIN, ageRange, calcPrice, GROUP_DISCOUNT_MIN_ADULTS } from "@/lib/booking";
import { WAIVER_CHECKBOX_LABEL, WAIVER_CLAUSES, WAIVER_TITLE, WAIVER_VERSION } from "@/lib/waiver";
import type { PriceBreakdown } from "@/lib/booking";
import type { Course, Gender, Participant } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Two screens, one card:
//   1) details — who's coming (one card per person: gender, age, weight,
//                swimmer / non-swimmer), date and time
//   2) contact — name / phone / email / notes, summary, liability waiver
// One product only: the 1 Day Surf Course, priced per person, 10% off the
// adults when 3+ adults book together (lib/booking.ts).
// ─────────────────────────────────────────────────────────────────────────────

type Stage = "details" | "contact" | "completed";

interface DayInfo { booked: number; cap: number; free: number }

/** A participant while the form is being filled in — every field starts empty. */
interface Draft {
  group: Participant["group"];
  gender: Gender | null;
  age: number | null;
  weight_kg: number | null;
  swimmer: boolean | null;
}

const COUNT_OPTIONS = Array.from({ length: MAX_PEOPLE_PER_BOOKING + 1 }, (_, i) => i); // 0..8
const WEIGHT_OPTIONS = Array.from({ length: (WEIGHT_MAX - WEIGHT_MIN) / 5 + 1 }, (_, i) => WEIGHT_MIN + i * 5); // 15, 20 … 150
const WINDOW_DAYS = 28;

function todayStr(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function prettyDate(s: string): string {
  return new Date(s + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function emptyDraft(group: Participant["group"]): Draft {
  return { group, gender: null, age: null, weight_kg: null, swimmer: null };
}

function missingField(p: Draft): string | null {
  if (!p.gender) return "gender";
  if (p.age === null) return "age";
  if (p.weight_kg === null) return "weight";
  if (p.swimmer === null) return "swimmer / non-swimmer";
  return null;
}

function Toggle<T extends string | boolean>({ value, options, onChange, bad }: { value: T | null; options: { v: T; label: string }[]; onChange: (v: T) => void; bad?: boolean }) {
  return (
    <div className={`flex rounded-md border p-0.5 ${bad ? "border-red-400" : "border-line2"}`}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={`flex-1 rounded-[5px] px-3 py-2 text-sm font-semibold transition-all duration-150 ${
            value === o.v ? "bg-slate text-white" : "text-slate-soft hover:text-slate"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PriceLines({ price, unit }: { price: PriceBreakdown; unit: number }) {
  return (
    <>
      {price.adults > 0 && <p>{price.adults} adult{price.adults > 1 ? "s" : ""} × {unit.toLocaleString()} Rs = {(price.adults * unit).toLocaleString()} Rs</p>}
      {price.children > 0 && <p>{price.children} child{price.children > 1 ? "ren" : ""} × {unit.toLocaleString()} Rs = {(price.children * unit).toLocaleString()} Rs</p>}
      {price.discount > 0 && <p className="text-accent">Group discount (10% off adults) −{price.discount.toLocaleString()} Rs</p>}
      <p className="pt-1 text-sm font-semibold text-slate">Total <span className="text-accent">{price.total.toLocaleString()} Rs</span></p>
    </>
  );
}

export default function BookingPage() {
  const [course, setCourse] = useState<Course | null>(null);
  useEffect(() => {
    fetch("/api/courses").then((r) => r.json()).then(setCourse).catch(() => setCourse(null));
  }, []);

  const [stage, setStage] = useState<Stage>("details");
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => { topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [stage]);

  // ── People ──────────────────────────────────────────────────────────────
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);
  const [people, setPeople] = useState<Draft[]>([emptyDraft("adult")]);

  // Keep one card per person in sync with the two counters, preserving what's
  // already filled in for people who stay.
  useEffect(() => {
    setPeople((prev) => {
      const prevAdults = prev.filter((p) => p.group === "adult");
      const prevKids = prev.filter((p) => p.group === "child");
      const a = Array.from({ length: adults }, (_, i) => prevAdults[i] ?? emptyDraft("adult"));
      const k = Array.from({ length: kids }, (_, i) => prevKids[i] ?? emptyDraft("child"));
      return [...a, ...k];
    });
  }, [adults, kids]);

  function updatePerson(i: number, patch: Partial<Draft>) {
    setPeople((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  const headcount = adults + kids;

  // ── Date & time ─────────────────────────────────────────────────────────
  const [date, setDate] = useState("");
  const [time, setTime] = useState<string>("");
  const [page, setPage] = useState(0);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [dayInfo, setDayInfo] = useState<Record<string, DayInfo>>({});
  const [cap, setCap] = useState(8);

  // Rolling 4-week window starting tomorrow — past days are never shown.
  const windowDates = useMemo(
    () => Array.from({ length: WINDOW_DAYS }, (_, i) => todayStr(1 + page * WINDOW_DAYS + i)),
    [page],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingCalendar(true);
    const months = Array.from(new Set(windowDates.map((d) => d.slice(0, 7))));
    Promise.all(months.map((m) => fetch(`/api/availability?month=${m}`).then((r) => r.json())))
      .then((results) => {
        if (cancelled) return;
        setDayInfo(Object.assign({}, ...results.map((r) => r.days ?? {})));
        if (results[0]?.cap) setCap(results[0].cap);
      })
      .catch(() => { if (!cancelled) setDayInfo({}); })
      .finally(() => { if (!cancelled) setLoadingCalendar(false); });
    return () => { cancelled = true; };
  }, [windowDates]);

  const freeOn = (d: string) => dayInfo[d]?.free ?? cap;

  // A previously picked day may no longer fit if the group grew.
  useEffect(() => {
    if (date && freeOn(date) < headcount) setDate("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headcount]);

  function windowLabel(): string {
    const fmt = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${fmt(windowDates[0])} – ${fmt(windowDates[windowDates.length - 1])}`;
  }

  // ── Contact & waiver ────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [waiverAccepted, setWaiverAccepted] = useState(false);

  // ── Validation & submit ─────────────────────────────────────────────────
  const [showErrors, setShowErrors] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<string | null>(null);
  const [contactMsg, setContactMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ order_ref: string; total: number } | null>(null);

  useEffect(() => { setDetailsMsg(null); }, [people, date, time]);
  useEffect(() => { setContactMsg(null); }, [name, phone, waiverAccepted]);

  const price = calcPrice(people.map((p) => p.group), course?.price ?? 0);

  function personLabel(i: number): string {
    const p = people[i];
    const n = people.slice(0, i + 1).filter((x) => x.group === p.group).length;
    return `${p.group === "adult" ? "Adult" : "Child"} ${n}`;
  }

  function goToContact() {
    setShowErrors(true);
    if (headcount === 0) return setDetailsMsg("Add at least one adult or child.");
    const badIndex = people.findIndex((p) => missingField(p) !== null);
    if (badIndex >= 0) {
      document.getElementById(`person-${badIndex}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return setDetailsMsg(`${personLabel(badIndex)}: please choose ${missingField(people[badIndex])}.`);
    }
    if (!date) {
      document.getElementById("date-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return setDetailsMsg("Please pick a date.");
    }
    if (!time) return setDetailsMsg("Please pick a lesson time.");
    setShowErrors(false);
    setStage("contact");
  }

  async function submit() {
    if (!name.trim() || !phone.trim()) return setContactMsg("Please fill in your name and phone number.");
    if (!waiverAccepted) return setContactMsg("Please read and accept the liability waiver to continue.");
    setSubmitting(true);
    setContactMsg(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { first_name: name, last_name: "", phone, email },
          course_date: date,
          course_time: time,
          participants: people,
          special_requests: notes,
          waiver_accepted: waiverAccepted,
          waiver_version: WAIVER_VERSION,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setContactMsg(data.error || "Something went wrong. Please try again.");
      setConfirmation({ order_ref: data.reservation.order_ref, total: data.reservation.total_price });
      setStage("completed");
    } catch {
      setContactMsg("Could not submit — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setAdults(1); setKids(0); setPeople([emptyDraft("adult")]);
    setDate(""); setTime(""); setPage(0);
    setName(""); setPhone(""); setEmail(""); setNotes(""); setWaiverAccepted(false);
    setShowErrors(false); setDetailsMsg(null); setContactMsg(null); setConfirmation(null);
    setStage("details");
  }

  // ── Styling helpers ─────────────────────────────────────────────────────
  const fieldCls = "w-full rounded-md border bg-white px-3 py-2.5 text-sm text-slate outline-none transition-colors focus:border-accent";
  const labelCls = "mb-1.5 block font-mono2 text-[10px] font-semibold uppercase tracking-widest text-slate-soft";
  const errBorder = (bad: boolean) => (bad ? "border-red-400" : "border-line2");

  const stageLabel = stage === "details" ? "1 / 2 · Booking" : stage === "contact" ? "2 / 2 · Your details" : "Done";

  return (
    <div className="min-h-screen bg-surface font-sans2 text-slate">
      <div ref={topRef} className="mx-auto max-w-2xl px-4 py-8 sm:px-5 sm:py-10">
        <div className="overflow-hidden rounded-tl-[32px] rounded-br-[32px] border border-line2 bg-white">
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-b border-line2 px-6 py-5">
            <div>
              <h1 className="font-heading text-2xl font-bold leading-none tracking-tight text-slate">LazyDog Surf</h1>
              <p className="mt-1 font-mono2 text-[10px] uppercase tracking-[0.2em] text-slate-soft">Goa · India</p>
            </div>
            <span className="font-mono2 text-[11px] uppercase tracking-widest text-slate-soft">{stageLabel}</span>
          </div>

          {/* ── 1) DETAILS ─────────────────────────────────────────────── */}
          {stage === "details" && (
            <div className="space-y-7 p-6">
              <div className="flex items-baseline justify-between rounded-xl border border-line2 bg-surface px-4 py-3">
                <span className="font-heading text-lg font-bold">{course?.name ?? "1 Day Surf Course"}</span>
                <span className="font-mono2 text-sm font-semibold text-accent">{course ? `${course.price.toLocaleString()} Rs / person` : "…"}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className={labelCls}>Adults (18+)</span>
                  <select className={`${fieldCls} border-line2`} value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
                    {COUNT_OPTIONS.filter((n) => n + kids <= MAX_PEOPLE_PER_BOOKING).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <span className={labelCls}>Children (5–17)</span>
                  <select className={`${fieldCls} border-line2`} value={kids} onChange={(e) => setKids(Number(e.target.value))}>
                    {COUNT_OPTIONS.filter((n) => n + adults <= MAX_PEOPLE_PER_BOOKING).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              {people.length > 0 && (
                <div className="space-y-3">
                  {people.map((p, i) => {
                    const [ageMin, ageMax] = ageRange(p.group);
                    return (
                      <div key={`${p.group}-${i}`} id={`person-${i}`} className="space-y-3 rounded-xl border border-line2 p-4">
                        <p className="font-heading text-base font-bold">{personLabel(i)}</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <span className={labelCls}>Gender</span>
                            <Toggle
                              value={p.gender}
                              bad={showErrors && !p.gender}
                              onChange={(v) => updatePerson(i, { gender: v })}
                              options={[{ v: "male", label: "Male" }, { v: "female", label: "Female" }]}
                            />
                          </div>
                          <div>
                            <span className={labelCls}>Swimming</span>
                            <Toggle
                              value={p.swimmer}
                              bad={showErrors && p.swimmer === null}
                              onChange={(v) => updatePerson(i, { swimmer: v })}
                              options={[{ v: true, label: "Swimmer" }, { v: false, label: "Non-swimmer" }]}
                            />
                          </div>
                          <div>
                            <span className={labelCls}>Age</span>
                            <select
                              className={`${fieldCls} ${errBorder(showErrors && p.age === null)}`}
                              value={p.age ?? ""}
                              onChange={(e) => updatePerson(i, { age: e.target.value === "" ? null : Number(e.target.value) })}
                            >
                              <option value="">Select age</option>
                              {Array.from({ length: ageMax - ageMin + 1 }, (_, k) => ageMin + k).map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                          <div>
                            <span className={labelCls}>Weight</span>
                            <select
                              className={`${fieldCls} ${errBorder(showErrors && p.weight_kg === null)}`}
                              value={p.weight_kg ?? ""}
                              onChange={(e) => updatePerson(i, { weight_kg: e.target.value === "" ? null : Number(e.target.value) })}
                            >
                              <option value="">Select weight</option>
                              {WEIGHT_OPTIONS.map((n) => <option key={n} value={n}>{n} kg</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Date — rolling 4 weeks from tomorrow */}
              <div id="date-section">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={labelCls}>Date</span>
                  {date && <span className="rounded-md bg-accent-ink px-2 py-0.5 font-mono2 text-[11px] font-semibold text-accent">{prettyDate(date)}</span>}
                </div>
                <div className={`space-y-3 rounded-xl border p-3 ${errBorder(showErrors && !date)}`}>
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => setPage((m) => Math.max(0, m - 1))} disabled={page === 0} className="rounded-md border border-line2 px-2.5 py-1 font-mono2 text-slate transition-all hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-30">←</button>
                    <h3 className="font-mono2 text-xs font-semibold uppercase tracking-widest text-slate">{windowLabel()}</h3>
                    <button type="button" onClick={() => setPage((m) => Math.min(12, m + 1))} disabled={page >= 12} className="rounded-md border border-line2 px-2.5 py-1 font-mono2 text-slate transition-all hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-30">→</button>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 text-center font-mono2 text-[10px] uppercase tracking-wide text-slate-soft">
                    {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <div key={d}>{d}</div>)}
                  </div>
                  {loadingCalendar ? (
                    <div className="grid grid-cols-7 gap-1.5">
                      {Array.from({ length: WINDOW_DAYS }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-md bg-surface2" />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-7 gap-1.5">
                      {Array.from({ length: (new Date(windowDates[0] + "T00:00:00").getDay() + 6) % 7 }).map((_, i) => <div key={`e${i}`} />)}
                      {windowDates.map((d) => {
                        const free = freeOn(d);
                        const disabled = free < Math.max(1, headcount);
                        const isSelected = d === date;
                        const dayNum = Number(d.slice(-2));
                        const monthShort = dayNum === 1 ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { month: "short" }) : null;
                        let cls = "relative flex aspect-square flex-col items-center justify-center rounded-md border font-mono2 text-xs font-medium transition-all duration-150 ";
                        if (disabled) cls += "cursor-not-allowed border-transparent bg-surface2 text-slate-soft/40";
                        else if (isSelected) cls += "border-accent bg-accent text-white ring-2 ring-accent ring-offset-2";
                        else cls += "border-line2 text-slate hover:-translate-y-0.5 hover:border-accent hover:text-accent";
                        return (
                          <button key={d} type="button" disabled={disabled} onClick={() => setDate(d)} className={cls} title={disabled ? "Not enough free spots" : `${free} spot(s) left`}>
                            {isSelected && <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate text-[9px] font-bold text-white">✓</span>}
                            <span>{dayNum}</span>
                            <span className={`mt-0.5 text-[8px] leading-none ${isSelected ? "text-white/80" : "opacity-60"}`}>{monthShort ?? (disabled ? "full" : `${free} left`)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <span className={labelCls}>Lesson time</span>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_SLOTS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTime(t)}
                      className={`rounded-md border px-4 py-3 font-mono2 text-sm font-semibold transition-all duration-150 ${
                        time === t ? "border-accent bg-accent text-white" : `${errBorder(showErrors && !time)} text-slate hover:border-accent hover:text-accent`
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {course && headcount > 0 && (
                <div className="space-y-1 rounded-xl border border-line2 bg-surface px-4 py-3 font-mono2 text-xs text-slate-soft">
                  <PriceLines price={price} unit={course.price} />
                  {price.discount === 0 && adults > 0 && adults < GROUP_DISCOUNT_MIN_ADULTS && (
                    <p className="text-[11px]">Book {GROUP_DISCOUNT_MIN_ADULTS}+ adults together and adults get 10% off.</p>
                  )}
                </div>
              )}

              {detailsMsg && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-600">{detailsMsg}</p>}

              <button onClick={goToContact} className="w-full rounded-md bg-accent px-5 py-4 text-base font-bold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-slate">
                Continue →
              </button>
            </div>
          )}

          {/* ── 2) CONTACT + WAIVER ────────────────────────────────────── */}
          {stage === "contact" && (
            <div className="space-y-6 p-6">
              <div className="space-y-4">
                <div>
                  <span className={labelCls}>Full name</span>
                  <input className={`${fieldCls} ${errBorder(!!contactMsg && !name.trim())}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoComplete="name" />
                </div>
                <div>
                  <span className={labelCls}>Phone / WhatsApp</span>
                  <input className={`${fieldCls} ${errBorder(!!contactMsg && !phone.trim())}`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" type="tel" autoComplete="tel" />
                </div>
                <div>
                  <span className={labelCls}>Email (optional)</span>
                  <input className={`${fieldCls} border-line2`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" type="email" autoComplete="email" />
                </div>
                <div>
                  <span className={labelCls}>Notes (optional)</span>
                  <textarea className={`${fieldCls} min-h-[72px] border-line2`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Injuries, medical conditions, anything we should know…" />
                </div>
              </div>

              <div className="space-y-1.5 rounded-xl border border-line2 bg-surface p-4 font-mono2 text-xs text-slate-soft">
                <p className="text-sm font-semibold text-slate">{course?.name} · {prettyDate(date)} · {time}</p>
                {people.map((p, i) => (
                  <p key={i}>
                    {personLabel(i)} — {p.gender === "male" ? "Male" : "Female"}, {p.age} y, {p.weight_kg} kg, {p.swimmer ? "swimmer" : "non-swimmer"}
                  </p>
                ))}
                <div className="pt-1"><PriceLines price={price} unit={course?.price ?? 0} /></div>
              </div>

              {/* Liability waiver */}
              <div className="space-y-3">
                <span className={labelCls}>Liability waiver</span>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-line2 bg-white p-4 text-xs leading-relaxed text-slate-soft">
                  <p className="mb-3 font-heading text-sm font-bold text-slate">{WAIVER_TITLE}</p>
                  <ol className="list-decimal space-y-2 pl-4">
                    {WAIVER_CLAUSES.map((c, i) => <li key={i}>{c}</li>)}
                  </ol>
                  <p className="mt-3 font-mono2 text-[10px] uppercase tracking-widest">Version {WAIVER_VERSION}</p>
                </div>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition-colors ${waiverAccepted ? "border-accent bg-accent-ink" : errBorder(!!contactMsg && !waiverAccepted)}`}>
                  <input type="checkbox" checked={waiverAccepted} onChange={(e) => setWaiverAccepted(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#FF4D1C]" />
                  <span className="font-semibold text-slate">{WAIVER_CHECKBOX_LABEL}</span>
                </label>
              </div>

              {contactMsg && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-600">{contactMsg}</p>}

              <div className="flex gap-2">
                <button onClick={() => setStage("details")} className="rounded-md border border-line2 px-4 py-4 text-sm font-semibold text-slate-soft transition-all hover:-translate-y-0.5 hover:border-slate-soft hover:text-slate">
                  ← Back
                </button>
                <button onClick={submit} disabled={submitting} className="flex-1 rounded-md bg-accent px-5 py-4 text-base font-bold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-slate disabled:cursor-wait disabled:opacity-70">
                  {submitting ? "Submitting…" : "Confirm Booking"}
                </button>
              </div>
            </div>
          )}

          {/* ── 3) DONE ────────────────────────────────────────────────── */}
          {stage === "completed" && (
            <div className="space-y-4 px-8 py-14 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-ink">
                <span className="font-heading text-2xl font-bold text-accent">✓</span>
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate">Booking Requested</h2>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-soft">
                We&apos;ll confirm shortly{confirmation ? ` — your reference is #${confirmation.order_ref}` : ""}.
              </p>
              {confirmation && (
                <p className="font-mono2 text-lg font-semibold text-slate">
                  Total <span className="text-accent">{confirmation.total.toLocaleString()} Rs</span>
                </p>
              )}
              <button onClick={resetAll} className="mt-2 rounded-md bg-slate px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent">
                Make Another Booking
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
