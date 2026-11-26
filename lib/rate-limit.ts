// Simple fixed-window rate limiter, per client IP and bucket name.
// In-memory, so on serverless hosting each warm instance counts separately —
// it's a speed bump against password guessing and spam, not a hard guarantee.
import "server-only";

const hits = new Map<string, { count: number; resetAt: number }>();

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

/** Returns true if the request is allowed, false if the limit is exceeded. */
export function rateLimit(request: Request, bucket: string, limit: number, windowMs: number): boolean {
  const key = `${bucket}:${clientIp(request)}`;
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}
