"use client";

import { useEffect, useMemo, useState } from "react";
import { calcSurfLessonsPrice } from "@/lib/pricing";
import { maxHoursFrom, pickupTimes, rentalCharge } from "@/lib/board-rental";
import type { BoardType, RentalSettings } from "@/lib/board-rental";
import type { Course, CourseType } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// One consolidated booking form (not a one-question-at-a-time wizard): every
// detail — group size, swimming ability, course per surfer, board rental,
// date & time — lives on a single screen with dropdowns. "Continue" moves to
// a second screen for contact details + confirmation.
//
// Visual language: organic modernism / tactile editorial — warm off-white
// base, near-black ink, a single signal-orange accent reserved for primary
// actions and active states, hairline borders instead of shadows, Space
// Grotesk for display type, JetBrains Mono for numbers/labels/statuses.
// ─────────────────────────────────────────────────────────────────────────────

type Stage = "details" | "contact" | "completed";
type BookingType = "surf" | "board";

interface DayInfo {
  booked: number;
  cap: number;
  free: number;
}

const TIME_SLOTS = ["08:00", "10:00"];
const COUNT_OPTIONS = Array.from({ length: 11 }, (_, i) => i); // 0..10

function todayStr(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BookingPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [boardTypes, setBoardTypes] = useState<BoardType[]>([]);
  const [settings, setSettings] = useState<RentalSettings | null>(null);

  useEffect(() => {
    fetch("/api/courses").then((r) => r.json()).then(setCourses);
    fetch("/api/board-types").then((r) => r.json()).then(setBoardTypes);
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  const [stage, setStage] = useState<Stage>("details");

  const [bookingType, setBookingType] = useState<BookingType>("surf");
  const [addBoard, setAddBoard] = useState(false);
  const wantsSurf = bookingType === "surf";
  const wantsBoard = bookingType === "board" || (bookingType === "surf" && addBoard);

  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);
  const [kidsAges, setKidsAges] = useState("");
  const [allSwimmers, setAllSwimmers] = useState<"" | "yes" | "no">("");
  const [nonSwimmers, setNonSwimmers] = useState(0);
  const [swimmerCourseTypes, setSwimmerCourseTypes] = useState<CourseType[]>([]);

  const [boardType, setBoardType] = useState("");
  const [boardQuantity, setBoardQuantity] = useState(1);
  const [boardPricing, setBoardPricing] = useState<"hourly" | "day">("hourly");
  const [boardStart, setBoardStart] = useState("");
  const [boardHours, setBoardHours] = useState(2);

  const [date, setDate] = useState("");
  const [time, setTime] = useState(TIME_SLOTS[0]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ order_ref: string; total: number } | null>(null);

  const [monthOffset, setMonthOffset] = useState(0);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [dayInfo, setDayInfo] = useState<Record<string, DayInfo>>({});

  // ── Defaults once data loads ─────────────────────────────────────────────
  const swimmerCourses = courses.filter((c) => c.type !== "kids" && c.type !== "private");
  useEffect(() => {
    if (boardTypes.length && !boardType) setBoardType(boardTypes[0].key);
  }, [boardTypes, boardType]);
  useEffect(() => {
    if (settings && !boardStart) setBoardStart(pickupTimes(settings)[0] ?? "09:00");
  }, [settings, boardStart]);

  const effectiveNonSwimmers = allSwimmers === "no" ? nonSwimmers : 0;
  const swimmersCount = Math.max(0, adults - effectiveNonSwimmers);

  // Keep the per-surfer course list in sync with the swimmer count.
  useEffect(() => {
    if (!swimmerCourses.length) return;
    setSwimmerCourseTypes((prev) => {
      const next = [...prev];
      while (next.length < swimmersCount) next.push(swimmerCourses[0].type);
      next.length = swimmersCount;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swimmersCount, swimmerCourses.length]);

  // ── Calendar data ──────────────────────────────────────────────────────────
  async function loadMonth(offset: number) {
    setLoadingCalendar(true);
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    try {
      const res = await fetch(`/api/availability?month=${month}`);
      const data = await res.json();
      setDayInfo(data.days ?? {});
    } catch {
      setDayInfo({});
    } finally {
      setLoadingCalendar(false);
    }
  }

  useEffect(() => {
    if (stage === "details") loadMonth(monthOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, monthOffset]);

  const monthDates = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset, 1);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const dates: string[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dt = new Date(d.getFullYear(), d.getMonth(), i);
      dates.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`);
    }
    return dates;
  }, [monthOffset]);

  function monthLabel(offset: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() + offset, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  const cap = settings?.max_students_per_day ?? 8;

  function selectDate(d: string) {
    if (d < todayStr(1)) return;
    if (wantsSurf) {
      const info = dayInfo[d];
      const free = info ? info.free : cap;
      if (free <= 0) return;
    }
    setDate(d);
  }

  // ── Price summary ────────────────────────────────────────────────────────
  const totalPeople = adults + kids;
  const price = useMemo(() => {
    if (!courses.length || !wantsSurf) return null;
    return calcSurfLessonsPrice(
      {
        numberOfPeople: Math.max(1, totalPeople),
        numberOfKids: kids,
        numberOfNonSwimmers: effectiveNonSwimmers,
        swimmerCourseTypes,
      },
      courses,
    );
  }, [courses, wantsSurf, totalPeople, kids, effectiveNonSwimmers, swimmerCourseTypes]);

  const boardTypeObj = boardTypes.find((t) => t.key === boardType);
  const boardPrice = wantsBoard && boardTypeObj
    ? rentalCharge({ pricing: boardPricing, quantity: boardQuantity, hours: boardHours, hourly_price: boardTypeObj.hourly_price, day_price: boardTypeObj.day_price })
    : 0;
  const grandTotal = (price?.total ?? 0) + boardPrice;

  // ── Validation for the details screen ───────────────────────────────────
  const detailsReady =
    !!date &&
    (!wantsSurf || totalPeople >= 1) &&
    (!wantsSurf || adults === 0 || allSwimmers !== "") &&
    (!wantsBoard || !!boardType);

  function summaryLines(): string[] {
    const lines: string[] = [];
    if (wantsSurf && price) {
      price.lines.forEach((l) => {
        lines.push(`${l.people}x ${l.courseName} — ${l.amount.toLocaleString()} Rs${l.discount > 0 ? ` (-${l.discount.toLocaleString()} group discount)` : ""}`);
      });
      if (kids > 0 && kidsAges) lines.push(`Children's ages: ${kidsAges}`);
      lines.push(`Lesson: ${date} at ${time}`);
    }
    if (wantsBoard && boardTypeObj) {
      lines.push(`Board rental: ${boardQuantity}x ${boardTypeObj.name} (${boardPricing === "day" ? "full day" : `${boardHours}h from ${boardStart}`}) — ${boardPrice.toLocaleString()} Rs`);
      if (!wantsSurf) lines.push(`Date: ${date}`);
    }
    return lines;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function submit() {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const notesParts = [notes, kids > 0 && kidsAges ? `Children's ages: ${kidsAges}` : ""].filter(Boolean);
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { first_name: name, last_name: "", phone, email },
          course_date: date,
          course_time: time,
          number_of_people: wantsSurf ? Math.max(1, totalPeople) : 1,
          number_of_kids: wantsSurf ? kids : 0,
          number_of_non_swimmers: wantsSurf ? effectiveNonSwimmers : 0,
          swimmer_course_types: swimmerCourseTypes,
          special_requests: notesParts.join(" | "),
          board_rental: wantsBoard
            ? { board_type: boardType, quantity: boardQuantity, pricing: boardPricing, planned_start: boardStart || undefined, planned_hours: boardHours }
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong. Please try again.");
        return;
      }
      setConfirmation({ order_ref: data.reservation.order_ref, total: data.reservation.total_price + (data.boardRental?.amount ?? 0) });
      setStage("completed");
    } catch {
      setErrorMsg("Could not submit — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setBookingType("surf"); setAddBoard(false);
    setAdults(1); setKids(0); setKidsAges(""); setAllSwimmers(""); setNonSwimmers(0); setSwimmerCourseTypes([]);
    setBoardType(boardTypes[0]?.key ?? ""); setBoardQuantity(1); setBoardPricing("hourly"); setBoardStart(""); setBoardHours(2);
    setDate(""); setTime(TIME_SLOTS[0]);
    setName(""); setPhone(""); setEmail(""); setNotes("");
    setConfirmation(null); setErrorMsg(null);
    setStage("details");
  }

  const selectCls = "w-full rounded-md border border-line2 bg-white px-3 py-2 text-sm text-slate outline-none transition-colors focus:border-accent";
  const labelCls = "mb-1.5 block font-mono2 text-[10px] font-semibold uppercase tracking-widest text-slate-soft";

  return (
    <div className="min-h-screen bg-surface font-sans2 text-slate">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="overflow-hidden rounded-tl-[32px] rounded-br-[32px] border border-line2 bg-white">
          {/* ── Unified header strip (same window as the form) ───────────── */}
          <div className="flex items-center justify-between border-b border-line2 px-6 py-5">
            <div>
              <h1 className="font-heading text-2xl font-bold leading-none tracking-tight text-slate">LazyDog Surf</h1>
              <p className="mt-1 font-mono2 text-[10px] uppercase tracking-[0.2em] text-slate-soft">Goa · India</p>
            </div>
            <span className="font-mono2 text-[11px] uppercase tracking-widest text-slate-soft">
              {stage === "details" ? "Booking" : stage === "contact" ? "Your details" : "Done"}
            </span>
          </div>

          {stage === "completed" ? (
            <div className="space-y-4 px-8 py-14 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-ink">
                <span className="font-heading text-2xl font-bold text-accent">✓</span>
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate">Booking Requested</h2>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-soft">
                We'll confirm shortly{confirmation ? ` — your reference is #${confirmation.order_ref}` : ""}.
              </p>
              {confirmation && (
                <p className="font-mono2 text-lg font-semibold text-slate">
                  Total <span className="text-accent">{confirmation.total.toLocaleString()} Rs</span>
                </p>
              )}
              <button onClick={resetAll} className="mt-2 rounded-md bg-slate px-6 py-2.5 font-sans2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent">
                Make Another Booking
              </button>
            </div>
          ) : stage === "details" ? (
            <div className="space-y-7 p-6">
              {/* Booking type */}
              <div>
                <span className={labelCls}>What would you like to book?</span>
                <div className="flex gap-2">
                  {(["surf", "board"] as BookingType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setBookingType(t)}
                      className={`flex-1 rounded-md border px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${
                        bookingType === t ? "border-accent bg-accent text-white" : "border-line2 text-slate hover:border-accent hover:text-accent"
                      }`}
                    >
                      {t === "surf" ? "Surf Lesson" : "Board Rental"}
                    </button>
                  ))}
                </div>
              </div>

              {wantsSurf && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className={labelCls}>Adults</span>
                    <select className={selectCls} value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
                      {COUNT_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className={labelCls}>Children</span>
                    <select className={selectCls} value={kids} onChange={(e) => setKids(Number(e.target.value))}>
                      {COUNT_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {wantsSurf && kids > 0 && (
                <div>
                  <span className={labelCls}>Children's ages</span>
                  <input className={selectCls} placeholder="e.g. 6, 9" value={kidsAges} onChange={(e) => setKidsAges(e.target.value)} />
                </div>
              )}

              {wantsSurf && adults > 0 && (
                <div>
                  <span className={labelCls}>{adults === 1 ? "Are you a swimmer?" : `Are all ${adults} adults swimmers?`}</span>
                  <div className="flex gap-2">
                    {(["yes", "no"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => { setAllSwimmers(v); if (v === "yes") setNonSwimmers(0); else if (adults === 1) setNonSwimmers(1); }}
                        className={`flex-1 rounded-md border px-4 py-2.5 text-sm font-semibold capitalize transition-all duration-150 ${
                          allSwimmers === v ? "border-accent bg-accent text-white" : "border-line2 text-slate hover:border-accent hover:text-accent"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {wantsSurf && allSwimmers === "no" && adults > 1 && (
                <div>
                  <span className={labelCls}>How many of the {adults} adults are non-swimmers? (Private Lesson)</span>
                  <select className={selectCls} value={nonSwimmers} onChange={(e) => setNonSwimmers(Number(e.target.value))}>
                    {Array.from({ length: adults }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              )}

              {wantsSurf && swimmersCount > 0 && (
                <div className="space-y-3">
                  <span className={labelCls}>Course {swimmersCount > 1 ? "per surfer" : ""}</span>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {Array.from({ length: swimmersCount }).map((_, i) => (
                      <div key={i}>
                        {swimmersCount > 1 && <span className="mb-1 block font-mono2 text-[10px] text-slate-soft">Surfer {i + 1}</span>}
                        <select
                          className={selectCls}
                          value={swimmerCourseTypes[i] ?? ""}
                          onChange={(e) => setSwimmerCourseTypes((prev) => prev.map((c, j) => j === i ? e.target.value as CourseType : c))}
                        >
                          {swimmerCourses.map((c) => <option key={c.id} value={c.type}>{c.name} — {c.price.toLocaleString()} Rs</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {wantsSurf && (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate">
                  <input type="checkbox" checked={addBoard} onChange={(e) => setAddBoard(e.target.checked)} className="h-4 w-4 accent-[#FF4D1C]" />
                  Also rent a board
                </label>
              )}

              {wantsBoard && (
                <div className="space-y-4 rounded-xl border border-line2 bg-surface p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className={labelCls}>Board type</span>
                      <select className={selectCls} value={boardType} onChange={(e) => setBoardType(e.target.value)}>
                        {boardTypes.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <span className={labelCls}>Quantity</span>
                      <select className={selectCls} value={boardQuantity} onChange={(e) => setBoardQuantity(Number(e.target.value))}>
                        {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <span className={labelCls}>Pricing</span>
                    <div className="flex gap-2">
                      {(["hourly", "day"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setBoardPricing(p)}
                          className={`flex-1 rounded-md border px-4 py-2 text-sm font-semibold transition-all duration-150 ${
                            boardPricing === p ? "border-accent bg-accent text-white" : "border-line2 text-slate hover:border-accent hover:text-accent"
                          }`}
                        >
                          {p === "hourly" ? "By the hour" : "Full day"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {boardPricing === "hourly" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className={labelCls}>Pickup time</span>
                        <select className={selectCls} value={boardStart} onChange={(e) => setBoardStart(e.target.value)}>
                          {(settings ? pickupTimes(settings) : []).map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <span className={labelCls}>Hours</span>
                        <select className={selectCls} value={boardHours} onChange={(e) => setBoardHours(Number(e.target.value))}>
                          {Array.from({ length: settings ? maxHoursFrom(boardStart, settings) : 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Date & time */}
              <div>
                <span className={labelCls}>Date</span>
                {loadingCalendar ? (
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: 35 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-md bg-surface2" />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <button onClick={() => setMonthOffset((m) => Math.max(0, m - 1))} disabled={monthOffset === 0} className="rounded-md border border-line2 p-1.5 font-mono2 text-slate transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-30">←</button>
                      <h3 className="font-mono2 text-xs font-semibold uppercase tracking-widest text-slate">{monthLabel(monthOffset)}</h3>
                      <button onClick={() => setMonthOffset((m) => Math.min(11, m + 1))} disabled={monthOffset >= 11} className="rounded-md border border-line2 p-1.5 font-mono2 text-slate transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-30">→</button>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5 text-center font-mono2 text-[10px] uppercase tracking-wide text-slate-soft">
                      {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {monthDates.length > 0 && Array.from({ length: (new Date(monthDates[0] + "T00:00:00").getDay() + 6) % 7 }).map((_, i) => <div key={`e${i}`} />)}
                      {monthDates.map((d) => {
                        const info = dayInfo[d];
                        const free = info ? info.free : cap;
                        const isPast = d < todayStr(1);
                        const isFull = wantsSurf && free <= 0;
                        const disabled = isPast || isFull;
                        const isLow = !disabled && free <= 3 && wantsSurf;
                        const isToday = d === todayStr();
                        const isSelected = d === date;
                        const day = Number(d.slice(-2));
                        let cls = "group relative aspect-square flex flex-col items-center justify-center rounded-md border font-mono2 text-xs font-medium transition-all duration-150 ";
                        if (disabled) cls += "border-transparent bg-surface2 text-slate-soft/40 line-through cursor-not-allowed";
                        else if (isSelected) cls += "border-accent bg-accent text-white";
                        else if (isToday) cls += "border-accent text-accent hover:-translate-y-0.5";
                        else cls += "border-line2 text-slate hover:-translate-y-0.5 hover:border-accent hover:text-accent";
                        return (
                          <button key={d} type="button" disabled={disabled} onClick={() => selectDate(d)} className={cls}>
                            <span>{day}</span>
                            {!disabled && wantsSurf && <span className={`mt-0.5 text-[8px] leading-none ${isLow && !isSelected ? "text-accent" : "opacity-60"}`}>{free}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {wantsSurf && (
                <div>
                  <span className={labelCls}>Lesson time</span>
                  <select className={selectCls} value={time} onChange={(e) => setTime(e.target.value)}>
                    {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {wantsSurf && price && price.total > 0 && (
                <p className="font-mono2 text-sm text-slate-soft">
                  Estimated total: <span className="font-semibold text-slate">{(price.total + boardPrice).toLocaleString()} Rs</span>
                </p>
              )}

              <button
                onClick={() => setStage("contact")}
                disabled={!detailsReady}
                className="w-full rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-slate disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
              {!detailsReady && <p className="text-center text-xs text-slate-soft">Pick a date{wantsSurf && adults > 0 && allSwimmers === "" ? " and answer the swimmer question" : ""} to continue.</p>}
            </div>
          ) : (
            <div className="space-y-5 p-6">
              <div className="space-y-4">
                <div>
                  <span className={labelCls}>Full name</span>
                  <input className={selectCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoFocus />
                </div>
                <div>
                  <span className={labelCls}>Phone</span>
                  <input className={selectCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone / WhatsApp number" />
                </div>
                <div>
                  <span className={labelCls}>Email (optional)</span>
                  <input className={selectCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
                </div>
                <div>
                  <span className={labelCls}>Notes (optional)</span>
                  <textarea className={`${selectCls} min-h-[72px]`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything we should know..." />
                </div>
              </div>

              <div className="space-y-1 rounded-xl border border-line2 bg-surface p-4 font-mono2 text-xs text-slate-soft">
                {summaryLines().map((l, i) => <p key={i}>{l}</p>)}
                <p className="pt-1 text-sm font-semibold text-slate">Total: <span className="text-accent">{grandTotal.toLocaleString()} Rs</span></p>
              </div>

              {errorMsg && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{errorMsg}</p>}

              <div className="flex gap-2">
                <button onClick={() => setStage("details")} className="rounded-md border border-line2 px-4 py-2.5 text-sm font-semibold text-slate-soft transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-soft hover:text-slate">
                  ← Back
                </button>
                <button
                  onClick={submit}
                  disabled={submitting || !name.trim() || !phone.trim()}
                  className="flex-1 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-slate disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? "Submitting…" : "Confirm Booking"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
