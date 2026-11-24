import { NextResponse } from "next/server";
import { availabilityFor } from "@/lib/board-rental";
import { readDb } from "@/lib/store";

// Public endpoint — no guest names or contact details, just counts, so the
// booking page can show "x/8 taken" per day and board availability per date.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // "YYYY-MM"
  const date = searchParams.get("date"); // "YYYY-MM-DD"
  const db = await readDb();

  if (date) {
    const booked = db.reservations
      .filter((r) => r.course_date === date && r.status !== "cancelled")
      .reduce((sum, r) => sum + r.number_of_people, 0);
    const boards = availabilityFor(
      db.board_types.filter((t) => t.is_active),
      db.board_rentals.filter((r) => r.rental_date === date && r.status !== "cancelled"),
    );
    return NextResponse.json({ date, booked, cap: db.settings.max_students_per_day, free: Math.max(0, db.settings.max_students_per_day - booked), boards });
  }

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const byDate = new Map<string, number>();
    db.reservations.forEach((r) => {
      if (r.status === "cancelled" || !r.course_date.startsWith(month)) return;
      byDate.set(r.course_date, (byDate.get(r.course_date) ?? 0) + r.number_of_people);
    });
    const days = Object.fromEntries(
      [...byDate.entries()].map(([d, booked]) => [d, { booked, cap: db.settings.max_students_per_day, free: Math.max(0, db.settings.max_students_per_day - booked) }]),
    );
    return NextResponse.json({ cap: db.settings.max_students_per_day, days });
  }

  return NextResponse.json({ error: "Provide ?date=YYYY-MM-DD or ?month=YYYY-MM" }, { status: 400 });
}
