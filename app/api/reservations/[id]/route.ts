import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { mutateDb } from "@/lib/store";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!["pending", "confirmed", "cancelled"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const updated = await mutateDb((db) => {
    const r = db.reservations.find((x) => x.id === params.id);
    if (!r) return null;
    r.status = body.status;
    r.updated_at = new Date().toISOString();
    return r;
  });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
