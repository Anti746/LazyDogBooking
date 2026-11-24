// Single-password admin gate — much simpler than Surf Wala's staff-roles
// system, because Lazy Dog's mini dashboard has exactly one kind of user: the
// person running the beach desk.
const COOKIE = "lazydog_admin";

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "lazydog";
}

function readCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) return decodeURIComponent(trimmed.slice(name.length + 1));
  }
  return null;
}

export function isAuthed(request: Request): boolean {
  const header = request.headers.get("cookie") ?? "";
  const value = readCookie(header, COOKIE);
  return !!value && value === adminPassword();
}

export const ADMIN_COOKIE_NAME = COOKIE;
export function checkPassword(password: string): boolean {
  return password === adminPassword();
}
