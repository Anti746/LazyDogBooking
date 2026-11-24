import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { mutateDb, readDb } from "@/lib/store";

export async function GET(request: Request) {
  const db = await readDb();
  const all = db.board_types.sort((a, b) => a.sort_order - b.sort_order);
  return NextResponse.json(isAuthed(request) ? all : all.filter((t) => t.is_active));
}

export async function PATCH(request: Request) {
  if (!isAuthed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body)) return NextResponse.json({ error: "Expected an array of board types" }, { status: 400 });

  const updated = await mutateDb((db) => {
    for (const patch of body) {
      const type = db.board_types.find((t) => t.key === patch.key);
      if (!type) continue;
      if (typeof patch.name === "string" && patch.name.trim()) type.name = patch.name.trim().slice(0, 40);
      if (typeof patch.hourly_price === "number" && patch.hourly_price >= 0) type.hourly_price = Math.round(patch.hourly_price);
      if (typeof patch.day_price === "number" && patch.day_price >= 0) type.day_price = Math.round(patch.day_price);
      if (typeof patch.quantity === "number" && patch.quantity >= 0) type.quantity = Math.round(patch.quantity);
      if (typeof patch.is_active === "boolean") type.is_active = patch.is_active;
    }
    return db.board_types;
  });
  return NextResponse.json(updated);
}
