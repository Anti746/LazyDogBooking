import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, adminLoginProblem, checkPassword, createSessionToken, sessionCookieOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const problem = adminLoginProblem();
  if (problem) return NextResponse.json({ error: problem }, { status: 503 });
  // Slow down password guessing: 5 attempts per 15 minutes per IP.
  if (!rateLimit(request, "login", 5, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts — try again in 15 minutes." }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  if (!checkPassword(password)) return NextResponse.json({ error: "Incorrect password" }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, createSessionToken(), sessionCookieOptions());
  return res;
}
