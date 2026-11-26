import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getCourse, updateCourse } from "@/lib/db";

// Always read live from the database — never cache prices or availability.
export const dynamic = "force-dynamic";

// The single course (1 Day Surf Course). Public GET for the booking page,
// admin-only PATCH to change its name, price or switch bookings on/off.
export async function GET() {
  return NextResponse.json(await getCourse(), { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = await request.json().catch(() => null);
  if (!p || typeof p !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  return NextResponse.json(await updateCourse({
    name: typeof p.name === "string" && p.name.trim() ? p.name.trim().slice(0, 60) : undefined,
    price: typeof p.price === "number" && Number.isFinite(p.price) && p.price >= 0 ? Math.round(p.price) : undefined,
    is_active: typeof p.is_active === "boolean" ? p.is_active : undefined,
  }));
}
