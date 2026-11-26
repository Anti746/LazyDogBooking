import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { TIME_SLOTS, calcPrice, validateParticipants } from "@/lib/booking";
import { BookingError, createBooking, getCourse, listReservations, purgeExpiredPersonalData } from "@/lib/db";
import { sendBookingRequestEmails } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { WAIVER_VERSION } from "@/lib/waiver";
import type { CreateBookingRequest, Participant } from "@/lib/types";

function todayLocal(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── GET — admin only: bookings between ?from=YYYY-MM-DD&to=YYYY-MM-DD ─────────
export async function GET(request: Request) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  if (!DATE.test(from) || !DATE.test(to)) return NextResponse.json({ error: "Provide ?from and ?to as YYYY-MM-DD" }, { status: 400 });
  // Storage limitation: drop anything past the retention period whenever the
  // admin looks at bookings (in addition to the scheduled job, if set up).
  await purgeExpiredPersonalData().catch((e) => console.error("PURGE ERROR:", e instanceof Error ? e.message : e));
  return NextResponse.json(await listReservations(from, to), { headers: { "Cache-Control": "no-store" } });
}

// ── POST — public: create a booking ──────────────────────────────────────────
export async function POST(request: Request) {
  if (!rateLimit(request, "booking", 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts — please try again in a few minutes." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as CreateBookingRequest | null;
  const name = typeof body?.customer?.name === "string" ? body.customer.name.trim() : "";
  const phone = typeof body?.customer?.phone === "string" ? body.customer.phone.trim() : "";
  const email = typeof body?.customer?.email === "string" ? body.customer.email.trim() : "";
  if (!body || !name || !phone || !email) return NextResponse.json({ error: "Name, phone and email are required." }, { status: 400 });
  if (name.length > 120 || phone.length < 3 || phone.length > 30) return NextResponse.json({ error: "Please check your name and phone number." }, { status: 400 });
  if (email.length > 100 || !EMAIL.test(email)) return NextResponse.json({ error: "Please check your email address." }, { status: 400 });
  if (typeof body.course_date !== "string" || !DATE.test(body.course_date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  if (body.course_date <= todayLocal()) return NextResponse.json({ error: "The lesson date must be at least tomorrow." }, { status: 400 });
  if (!(TIME_SLOTS as readonly string[]).includes(body.course_time)) return NextResponse.json({ error: `Lesson time must be ${TIME_SLOTS.join(" or ")}.` }, { status: 400 });
  const participantError = validateParticipants(body.participants);
  if (participantError) return NextResponse.json({ error: participantError }, { status: 400 });
  if (body.waiver_accepted !== true) return NextResponse.json({ error: "You must accept the liability waiver to book." }, { status: 400 });

  // Keep only known fields — never store whatever extra the client sent.
  const participants: Participant[] = body.participants.map((p) => ({ gender: p.gender, age: p.age, weight_kg: p.weight_kg, swimmer: p.swimmer }));

  try {
    const course = await getCourse();
    if (!course.is_active) return NextResponse.json({ error: "Bookings are currently closed." }, { status: 409 });
    const price = calcPrice(participants.length, course.price);
    const result = await createBooking({
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      course_date: body.course_date,
      course_time: body.course_time,
      participants,
      special_requests: typeof body.special_requests === "string" ? body.special_requests.trim().slice(0, 500) || null : null,
      // Always record the version the server actually serves, not what the client claims.
      waiver_version: WAIVER_VERSION,
      price_per_person: course.price,
      subtotal: price.subtotal,
      discount: price.discount,
      total_price: price.total,
    });
    // Booking-request emails (customer + us). Awaited so serverless hosting
    // doesn't freeze the function mid-send, but a failure never undoes the booking.
    const emails = await sendBookingRequestEmails({
      order_ref: result.order_ref,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      course_name: course.name,
      course_date: body.course_date,
      course_time: body.course_time,
      participants,
      price_per_person: course.price,
      subtotal: price.subtotal,
      discount: price.discount,
      total_price: price.total,
    }).catch((e) => {
      console.error("BOOKING EMAILS ERROR:", e instanceof Error ? e.message : e);
      return { customer: { ok: false }, admin: { ok: false } };
    });

    // Return only what the confirmation screen needs — no personal data.
    return NextResponse.json(
      { reservation: { order_ref: result.order_ref, total_price: result.total_price }, emailSent: emails.customer.ok },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof BookingError) {
      if (err.code === "CAPACITY") return NextResponse.json({ error: `Only ${err.free} spot(s) left for this day (max ${err.cap}/day).`, freeSlots: err.free }, { status: 409 });
      if (err.code === "BOOKINGS_CLOSED") return NextResponse.json({ error: "Bookings are currently closed." }, { status: 409 });
      return NextResponse.json({ error: "The price has just changed — please reload the page." }, { status: 409 });
    }
    // Log the error message only — never the request body (personal data).
    console.error("RESERVATION CREATE ERROR:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "A server error occurred." }, { status: 500 });
  }
}
