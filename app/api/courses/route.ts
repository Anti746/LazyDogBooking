import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { mutateDb, readDb } from "@/lib/store";

// Public GET (booking page needs prices — active only), admin GET sees all
// (including inactive, so they can be switched back on), admin-only PATCH.
export async function GET(request: Request) {
  const db = await readDb();
  const all = db.courses.sort((a, b) => a.sort_order - b.sort_order);
  return NextResponse.json(isAuthed(request) ? all : all.filter((c) => c.is_active));
}

export async function PATCH(request: Request) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body)) return NextResponse.json({ error: "Expected an array of courses" }, { status: 400 });

  const updated = await mutateDb((db) => {
    for (const patch of body) {
      const course = db.courses.find((c) => c.id === patch.id);
      if (!course) continue;
      if (typeof patch.price === "number" && patch.price >= 0) course.price = Math.round(patch.price);
      if (typeof patch.name === "string" && patch.name.trim()) course.name = patch.name.trim().slice(0, 60);
      if (typeof patch.is_active === "boolean") course.is_active = patch.is_active;
    }
    return db.courses;
  });
  return NextResponse.json(updated);
}
