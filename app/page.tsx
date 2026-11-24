"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calcSurfLessonsPrice } from "@/lib/pricing";
import { maxHoursFrom, pickupTimes, rentalCharge } from "@/lib/board-rental";
import type { BoardType, RentalSettings } from "@/lib/board-rental";
import type { Course, CourseType } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// A single-question booking wizard, in the style of the Surf Wala booking
// chatbot: one question card at a time, driven by a step machine, with a
// progress bar, option buttons, an inline calendar for date picking, and a
// text input for free-form answers (name/phone/email/notes).
//
// Visual language: organic modernism / tactile editorial — warm off-white
// base, near-black ink, a single signal-orange accent reserved for primary
// actions and active states, hairline borders instead of shadows, Space
// Grotesk for display type, JetBrains Mono for numbers/labels/statuses.
// ─────────────────────────────────────────────────────────────────────────────

type Step =
  | "booking_type"
  | "adults_count"
  | "adults_count_custom"
  | "kids_count"
  | "kids_count_custom"
  | "kids_ages"
  | "swim_all"
  | "non_swimmer_count"
  | "course_type"
  | "board_upsell"
  | "date_selection"
  | "time_selection"
  | "board_type"
  | "board_quantity"
  | "board_quantity_custom"
  | "board_pricing"
  | "board_start"
  | "board_hours"
  | "contact_name"
  | "contact_phone"
  | "contact_email"
  | "special_requests"
  | "summary"
  | "completed";

interface FormData {
  wantsSurf: boolean;
  wantsBoard: boolean;
  adults: number;
  kids: number;
  kidsAges: string;
  nonSwimmers: number;
  swimmerCourseTypes: CourseType[];
  courseIndex: number;
  date: string;
  time: string;
  boardType: string;
  boardQuantity: number;
  boardPricing: "hourly" | "day";
  boardStart: string;
  boardHours: number;
  name: string;
  phone: string;
  email: string;
  notes: string;
}

interface BotMessage {
  text: string;
  options?: string[];
}

interface DayInfo {
  booked: number;
  cap: number;
  free: number;
}

const TIME_SLOTS = ["08:00", "10:00"];

function todayStr(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STEP_ORDER: Step[] = [
  "booking_type", "adults_count", "kids_count", "swim_all", "course_type", "board_upsell",
  "board_type", "board_quantity", "board_pricing", "date_selection", "time_selection",
  "contact_name", "contact_phone", "contact_email", "special_requests", "summary", "completed",
];

const STEP_LABEL: Partial<Record<Step, string>> = {
  booking_type: "Choose service",
  adults_count: "Group size",
  adults_count_custom: "Group size",
  kids_count: "Group size",
  kids_count_custom: "Group size",
  kids_ages: "Group size",
  swim_all: "Swimming",
  non_swimmer_count: "Swimming",
  course_type: "Course",
  board_upsell: "Board rental",
  board_type: "Board",
  board_quantity: "Board",
  board_quantity_custom: "Board",
  board_pricing: "Board",
  board_start: "Board",
  board_hours: "Board",
  date_selection: "Date",
  time_selection: "Time",
  contact_name: "Your details",
  contact_phone: "Your details",
  contact_email: "Your details",
  special_requests: "Your details",
  summary: "Confirm",
  completed: "Done",
};

const INITIAL_FORM: FormData = {
  wantsSurf: true, wantsBoard: false, adults: 1, kids: 0, kidsAges: "", nonSwimmers: 0,
  swimmerCourseTypes: [], courseIndex: 0, date: "", time: TIME_SLOTS[0], boardType: "",
  boardQuantity: 1, boardPricing: "hourly", boardStart: "", boardHours: 2,
  name: "", phone: "", email: "", notes: "",
};

const INITIAL_MESSAGE: BotMessage = {
  text: "Hey! Welcome to LazyDog Surf. What would you like to book?",
  options: ["Surf Lesson", "Board Rental"],
};

export default function BookingPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [boardTypes, setBoardTypes] = useState<BoardType[]>([]);
  const [settings, setSettings] = useState<RentalSettings | null>(null);

  useEffect(() => {
    fetch("/api/courses").then((r) => r.json()).then(setCourses);
    fetch("/api/board-types").then((r) => r.json()).then(setBoardTypes);
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);

  const [step, setStep] = useState<Step>("booking_type");
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const history = useRef<{ step: Step; form: FormData }[]>([]);
  const [message, setMessage] = useState<BotMessage>(INITIAL_MESSAGE);
  const [inputValue, setInputValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ order_ref: string; total: number } | null>(null);

  const [monthOffset, setMonthOffset] = useState(0);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [dayInfo, setDayInfo] = useState<Record<string, DayInfo>>({});

  function go(nextStep: Step, patch: Partial<FormData>, bot: BotMessage) {
    history.current.push({ step, form });
    setForm((prev) => ({ ...prev, ...patch }));
    setStep(nextStep);
    setMessage(bot);
    setErrorMsg(null);
  }

  function goBack() {
    const prev = history.current.pop();
    if (!prev) return;
    setStep(prev.step);
    setForm(prev.form);
    setErrorMsg(null);
  }

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
    if (step === "date_selection") loadMonth(monthOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, monthOffset]);

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

  function selectDate(date: string) {
    if (date < todayStr(1)) return;
    if (form.wantsSurf) {
      const info = dayInfo[date];
      const free = info ? info.free : cap;
      if (free <= 0) return;
    }
    if (form.wantsSurf) {
      go("time_selection", { date }, { text: `${date} works. Which time slot?`, options: TIME_SLOTS });
    } else {
      go("contact_name", { date }, { text: "Great! What's your name?" });
    }
  }

  // ── Course options (swimmers only; kids & non-swimmers are priced automatically) ──
  const swimmerCourses = courses.filter((c) => c.type !== "kids" && c.type !== "private");
  const boardOptionNames = boardTypes.map((t) => t.name);

  // ── Price summary (for the confirm step) ────────────────────────────────────
  const totalPeople = form.adults + form.kids;
  const price = useMemo(() => {
    if (!courses.length || !form.wantsSurf) return null;
    return calcSurfLessonsPrice(
      {
        numberOfPeople: Math.max(1, totalPeople),
        numberOfKids: form.kids,
        numberOfNonSwimmers: form.nonSwimmers,
        swimmerCourseTypes: form.swimmerCourseTypes,
      },
      courses,
    );
  }, [courses, form.wantsSurf, totalPeople, form.kids, form.nonSwimmers, form.swimmerCourseTypes]);

  const boardType = boardTypes.find((t) => t.key === form.boardType);
  const boardPrice = form.wantsBoard && boardType
    ? rentalCharge({ pricing: form.boardPricing, quantity: form.boardQuantity, hours: form.boardHours, hourly_price: boardType.hourly_price, day_price: boardType.day_price })
    : 0;
  const grandTotal = (price?.total ?? 0) + boardPrice;

  function summaryText(): string {
    const lines: string[] = ["Here's your booking summary:", ""];
    if (form.wantsSurf && price) {
      price.lines.forEach((l) => {
        lines.push(`${l.people}x ${l.courseName} - ${l.amount.toLocaleString()} Rs${l.discount > 0 ? ` (-${l.discount.toLocaleString()} group discount)` : ""}`);
      });
      if (form.kids > 0 && form.kidsAges) lines.push(`Children's ages: ${form.kidsAges}`);
      lines.push(`Lesson date: ${form.date} at ${form.time}`);
    }
    if (form.wantsBoard && boardType) {
      lines.push(`Board rental: ${form.boardQuantity}x ${boardType.name} (${form.boardPricing === "day" ? "full day" : `${form.boardHours}h from ${form.boardStart}`}) - ${boardPrice.toLocaleString()} Rs`);
      if (!form.wantsSurf) lines.push(`Date: ${form.date}`);
    }
    lines.push("", `Total: ${grandTotal.toLocaleString()} Rs`, "", `Name: ${form.name}`, `Phone: ${form.phone}`);
    if (form.email) lines.push(`Email: ${form.email}`);
    if (form.notes) lines.push(`Notes: ${form.notes}`);
    return lines.join("\n");
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function submit() {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const notesParts = [form.notes, form.kids > 0 && form.kidsAges ? `Children's ages: ${form.kidsAges}` : ""].filter(Boolean);
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { first_name: form.name, last_name: "", phone: form.phone, email: form.email },
          course_date: form.date,
          course_time: form.time,
          number_of_people: form.wantsSurf ? Math.max(1, totalPeople) : 1,
          number_of_kids: form.wantsSurf ? form.kids : 0,
          number_of_non_swimmers: form.wantsSurf ? form.nonSwimmers : 0,
          swimmer_course_types: form.swimmerCourseTypes,
          special_requests: notesParts.join(" | "),
          board_rental: form.wantsBoard
            ? { board_type: form.boardType, quantity: form.boardQuantity, pricing: form.boardPricing, planned_start: form.boardStart || undefined, planned_hours: form.boardHours }
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong. Please try again.");
        return;
      }
      setConfirmation({ order_ref: data.reservation.order_ref, total: data.reservation.total_price + (data.boardRental?.amount ?? 0) });
      setStep("completed");
      setMessage({ text: `Booking requested! Your reference is #${data.reservation.order_ref}. We'll confirm shortly.` });
    } catch {
      setErrorMsg("Could not submit — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    history.current = [];
    setForm(INITIAL_FORM);
    setConfirmation(null);
    setErrorMsg(null);
    setStep("booking_type");
    setMessage(INITIAL_MESSAGE);
  }

  // ── Flow helpers ─────────────────────────────────────────────────────────────
  function askKidsCount(): BotMessage {
    return { text: "How many children will be joining?", options: ["0", "1", "2", "3", "4", "5+ (type the number)", "← Back"] };
  }

  function proceedAfterAdults(n: number) {
    const adults = Math.max(0, n);
    go("kids_count", { adults }, askKidsCount());
  }

  function proceedAfterKids(kids: number) {
    if (kids > 0) {
      go("kids_ages", { kids }, { text: `What are the ages of the ${kids} child${kids > 1 ? "ren" : ""}? (e.g. 6, 9)` });
    } else {
      startSwimStage({ kids: 0, kidsAges: "" });
    }
  }

  function startSwimStage(patch: Partial<FormData>) {
    const adults = patch.adults ?? form.adults;
    if (adults <= 0) {
      startCourseLoop(0, { ...patch, nonSwimmers: 0, swimmerCourseTypes: [] });
      return;
    }
    const q = adults === 1 ? "Are you a swimmer?" : `Are all ${adults} adults swimmers?`;
    go("swim_all", patch, { text: q, options: ["Yes", "No", "← Back"] });
  }

  function startCourseLoop(swimmersTotal: number, patch: Partial<FormData>) {
    if (swimmersTotal <= 0) {
      afterAllCourses({ ...patch, swimmerCourseTypes: [] });
      return;
    }
    const opts = [...swimmerCourses.map((c) => `${c.name} - ${c.price.toLocaleString()} Rs/person`), "← Back"];
    const label = swimmersTotal > 1 ? `Which course for surfer 1 of ${swimmersTotal}?` : "Which course would you like?";
    go("course_type", { ...patch, swimmerCourseTypes: [], courseIndex: 0 }, { text: label, options: opts });
  }

  function afterAllCourses(patch: Partial<FormData>) {
    if (form.wantsBoard || !form.wantsSurf) {
      // Board rental is already decided (board-only path never reaches here).
      go("date_selection", patch, { text: "Now, pick a date." });
    } else {
      go("board_upsell", patch, { text: "Would you like to add a board rental too?", options: ["Yes", "No"] });
    }
  }

  // ── Step router: what happens when an option or text is chosen ─────────────
  function handleOption(option: string) {
    if (option === "← Back") return goBack();

    switch (step) {
      case "booking_type": {
        if (option === "Surf Lesson") {
          go("adults_count", { wantsSurf: true, wantsBoard: false }, { text: "How many adults will be joining the surf lesson?", options: ["1", "2", "3", "4", "5+ (type the number)", "← Back"] });
        } else {
          go("board_type", { wantsSurf: false, wantsBoard: true }, { text: "Which board would you like to rent?", options: [...boardOptionNames, "← Back"] });
        }
        return;
      }
      case "adults_count": {
        if (option.startsWith("5+")) {
          setStep("adults_count_custom");
          setMessage({ text: "How many adults, exactly?" });
          return;
        }
        proceedAfterAdults(parseInt(option, 10));
        return;
      }
      case "kids_count": {
        if (option.startsWith("5+")) {
          setStep("kids_count_custom");
          setMessage({ text: "How many children, exactly?" });
          return;
        }
        proceedAfterKids(parseInt(option, 10) || 0);
        return;
      }
      case "swim_all": {
        if (option === "Yes") {
          startCourseLoop(form.adults, { nonSwimmers: 0 });
        } else if (form.adults === 1) {
          startCourseLoop(0, { nonSwimmers: 1 });
        } else {
          const opts = Array.from({ length: form.adults }, (_, i) => String(i + 1));
          go("non_swimmer_count", {}, { text: `How many of the ${form.adults} adults are non-swimmers? (they'll get a Private Lesson)`, options: [...opts, "← Back"] });
        }
        return;
      }
      case "non_swimmer_count": {
        const n = parseInt(option, 10);
        startCourseLoop(Math.max(0, form.adults - n), { nonSwimmers: n });
        return;
      }
      case "course_type": {
        const course = swimmerCourses.find((c) => option.startsWith(c.name));
        const newTypes = [...form.swimmerCourseTypes, course?.type ?? "teaser"];
        const swimmersTotal = form.adults - form.nonSwimmers;
        const nextIndex = form.courseIndex + 1;
        if (nextIndex < swimmersTotal) {
          go("course_type", { swimmerCourseTypes: newTypes, courseIndex: nextIndex }, { text: `Which course for surfer ${nextIndex + 1} of ${swimmersTotal}?`, options: [...swimmerCourses.map((c) => `${c.name} - ${c.price.toLocaleString()} Rs/person`), "← Back"] });
        } else {
          afterAllCourses({ swimmerCourseTypes: newTypes });
        }
        return;
      }
      case "board_upsell": {
        if (option === "Yes") {
          go("board_type", { wantsBoard: true }, { text: "Which board would you like to rent?", options: [...boardOptionNames, "← Back"] });
        } else {
          go("date_selection", { wantsBoard: false }, { text: "Now, pick a date for your lesson." });
        }
        return;
      }
      case "board_type": {
        const type = boardTypes.find((t) => t.name === option);
        go("board_quantity", { boardType: type?.key ?? "" }, { text: "How many boards?", options: ["1", "2", "3", "4+ (type the number)", "← Back"] });
        return;
      }
      case "board_quantity": {
        if (option.startsWith("4+")) {
          setStep("board_quantity_custom");
          setMessage({ text: "How many boards, exactly?" });
          return;
        }
        go("board_pricing", { boardQuantity: parseInt(option, 10) }, { text: "How would you like to pay for the rental?", options: ["By the hour", "Full day", "← Back"] });
        return;
      }
      case "board_pricing": {
        const pricing = option === "Full day" ? "day" : "hourly";
        if (pricing === "day") {
          go("date_selection", { boardPricing: pricing }, { text: form.wantsSurf ? "Last step: pick a date for the rental." : "Pick a date for the rental." });
        } else {
          const times = settings ? pickupTimes(settings) : [];
          go("board_start", { boardPricing: pricing }, { text: "What time would you like to pick up the board?", options: [...times, "← Back"] });
        }
        return;
      }
      case "board_start": {
        const maxHours = settings ? maxHoursFrom(option, settings) : 10;
        const opts = Array.from({ length: maxHours }, (_, i) => String(i + 1));
        go("board_hours", { boardStart: option }, { text: "For how many hours?", options: [...opts, "← Back"] });
        return;
      }
      case "board_hours": {
        go("date_selection", { boardHours: parseInt(option, 10) || 1 }, { text: form.wantsSurf ? "Last step: pick a date for the rental." : "Pick a date for the rental." });
        return;
      }
      case "time_selection": {
        go("contact_name", { time: option }, { text: "Great! What's your name?" });
        return;
      }
      case "summary": {
        if (option === "Confirm Booking") submit();
        else if (option === "Start Over") resetAll();
        return;
      }
      case "completed": {
        if (option === "Yes, book another") resetAll();
        return;
      }
    }
  }

  function handleSend() {
    const value = inputValue.trim();
    setInputValue("");
    if (step === "adults_count_custom") {
      return proceedAfterAdults(Math.min(30, Math.max(0, parseInt(value, 10) || 0)));
    }
    if (step === "kids_count_custom") {
      return proceedAfterKids(Math.min(30, Math.max(0, parseInt(value, 10) || 0)));
    }
    if (step === "kids_ages") {
      return startSwimStage({ kidsAges: value });
    }
    if (step === "board_quantity_custom") {
      const n = Math.min(10, Math.max(1, parseInt(value, 10) || 1));
      return go("board_pricing", { boardQuantity: n }, { text: "How would you like to pay for the rental?", options: ["By the hour", "Full day", "← Back"] });
    }
    if (step === "contact_name") {
      if (!value) return;
      return go("contact_phone", { name: value }, { text: "And a phone number to reach you?" });
    }
    if (step === "contact_phone") {
      if (!value) return;
      return go("contact_email", { phone: value }, { text: "Email address? (optional — press Enter to skip)" });
    }
    if (step === "contact_email") {
      return go("special_requests", { email: value }, { text: "Any special requests or notes? (optional — press Enter to skip)" });
    }
    if (step === "special_requests") {
      history.current.push({ step, form });
      setForm((prev) => ({ ...prev, notes: value }));
      setStep("summary");
      setMessage({ text: summaryText(), options: ["Confirm Booking", "Start Over"] });
      return;
    }
  }

  // summary message needs the latest price, so regenerate it right when entering that step
  useEffect(() => {
    if (step === "summary") {
      setMessage({ text: summaryText(), options: ["Confirm Booking", "Start Over"] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const isCalendarStep = step === "date_selection";
  const isTextStep = !message.options?.length && step !== "completed" && !isCalendarStep;
  const isCompleted = step === "completed";
  const stepIdx = STEP_ORDER.indexOf(step);
  const progress = stepIdx >= 0 ? Math.round((stepIdx / (STEP_ORDER.length - 1)) * 100) : 0;

  return (
    <div className="min-h-screen bg-surface font-sans2 text-slate">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-line2 bg-surface">
        <div className="mx-auto max-w-2xl px-5 py-10 md:py-14">
          <div className="flex flex-col justify-between rounded-tl-[28px] rounded-br-[28px] border border-line2 bg-white p-6 md:p-9">
            <span className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-soft">Goa · India</span>
            <h1 className="mt-5 font-heading text-4xl font-bold leading-[1.05] tracking-tight text-slate md:text-5xl">LazyDog Surf</h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-soft">Surf lessons and board rental, booked in a couple of minutes.</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 px-5 py-10">
        {!isCompleted && (
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono2 text-[11px] uppercase tracking-widest text-slate-soft">
              <span className="font-semibold text-slate">{STEP_LABEL[step] ?? "Booking"}</span>
              <span>{String(progress).padStart(2, "0")}%</span>
            </div>
            <div className="h-[3px] overflow-hidden bg-line2">
              <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {isCompleted ? (
          <div className="space-y-4 rounded-tl-[32px] rounded-br-[32px] border border-line2 bg-white px-8 py-14 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-ink">
              <span className="font-heading text-2xl font-bold text-accent">✓</span>
            </div>
            <h2 className="font-heading text-2xl font-bold text-slate">Booking Requested</h2>
            <p className="mx-auto max-w-md whitespace-pre-line text-sm leading-relaxed text-slate-soft">{message.text}</p>
            {confirmation && (
              <p className="font-mono2 text-lg font-semibold text-slate">
                Total <span className="text-accent">{confirmation.total.toLocaleString()} Rs</span>
              </p>
            )}
            <button onClick={resetAll} className="mt-2 rounded-md bg-slate px-6 py-2.5 font-sans2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent">
              Make Another Booking
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-tl-[32px] rounded-br-[32px] border border-line2 bg-white">
            <div className="border-b border-line2 px-6 pb-5 pt-7">
              <p className="whitespace-pre-line font-heading text-xl font-semibold leading-snug text-slate">{message.text}</p>
            </div>

            {isCalendarStep && (
              <div className="p-6">
                {loadingCalendar ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="h-8 w-8 animate-pulse rounded bg-surface2" />
                      <div className="h-4 w-28 animate-pulse rounded bg-surface2" />
                      <div className="h-8 w-8 animate-pulse rounded bg-surface2" />
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {Array.from({ length: 35 }).map((_, i) => (
                        <div key={i} className="aspect-square animate-pulse rounded-md bg-surface2" style={{ animationDelay: `${(i % 7) * 40}ms` }} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <button onClick={() => setMonthOffset((m) => Math.max(0, m - 1))} disabled={monthOffset === 0} className="rounded-md border border-line2 p-1.5 font-mono2 text-slate transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-30">
                        ←
                      </button>
                      <h3 className="font-mono2 text-xs font-semibold uppercase tracking-widest text-slate">{monthLabel(monthOffset)}</h3>
                      <button onClick={() => setMonthOffset((m) => Math.min(11, m + 1))} disabled={monthOffset >= 11} className="rounded-md border border-line2 p-1.5 font-mono2 text-slate transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-30">
                        →
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5 text-center font-mono2 text-[10px] uppercase tracking-wide text-slate-soft">
                      {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {monthDates.length > 0 && Array.from({ length: (new Date(monthDates[0] + "T00:00:00").getDay() + 6) % 7 }).map((_, i) => <div key={`e${i}`} />)}
                      {monthDates.map((date) => {
                        const info = dayInfo[date];
                        const free = info ? info.free : cap;
                        const isPast = date < todayStr(1);
                        const isFull = form.wantsSurf && free <= 0;
                        const disabled = isPast || isFull;
                        const isLow = !disabled && free <= 3 && form.wantsSurf;
                        const isToday = date === todayStr();
                        const day = Number(date.slice(-2));
                        let cls = "group relative aspect-square flex flex-col items-center justify-center rounded-md border font-mono2 text-xs font-medium transition-all duration-150 ";
                        if (disabled) cls += "border-transparent bg-surface2 text-slate-soft/40 line-through cursor-not-allowed";
                        else if (isToday) cls += "border-accent text-accent hover:-translate-y-0.5";
                        else cls += "border-line2 text-slate hover:-translate-y-0.5 hover:border-accent hover:text-accent";
                        return (
                          <button key={date} type="button" disabled={disabled} onClick={() => selectDate(date)} className={cls}>
                            <span>{day}</span>
                            {!disabled && form.wantsSurf && (
                              <span className={`mt-0.5 text-[8px] leading-none ${isLow ? "text-accent" : "opacity-50"}`}>{free}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {form.wantsSurf && (
                      <div className="flex flex-wrap gap-4 pt-1 font-mono2 text-[10px] uppercase tracking-wide text-slate-soft">
                        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm border border-accent" /> Today</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm border border-line2" /> Available</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-surface2" /> Full</span>
                      </div>
                    )}
                    <button onClick={goBack} className="font-mono2 text-xs font-semibold uppercase tracking-widest text-slate-soft transition-colors hover:text-accent">← Back</button>
                  </div>
                )}
              </div>
            )}

            {!isCalendarStep && !!message.options?.length && (
              <div className="p-6">
                <div className="flex flex-wrap gap-2">
                  {message.options.map((option) => {
                    const isBack = option === "← Back";
                    const isConfirm = option === "Confirm Booking";
                    const isCancel = option === "Start Over";
                    return (
                      <button
                        key={option}
                        disabled={submitting}
                        onClick={() => handleOption(option)}
                        className={`rounded-md border px-4 py-2.5 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                          isBack ? "border-line2 text-slate-soft hover:-translate-y-0.5 hover:border-slate-soft hover:text-slate"
                          : isConfirm ? "border-accent bg-accent text-white hover:-translate-y-0.5 hover:bg-slate hover:border-slate"
                          : isCancel ? "border-line2 text-slate-soft hover:-translate-y-0.5 hover:border-red-300 hover:text-red-500"
                          : "border-line2 text-slate hover:-translate-y-0.5 hover:border-accent hover:text-accent"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!isCalendarStep && isTextStep && (
              <div className="p-6">
                <div className="flex gap-3">
                  <input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder={
                      step === "contact_name" ? "Your full name..." :
                      step === "contact_phone" ? "Phone / WhatsApp number..." :
                      step === "contact_email" ? "Email address..." :
                      step === "special_requests" ? "Anything we should know..." :
                      step === "kids_ages" ? "e.g. 6, 9" :
                      "Type a number..."
                    }
                    disabled={submitting}
                    autoFocus
                    className="flex-1 border-b-2 border-line2 bg-transparent px-1 py-2 text-sm text-slate outline-none transition-colors focus:border-accent"
                  />
                  <button onClick={handleSend} disabled={submitting} className="rounded-md bg-slate px-5 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-accent disabled:opacity-50">
                    {submitting ? "..." : "Send"}
                  </button>
                </div>
                {history.current.length > 0 && (
                  <button onClick={goBack} className="mt-3 font-mono2 text-xs font-semibold uppercase tracking-widest text-slate-soft transition-colors hover:text-accent">← Back</button>
                )}
              </div>
            )}

            {errorMsg && <p className="mx-6 mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{errorMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
