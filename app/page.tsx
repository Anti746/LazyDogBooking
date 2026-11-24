"use client";

import { useEffect, useMemo, useState } from "react";
import { calcSurfLessonsPrice } from "@/lib/pricing";
import { maxHoursFrom, pickupTimes, rentalCharge } from "@/lib/board-rental";
import type { BoardType, RentalSettings } from "@/lib/board-rental";
import type { Course, CourseType } from "@/lib/types";

const TIME_SLOTS = ["08:00", "10:00"];

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
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

  // ── Form state ──────────────────────────────────────────────────────────
  const [date, setDate] = useState(todayPlus(1));
  const [time, setTime] = useState(TIME_SLOTS[0]);
  const [totalPeople, setTotalPeople] = useState(1);
  const [kids, setKids] = useState(0);
  const [nonSwimmers, setNonSwimmers] = useState(0);
  const [sharedCourse, setSharedCourse] = useState<CourseType>("teaser");
  const [perPerson, setPerPerson] = useState(false);
  const [swimmerCourses, setSwimmerCourses] = useState<CourseType[]>([]);

  const [wantsBoard, setWantsBoard] = useState(false);
  const [boardKey, setBoardKey] = useState("");
  const [boardQty, setBoardQty] = useState(1);
  const [boardPricing, setBoardPricing] = useState<"hourly" | "day">("hourly");
  const [boardStart, setBoardStart] = useState("");
  const [boardHours, setBoardHours] = useState(2);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [availability, setAvailability] = useState<{ free: number; cap: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ order_ref: string; total: number } | null>(null);

  const swimmers = Math.max(0, totalPeople - kids - nonSwimmers);

  useEffect(() => {
    setSwimmerCourses((prev) => {
      const next = Array.from({ length: swimmers }, (_, i) => prev[i] ?? sharedCourse);
      return next;
    });
  }, [swimmers, sharedCourse]);

  useEffect(() => {
    if (!boardTypes.length) return;
    if (!boardKey) setBoardKey(boardTypes[0].key);
  }, [boardTypes, boardKey]);

  useEffect(() => {
    if (!date) return;
    fetch(`/api/availability?date=${date}`).then((r) => r.json()).then((d) => {
      if (d && typeof d.free === "number") setAvailability({ free: d.free, cap: d.cap });
    }).catch(() => setAvailability(null));
  }, [date]);

  const courseTypesUsed: CourseType[] = useMemo(
    () => (perPerson ? swimmerCourses : Array.from({ length: swimmers }, () => sharedCourse)),
    [perPerson, swimmerCourses, swimmers, sharedCourse],
  );

  const price = useMemo(() => {
    if (!courses.length) return null;
    return calcSurfLessonsPrice(
      { numberOfPeople: totalPeople, numberOfKids: kids, numberOfNonSwimmers: nonSwimmers, swimmerCourseTypes: courseTypesUsed },
      courses,
    );
  }, [courses, totalPeople, kids, nonSwimmers, courseTypesUsed]);

  const boardMaxHours = settings ? maxHoursFrom(boardStart || settings.pickup_from, settings) : 10;
  const boardType = boardTypes.find((t) => t.key === boardKey);
  const boardPrice = wantsBoard && boardType
    ? rentalCharge({ pricing: boardPricing, quantity: boardQty, hours: boardHours, hourly_price: boardType.hourly_price, day_price: boardType.day_price })
    : 0;

  const grandTotal = (price?.total ?? 0) + boardPrice;

  async function submit() {
    setError(null);
    if (!firstName.trim() || !phone.trim()) {
      setError("Vyplňte meno a telefón.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { first_name: firstName, last_name: lastName, phone, email },
          course_date: date,
          course_time: time,
          number_of_people: totalPeople,
          number_of_kids: kids,
          number_of_non_swimmers: nonSwimmers,
          swimmer_course_types: courseTypesUsed,
          special_requests: notes,
          board_rental: wantsBoard
            ? { board_type: boardKey, quantity: boardQty, pricing: boardPricing, planned_start: boardStart || undefined, planned_hours: boardHours }
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nastala chyba, skúste to znova.");
        return;
      }
      setSuccess({ order_ref: data.reservation.order_ref, total: data.reservation.total_price + (data.boardRental?.amount ?? 0) });
    } catch {
      setError("Nepodarilo sa odoslať rezerváciu — skontrolujte pripojenie.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="mx-auto min-h-screen max-w-xl px-5 py-16 text-center">
        <h1 className="text-3xl font-bold text-brown-dark">🐾 Rezervácia prijatá!</h1>
        <p className="mt-4 text-ink-soft">
          Číslo objednávky <span className="font-semibold text-ink">{success.order_ref}</span>. Ozveme sa vám na potvrdenie.
        </p>
        <p className="mt-2 text-xl font-semibold">Celkom: {success.total.toLocaleString()} Rs</p>
        <button
          onClick={() => setSuccess(null)}
          className="mt-8 rounded-xl bg-brown px-5 py-3 font-semibold text-white hover:bg-brown-dark"
        >
          Nová rezervácia
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-brown-dark">🐶 Lazy Dog Surf</h1>
        <p className="mt-1 text-ink-soft">Rezervácia surfovej lekcie & požičanie dosky</p>
      </header>

      <Section title="1. Termín">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dátum">
            <input type="date" min={todayPlus(1)} value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </Field>
          <Field label="Čas">
            <select value={time} onChange={(e) => setTime(e.target.value)} className="input">
              {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        {availability && (
          <p className={`mt-2 text-sm font-semibold ${availability.free <= 0 ? "text-rust" : "text-sage"}`}>
            {availability.free <= 0 ? "Tento deň je už plne obsadený." : `Voľné miesta na tento deň: ${availability.free} / ${availability.cap}`}
          </p>
        )}
      </Section>

      <Section title="2. Počet osôb">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Spolu osôb">
            <input type="number" min={1} max={30} value={totalPeople} onChange={(e) => setTotalPeople(Math.max(1, Number(e.target.value)))} className="input" />
          </Field>
          <Field label="z toho deti">
            <input type="number" min={0} max={totalPeople} value={kids} onChange={(e) => setKids(Math.min(totalPeople, Math.max(0, Number(e.target.value))))} className="input" />
          </Field>
          <Field label="z toho neplavci">
            <input type="number" min={0} max={totalPeople - kids} value={nonSwimmers} onChange={(e) => setNonSwimmers(Math.min(totalPeople - kids, Math.max(0, Number(e.target.value))))} className="input" />
          </Field>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          Plavci, ktorí si vyberú kurz: <strong>{swimmers}</strong> · Neplavci idú automaticky na Súkromnú lekciu · 3+ dospelí = 10% zľava na lekcie.
        </p>
      </Section>

      <Section title="3. Výber kurzu pre plavcov">
        {swimmers === 0 ? (
          <p className="text-sm text-ink-soft">Nikto vo vašej skupine si nevyberá kurz (všetci sú deti alebo neplavci).</p>
        ) : (
          <>
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={perPerson} onChange={(e) => setPerPerson(e.target.checked)} />
              Každý plavec si vyberie iný kurz
            </label>
            {!perPerson ? (
              <Field label="Typ kurzu">
                <select value={sharedCourse} onChange={(e) => setSharedCourse(e.target.value as CourseType)} className="input">
                  {courses.filter((c) => c.type !== "kids" && c.type !== "private").map((c) => (
                    <option key={c.type} value={c.type}>{c.name} — {c.price.toLocaleString()} Rs/os.</option>
                  ))}
                </select>
              </Field>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: swimmers }).map((_, i) => (
                  <Field key={i} label={`Plavec ${i + 1}`}>
                    <select
                      value={swimmerCourses[i] ?? sharedCourse}
                      onChange={(e) => setSwimmerCourses((prev) => { const next = [...prev]; next[i] = e.target.value as CourseType; return next; })}
                      className="input"
                    >
                      {courses.filter((c) => c.type !== "kids" && c.type !== "private").map((c) => (
                        <option key={c.type} value={c.type}>{c.name} — {c.price.toLocaleString()} Rs</option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="4. Požičanie surfovej dosky (nepovinné)">
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={wantsBoard} onChange={(e) => setWantsBoard(e.target.checked)} />
          Chcem si aj požičať dosku
        </label>
        {wantsBoard && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Typ dosky">
              <select value={boardKey} onChange={(e) => setBoardKey(e.target.value)} className="input">
                {boardTypes.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Počet kusov">
              <input type="number" min={1} max={10} value={boardQty} onChange={(e) => setBoardQty(Math.max(1, Number(e.target.value)))} className="input" />
            </Field>
            <Field label="Spôsob účtovania">
              <select value={boardPricing} onChange={(e) => setBoardPricing(e.target.value as "hourly" | "day")} className="input">
                <option value="hourly">Na hodiny</option>
                <option value="day">Celý deň</option>
              </select>
            </Field>
            {boardPricing === "hourly" && (
              <>
                <Field label="Čas vyzdvihnutia">
                  <select value={boardStart} onChange={(e) => setBoardStart(e.target.value)} className="input">
                    <option value="">Vyberte</option>
                    {settings && pickupTimes(settings).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Počet hodín">
                  <input type="number" min={1} max={boardMaxHours} value={boardHours} onChange={(e) => setBoardHours(Math.max(1, Number(e.target.value)))} className="input" />
                </Field>
              </>
            )}
            {boardType && <p className="col-span-2 text-sm text-ink-soft">Cena za dosku: <strong>{boardPrice.toLocaleString()} Rs</strong></p>}
          </div>
        )}
      </Section>

      <Section title="5. Kontaktné údaje">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meno *"><input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" /></Field>
          <Field label="Priezvisko"><input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" /></Field>
          <Field label="Telefón *"><input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" /></Field>
          <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" /></Field>
        </div>
        <Field label="Poznámka">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} />
        </Field>
      </Section>

      {price && (
        <Section title="Zhrnutie ceny">
          <ul className="space-y-1 text-sm">
            {price.lines.map((l, i) => (
              <li key={i} className="flex justify-between">
                <span>{l.people}× {l.courseName}</span>
                <span>{l.amount.toLocaleString()} Rs{l.discount > 0 ? ` (−${l.discount.toLocaleString()})` : ""}</span>
              </li>
            ))}
            {wantsBoard && boardType && (
              <li className="flex justify-between">
                <span>{boardQty}× {boardType.name} ({boardPricing === "day" ? "celý deň" : `${boardHours} h`})</span>
                <span>{boardPrice.toLocaleString()} Rs</span>
              </li>
            )}
          </ul>
          <div className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-bold">
            <span>Spolu</span>
            <span>{grandTotal.toLocaleString()} Rs</span>
          </div>
        </Section>
      )}

      {error && <p className="mb-4 rounded-xl bg-rust-soft px-4 py-3 text-sm font-semibold text-rust">{error}</p>}

      <button
        onClick={submit}
        disabled={submitting || (availability?.free ?? 1) <= 0}
        className="w-full rounded-xl bg-brown py-4 text-lg font-bold text-white transition hover:bg-brown-dark disabled:opacity-50"
      >
        {submitting ? "Odosielam…" : "Odoslať rezerváciu"}
      </button>

      <p className="mt-6 text-center text-xs text-ink-soft">
        <a href="/admin" className="underline">Admin</a>
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-card border border-line bg-paper p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
