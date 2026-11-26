import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { mutateDb, readDb } from "@/lib/store";

// The single course (1 Day Surf Course). Public GET for the booking page,
// admin-only PATCH to change its name, price or switch bookings on/off.
export async function GET() {
  const db = await readDb();
  return NextResponse.json(db.course);
}

export async function PATCH(request: Request) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const patch = await request.json().catch(() => null);
  if (!patch || typeof patch !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updated = await mutateDb((db) => {
    if (typeof patch.price === "number" && patch.price >= 0) db.course.price = Math.round(patch.price);
    if (typeof patch.name === "string" && patch.name.trim()) db.course.name = patch.name.trim().slice(0, 60);
    if (typeof patch.is_active === "boolean") db.course.is_active = patch.is_active;
    return db.course;
  });
  return NextResponse.json(updated);
}
