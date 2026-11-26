import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { TIME_SLOTS, calcPrice, validateParticipants } from "@/lib/booking";
import { generateId, mutateDb, readDb, todayLocal } from "@/lib/store";
import { WAIVER_VERSION } from "@/lib/waiver";
import type { CreateBookingRequest, Participant, Reservation } from "@/lib/types";

// ── GET — admin only: list all bookings ──────────────────────────────────────
export async function GET(request: Request) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await readDb();
  return NextResponse.json(db.reservations.sort((a, b) => b.created_at.localeCompare(a.created_at)));
}

// ── POST — public: create a booking ──────────────────────────────────────────
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateBookingRequest | null;
  if (!body || !body.customer?.first_name?.trim() || !body.customer?.phone?.trim()) {
    return NextResponse.json({ error: "Name and phone are required." }, { status: 400 });
  }
  if (!body.course_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.course_date)) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }
  if (body.course_date <= todayLocal()) {
    return NextResponse.json({ error: "The lesson date must be at least tomorrow." }, { status: 400 });
  }
  if (!(TIME_SLOTS as readonly string[]).includes(body.course_time)) {
    return NextResponse.json({ error: `Lesson time must be ${TIME_SLOTS.join(" or ")}.` }, { status: 400 });
  }
  const participantError = validateParticipants(body.participants);
  if (participantError) return NextResponse.json({ error: participantError }, { status: 400 });
  if (body.waiver_accepted !== true) {
    return NextResponse.json({ error: "You must accept the liability waiver to book." }, { status: 400 });
  }

  // Keep only known fields — never store whatever extra the client sent.
  const participants: Participant[] = body.participants.map((p) => ({
    group: p.group,
    gender: p.gender,
    age: p.age,
    weight_kg: p.weight_kg,
    swimmer: p.swimmer,
  }));

  try {
    const reservation = await mutateDb((db) => {
      if (!db.course.is_active) throw new Error("INACTIVE");

      // Capacity: max N students per day, single instructor.
      const existing = db.reservations
        .filter((r) => r.course_date === body.course_date && r.status !== "cancelled")
        .reduce((sum, r) => sum + r.number_of_people, 0);
      const cap = db.settings.max_students_per_day;
      if (existing + participants.length > cap) {
        throw new Error(`CAPACITY:${Math.max(0, cap - existing)}:${cap}`);
      }

      const price = calcPrice(participants.map((p) => p.group), db.course.price);
      const now = new Date().toISOString();
      const r: Reservation = {
        id: generateId(),
        order_ref: generateId("LD-"),
        customer: {
          first_name: body.customer.first_name.trim().slice(0, 60),
          last_name: (body.customer.last_name ?? "").trim().slice(0, 60),
          phone: body.customer.phone.trim().slice(0, 30),
          email: body.customer.email?.trim().slice(0, 100) || undefined,
        },
        course_date: body.course_date,
        course_time: body.course_time,
        course_name: db.course.name,
        price_per_person: db.course.price,
        participants,
        number_of_people: participants.length,
        subtotal: price.subtotal,
        discount: price.discount,
        total_price: price.total,
        special_requests: body.special_requests?.trim().slice(0, 500) || null,
        waiver_accepted_at: now,
        // Always record the version the server actually serves, not what the client claims.
        waiver_version: WAIVER_VERSION,
        status: "pending",
        created_at: now,
        updated_at: now,
      };
      db.reservations.push(r);
      return r;
    });

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    if (message.startsWith("CAPACITY:")) {
      const [, free, cap] = message.split(":");
      return NextResponse.json({ error: `Only ${free} spot(s) left for this day (max ${cap}/day).`, freeSlots: Number(free) }, { status: 409 });
    }
    if (message === "INACTIVE") return NextResponse.json({ error: "Bookings are currently closed." }, { status: 409 });
    console.error("RESERVATION CREATE ERROR:", err);
    return NextResponse.json({ error: "A server error occurred." }, { status: 500 });
  }
}
