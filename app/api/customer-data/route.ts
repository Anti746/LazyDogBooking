import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { findReservationsByContact } from "@/lib/db";

// Admin only. Finds every booking for one person (by email, phone or booking
// reference) so a GDPR access / erasure request can be answered.
export async function GET(request: Request) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const term = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (term.length < 3 || term.length > 100) return NextResponse.json({ error: "Enter an email, phone number or booking reference." }, { status: 400 });
  return NextResponse.json(await findReservationsByContact(term), { headers: { "Cache-Control": "no-store" } });
}
