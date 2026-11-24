import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { readDb } from "@/lib/store";

export async function GET(request: Request) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await readDb();
  return NextResponse.json(db.board_rentals.sort((a, b) => b.created_at.localeCompare(a.created_at)));
}
