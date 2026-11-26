// ─────────────────────────────────────────────────────────────────────────────
// Database access (Supabase Postgres). SERVER ONLY — importing this from a
// client component fails the build, so the connection string can never end
// up in the browser bundle.
//
// Connects as the `lazydog_app` role (see supabase/migrations/0001_init.sql):
// it can read, change a booking's status, erase a booking, and create
// bookings only through create_booking(). Every query is parameterised.
// ─────────────────────────────────────────────────────────────────────────────
import "server-only";
import { Pool, type PoolConfig } from "pg";
import type { Course, Participant, Reservation, ReservationStatus, Settings } from "@/lib/types";

declare global {
  // Re-use one pool across hot reloads / warm serverless invocations.
  // eslint-disable-next-line no-var
  var __lazydogPool: Pool | undefined;
}

function sslConfig(): PoolConfig["ssl"] {
  if (process.env.DATABASE_SSL === "disable") return false; // local development only
  const ca = process.env.DATABASE_CA_CERT;
  if (ca) return { ca: ca.replace(/\\n/g, "\n"), rejectUnauthorized: true };
  // Encrypted, but the server certificate isn't verified. Set DATABASE_CA_CERT
  // (Supabase → Project Settings → Database → SSL certificate) to verify it.
  if (process.env.NODE_ENV === "production") {
    console.warn("[db] DATABASE_CA_CERT is not set — TLS is on but the server certificate is not verified.");
  }
  return { rejectUnauthorized: false };
}

function pool(): Pool {
  if (!globalThis.__lazydogPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    globalThis.__lazydogPool = new Pool({
      connectionString,
      ssl: sslConfig(),
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalThis.__lazydogPool;
}

async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool().query(text, params);
  return res.rows as T[];
}

// ── Course & settings ────────────────────────────────────────────────────────

export async function getCourse(): Promise<Course> {
  const [row] = await q<Course>("select id, name, price, is_active from public.course limit 1");
  return row;
}

export async function updateCourse(patch: Partial<Pick<Course, "name" | "price" | "is_active">>): Promise<Course> {
  const [row] = await q<Course>(
    `update public.course set
       name = coalesce($1, name), price = coalesce($2, price), is_active = coalesce($3, is_active), updated_at = now()
     returning id, name, price, is_active`,
    [patch.name ?? null, patch.price ?? null, patch.is_active ?? null],
  );
  return row;
}

export async function getSettings(): Promise<Settings> {
  const [row] = await q<Settings>("select max_students_per_day from public.settings limit 1");
  return row;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const [row] = await q<Settings>(
    "update public.settings set max_students_per_day = coalesce($1, max_students_per_day), updated_at = now() returning max_students_per_day",
    [patch.max_students_per_day ?? null],
  );
  return row;
}

// ── Availability (counts only — no personal data) ───────────────────────────

export async function bookedPerDay(monthYYYYMM: string): Promise<Record<string, number>> {
  const rows = await q<{ day: string; booked: number }>(
    `select to_char(course_date, 'YYYY-MM-DD') as day, sum(number_of_people)::int as booked
       from public.reservations
      where status <> 'cancelled' and to_char(course_date, 'YYYY-MM') = $1
      group by course_date`,
    [monthYYYYMM],
  );
  return Object.fromEntries(rows.map((r) => [r.day, r.booked]));
}

// ── Bookings ────────────────────────────────────────────────────────────────

export class BookingError extends Error {
  constructor(public code: "CAPACITY" | "BOOKINGS_CLOSED" | "PRICE_CHANGED", public free?: number, public cap?: number) {
    super(code);
  }
}

export interface NewBooking {
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  course_date: string;
  course_time: string;
  participants: Participant[];
  special_requests: string | null;
  waiver_version: string;
  price_per_person: number;
  subtotal: number;
  discount: number;
  total_price: number;
}

export async function createBooking(b: NewBooking): Promise<{ id: string; order_ref: string; total_price: number }> {
  try {
    const [row] = await q<{ result: { id: string; order_ref: string; total_price: number } }>(
      "select public.create_booking($1, $2, $3, $4::date, $5, $6::jsonb, $7, $8, $9, $10, $11, $12) as result",
      [
        b.customer_name, b.customer_phone, b.customer_email, b.course_date, b.course_time,
        JSON.stringify(b.participants), b.special_requests, b.waiver_version,
        b.price_per_person, b.subtotal, b.discount, b.total_price,
      ],
    );
    return row.result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const cap = /^CAPACITY:(\d+):(\d+)$/.exec(msg);
    if (cap) throw new BookingError("CAPACITY", Number(cap[1]), Number(cap[2]));
    if (msg === "BOOKINGS_CLOSED" || msg === "PRICE_CHANGED") throw new BookingError(msg);
    throw err;
  }
}

const RESERVATION_SELECT = `
  select r.id, r.order_ref, r.customer_name, r.customer_phone, r.customer_email,
         to_char(r.course_date, 'YYYY-MM-DD') as course_date, r.course_time, r.course_name,
         r.price_per_person, r.number_of_people, r.subtotal, r.discount, r.total_price,
         r.special_requests, r.waiver_accepted_at, r.waiver_version, r.status, r.created_at, r.updated_at,
         coalesce((select json_agg(json_build_object('gender', p.gender, 'age', p.age, 'weight_kg', p.weight_kg, 'swimmer', p.swimmer) order by p.position)
                     from public.participants p where p.reservation_id = r.id), '[]'::json) as participants
    from public.reservations r`;

export async function getReservation(id: string): Promise<Reservation | null> {
  const [row] = await q<Reservation>(`${RESERVATION_SELECT} where r.id = $1`, [id]);
  return row ?? null;
}

export async function listReservations(fromDate: string, toDate: string): Promise<Reservation[]> {
  return q<Reservation>(`${RESERVATION_SELECT} where r.course_date between $1::date and $2::date order by r.course_date, r.course_time, r.created_at`, [fromDate, toDate]);
}

/** Data-subject requests (GDPR Art. 15 / 17): find everything for one person. */
export async function findReservationsByContact(term: string): Promise<Reservation[]> {
  const t = term.trim();
  const digits = t.replace(/\D/g, "");
  return q<Reservation>(
    `${RESERVATION_SELECT}
      where lower(r.customer_email) = lower($1)
         or ($2 <> '' and length($2) >= 6 and regexp_replace(r.customer_phone, '\\D', '', 'g') like '%' || $2 || '%')
         or upper(r.order_ref) = upper($1)
      order by r.course_date desc`,
    [t, digits],
  );
}

export async function setReservationStatus(id: string, status: ReservationStatus): Promise<boolean> {
  const rows = await q("update public.reservations set status = $2, updated_at = now() where id = $1 returning id", [id, status]);
  return rows.length > 0;
}

/** GDPR erasure: removes the booking and (by cascade) its participants. */
export async function deleteReservation(id: string): Promise<boolean> {
  const rows = await q("delete from public.reservations where id = $1 returning id", [id]);
  return rows.length > 0;
}

/** Deletes bookings past the retention period. Returns how many were removed. */
export async function purgeExpiredPersonalData(): Promise<number> {
  const [row] = await q<{ n: number }>("select public.purge_expired_personal_data() as n");
  return row.n;
}
