import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { deleteReservation, setReservationStatus } from "@/lib/db";
import { isUuid } from "@/lib/validate";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (!["pending", "confirmed", "cancelled"].includes(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  const ok = await setReservationStatus(params.id, body.status);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** GDPR right to erasure (Art. 17): permanently deletes the booking and its participants. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ok = await deleteReservation(params.id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
