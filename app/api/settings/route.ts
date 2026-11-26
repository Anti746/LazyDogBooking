import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { mutateDb, readDb } from "@/lib/store";

export async function GET() {
  const db = await readDb();
  return NextResponse.json(db.settings);
}

export async function PATCH(request: Request) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updated = await mutateDb((db) => {
    if (typeof body.max_students_per_day === "number" && body.max_students_per_day > 0) {
      db.settings.max_students_per_day = Math.round(body.max_students_per_day);
    }
    return db.settings;
  });
  return NextResponse.json(updated);
}
