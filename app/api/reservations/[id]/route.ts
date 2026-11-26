import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { deleteReservation, getReservation, setReservationStatus } from "@/lib/db";
import { sendBookingConfirmedEmail } from "@/lib/email";
import { isUuid } from "@/lib/validate";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (!["pending", "confirmed", "cancelled"].includes(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  const before = await getReservation(params.id);
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await setReservationStatus(params.id, body.status);

  // Email the customer only when the booking actually becomes confirmed.
  let emailSent: boolean | null = null;
  if (body.status === "confirmed" && before.status !== "confirmed") {
    const r = await sendBookingConfirmedEmail(before).catch(() => ({ ok: false }));
    emailSent = r.ok;
  }
  return NextResponse.json({ ok: true, emailSent });
}

/** GDPR right to erasure (Art. 17): permanently deletes the booking and its participants. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ok = await deleteReservation(params.id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
