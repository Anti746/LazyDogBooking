import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/db";

// Always read live from the database — never cache prices or availability.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSettings(), { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const n = body.max_students_per_day;
  return NextResponse.json(await updateSettings({
    max_students_per_day: typeof n === "number" && Number.isFinite(n) && n >= 1 && n <= 100 ? Math.round(n) : undefined,
  }));
}
