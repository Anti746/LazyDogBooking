// ─────────────────────────────────────────────────────────────────────────────
// Admin authentication — one shared password for the beach desk, hardened
// because the dashboard shows customers' personal data (GDPR Art. 32):
//
//   • The cookie never contains the password. It holds a signed, expiring
//     session token (HMAC-SHA256), valid for 8 hours.
//   • Cookie is HttpOnly, SameSite=Strict, and Secure in production.
//   • Password comparison is constant-time.
//   • Login stays disabled until an explicit 16+ character ADMIN_PASSWORD and
//     an independent 32+ character SESSION_SECRET are configured; no default password.
//   • Changing ADMIN_PASSWORD (or SESSION_SECRET) logs everyone out.
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE_NAME = "lazydog_admin";
export const SESSION_HOURS = 8;
const MIN_PASSWORD_LENGTH = 16;
const MIN_SESSION_SECRET_LENGTH = 32;

const isProd = process.env.NODE_ENV === "production";

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

/** Null if the admin login may be used; otherwise the reason it's disabled. */
export function adminLoginProblem(): string | null {
  const pw = adminPassword();
  const sessionSecret = process.env.SESSION_SECRET ?? "";
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return `Admin login is disabled: set ADMIN_PASSWORD to at least ${MIN_PASSWORD_LENGTH} characters in the server environment.`;
  }
  if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    return `Admin login is disabled: set SESSION_SECRET to at least ${MIN_SESSION_SECRET_LENGTH} characters in the server environment.`;
  }
  return null;
}

function signingKey(): Buffer {
  return createHash("sha256").update(`lazydog-session|${process.env.SESSION_SECRET ?? ""}|${adminPassword()}`).digest();
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(password: string): boolean {
  if (adminLoginProblem()) return false;
  return safeEqual(password, adminPassword());
}

export function createSessionToken(): string {
  const expires = Date.now() + SESSION_HOURS * 3600_000;
  const payload = `v1.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token || adminLoginProblem()) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const payload = `${parts[0]}.${parts[1]}`;
  if (!safeEqual(parts[2], sign(payload))) return false;
  const expires = Number(parts[1]);
  return Number.isFinite(expires) && expires > Date.now();
}

export function sessionCookieOptions() {
  return { httpOnly: true, secure: isProd, sameSite: "strict" as const, path: "/", maxAge: SESSION_HOURS * 3600 };
}

function readCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) return decodeURIComponent(trimmed.slice(name.length + 1));
  }
  return null;
}

/** For API routes. */
export function isAuthed(request: Request): boolean {
  return verifySessionToken(readCookie(request.headers.get("cookie") ?? "", ADMIN_COOKIE_NAME));
}
