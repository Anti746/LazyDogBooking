import { NextResponse } from "next/server";
import { readDb } from "@/lib/store";

// Public endpoint — no guest names or contact details, just head counts, so the
// booking page can show how many spots are left per day.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // "YYYY-MM"
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Provide ?month=YYYY-MM" }, { status: 400 });
  }
  const db = await readDb();
  const cap = db.settings.max_students_per_day;
  const byDate = new Map<string, number>();
  db.reservations.forEach((r) => {
    if (r.status === "cancelled" || !r.course_date.startsWith(month)) return;
    byDate.set(r.course_date, (byDate.get(r.course_date) ?? 0) + r.number_of_people);
  });
  const days = Object.fromEntries(
    [...byDate.entries()].map(([d, booked]) => [d, { booked, cap, free: Math.max(0, cap - booked) }]),
  );
  return NextResponse.json({ cap, days });
}
