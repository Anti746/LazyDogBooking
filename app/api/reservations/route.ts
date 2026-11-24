import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { calcSurfLessonsPrice } from "@/lib/pricing";
import { rentalCharge } from "@/lib/board-rental";
import { generateId, mutateDb, readDb, todayLocal } from "@/lib/store";
import type { BoardRental, CourseType, CreateBookingRequest, Reservation } from "@/lib/types";

const COURSE_TYPES: CourseType[] = ["teaser", "plunge", "immerse", "week", "kids", "private"];

// ── GET — admin only: list all bookings ──────────────────────────────────────
export async function GET(request: Request) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await readDb();
  return NextResponse.json(db.reservations.sort((a, b) => b.created_at.localeCompare(a.created_at)));
}

// ── POST — public: create a booking (+ optional board rental) ───────────────
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateBookingRequest | null;
  if (!body || !body.customer?.first_name || !body.customer?.phone) {
    return NextResponse.json({ error: "Meno a telefón sú povinné." }, { status: 400 });
  }
  if (!body.course_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.course_date)) {
    return NextResponse.json({ error: "Neplatný dátum." }, { status: 400 });
  }
  if (body.course_date <= todayLocal()) {
    return NextResponse.json({ error: "Termín lekcie musí byť aspoň zajtra." }, { status: 400 });
  }
  const totalPeople = Math.max(1, Math.round(body.number_of_people || 1));
  if (totalPeople > 30) return NextResponse.json({ error: "Príliš veľká skupina." }, { status: 400 });
  const kids = Math.max(0, Math.round(body.number_of_kids || 0));
  const nonSwimmers = Math.max(0, Math.round(body.number_of_non_swimmers || 0));
  if (kids + nonSwimmers > totalPeople) return NextResponse.json({ error: "Počty osôb nesedia." }, { status: 400 });
  const swimmerTypes = (Array.isArray(body.swimmer_course_types) ? body.swimmer_course_types : []).filter((t): t is CourseType => COURSE_TYPES.includes(t));

  try {
    const result = await mutateDb((db) => {
      // ── Capacity check: max N students per day, single instructor ─────────
      const existingForDate = db.reservations
        .filter((r) => r.course_date === body.course_date && r.status !== "cancelled")
        .reduce((sum, r) => sum + r.number_of_people, 0);
      const cap = db.settings.max_students_per_day;
      if (existingForDate + totalPeople > cap) {
        const free = Math.max(0, cap - existingForDate);
        throw new Error(`CAPACITY:${free}:${cap}`);
      }

      const price = calcSurfLessonsPrice(
        {
          numberOfPeople: totalPeople,
          numberOfKids: kids,
          numberOfNonSwimmers: nonSwimmers,
          swimmerCourseTypes: swimmerTypes,
          kidsLessonCounts: body.kids_lesson_counts,
        },
        db.courses,
      );
      if (price.groups.length === 0) {
        throw new Error("NOPRICE");
      }

      const order_ref = generateId("LD-");
      const now = new Date().toISOString();
      const reservation: Reservation = {
        id: generateId(),
        order_ref,
        customer: {
          first_name: body.customer.first_name.trim().slice(0, 60),
          last_name: (body.customer.last_name ?? "").trim().slice(0, 60),
          phone: body.customer.phone.trim().slice(0, 30),
          email: body.customer.email?.trim().slice(0, 100),
        },
        course_date: body.course_date,
        course_time: typeof body.course_time === "string" ? body.course_time : "08:00",
        groups: price.groups,
        number_of_people: totalPeople,
        subtotal: price.subtotal,
        discount: price.discount,
        total_price: price.total,
        special_requests: body.special_requests?.trim().slice(0, 500) || null,
        status: "pending",
        created_at: now,
        updated_at: now,
      };
      db.reservations.push(reservation);

      let boardRental: BoardRental | null = null;
      if (body.board_rental && body.board_rental.board_type) {
        const type = db.board_types.find((t) => t.key === body.board_rental!.board_type && t.is_active);
        if (!type) throw new Error("BOARDTYPE");
        const quantity = Math.max(1, Math.round(body.board_rental.quantity || 1));

        // Board availability for that date (same capacity logic as the original).
        const held = db.board_rentals
          .filter((r) => r.rental_date === body.course_date && r.board_type === type.key && r.status !== "cancelled")
          .reduce((sum, r) => sum + r.quantity, 0);
        if (held + quantity > type.quantity) {
          throw new Error(`BOARDS:${Math.max(0, type.quantity - held)}`);
        }

        const pricing = body.board_rental.pricing === "day" ? "day" : "hourly";
        const hours = Math.max(1, Math.round(body.board_rental.planned_hours || 1));
        const amount = rentalCharge({ pricing, quantity, hours, hourly_price: type.hourly_price, day_price: type.day_price });
        boardRental = {
          id: generateId(),
          order_ref,
          guest_name: `${reservation.customer.first_name} ${reservation.customer.last_name}`.trim(),
          guest_phone: reservation.customer.phone,
          board_type: type.key,
          quantity,
          pricing,
          rental_date: body.course_date,
          planned_start: pricing === "hourly" ? body.board_rental.planned_start ?? null : null,
          planned_hours: pricing === "hourly" ? hours : null,
          amount,
          status: "pending",
          created_at: now,
        };
        db.board_rentals.push(boardRental);
      }

      return { reservation, boardRental };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    if (message.startsWith("CAPACITY:")) {
      const [, free, cap] = message.split(":");
      return NextResponse.json({ error: `Na tento deň je voľných už len ${free} miest (max. ${cap}/deň).`, freeSlots: Number(free) }, { status: 409 });
    }
    if (message.startsWith("BOARDS:")) {
      const free = message.split(":")[1];
      return NextResponse.json({ error: `Na tento deň je dostupných už len ${free} ks tohto typu dosky.` }, { status: 409 });
    }
    if (message === "NOPRICE") return NextResponse.json({ error: "Nepodarilo sa vypočítať cenu — skontrolujte výber lekcie." }, { status: 400 });
    if (message === "BOARDTYPE") return NextResponse.json({ error: "Neplatný typ dosky." }, { status: 400 });
    console.error("RESERVATION CREATE ERROR:", err);
    return NextResponse.json({ error: "Nastala chyba na serveri." }, { status: 500 });
  }
}
