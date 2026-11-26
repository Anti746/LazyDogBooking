import { NextResponse } from "next/server";
import { bookedPerDay, getSettings } from "@/lib/db";

// Always read live from the database — never cache prices or availability.
export const dynamic = "force-dynamic";

// Public endpoint — head counts only, no personal data, so the booking page
// can show how many spots are left per day.
export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Provide ?month=YYYY-MM" }, { status: 400 });
  const [{ max_students_per_day: cap }, booked] = await Promise.all([getSettings(), bookedPerDay(month)]);
  const days = Object.fromEntries(Object.entries(booked).map(([d, b]) => [d, { booked: b, cap, free: Math.max(0, cap - b) }]));
  return NextResponse.json({ cap, days }, { headers: { "Cache-Control": "no-store" } });
}
