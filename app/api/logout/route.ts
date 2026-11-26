import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
