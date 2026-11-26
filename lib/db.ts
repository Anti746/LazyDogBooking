import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Course, Participant, Reservation, ReservationStatus, Settings } from "@/lib/types";

let adminClient: SupabaseClient | undefined;

function db(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");

  adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return adminClient;
}

function throwDatabaseError(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown database error"}`);
}

// ── Course & settings ────────────────────────────────────────────────────────

export async function getCourse(): Promise<Course> {
  const { data, error } = await db().from("course").select("id, name, price, is_active").limit(1).maybeSingle();
  if (error) throwDatabaseError("Could not load course", error);
  if (!data) throw new Error("Course configuration is missing.");
  return data as Course;
}

export async function updateCourse(patch: Partial<Pick<Course, "name" | "price" | "is_active">>): Promise<Course> {
  const { data, error } = await db()
    .from("course")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .select("id, name, price, is_active")
    .limit(1)
    .maybeSingle();
  if (error) throwDatabaseError("Could not update course", error);
  if (!data) throw new Error("Course configuration is missing.");
  return data as Course;
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await db().from("settings").select("max_students_per_day").limit(1).maybeSingle();
  if (error) throwDatabaseError("Could not load settings", error);
  if (!data) throw new Error("Booking settings are missing.");
  return data as Settings;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const { data, error } = await db()
    .from("settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .select("max_students_per_day")
    .limit(1)
    .maybeSingle();
  if (error) throwDatabaseError("Could not update settings", error);
  if (!data) throw new Error("Booking settings are missing.");
  return data as Settings;
}

// ── Availability: return counts only, never customer information ─────────────

export async function bookedPerDay(monthYYYYMM: string): Promise<Record<string, number>> {
  const [year, month] = monthYYYYMM.split("-").map(Number);
  const firstDay = `${monthYYYYMM}-01`;
  const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const { data, error } = await db()
    .from("reservations")
    .select("course_date, number_of_people")
    .gte("course_date", firstDay)
    .lt("course_date", nextMonth)
    .neq("status", "cancelled");
  if (error) throwDatabaseError("Could not load availability", error);

  const booked: Record<string, number> = {};
  for (const row of data ?? []) {
    const date = String(row.course_date);
    booked[date] = (booked[date] ?? 0) + Number(row.number_of_people);
  }
  return booked;
}

// ── Bookings ──────────────────────────────────────────────────────────────────

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

export async function createBooking(booking: NewBooking): Promise<{ id: string; order_ref: string; total_price: number }> {
  const { data, error } = await db().rpc("create_booking", {
    p_customer_name: booking.customer_name,
    p_customer_phone: booking.customer_phone,
    p_customer_email: booking.customer_email,
    p_course_date: booking.course_date,
    p_course_time: booking.course_time,
    p_participants: booking.participants,
    p_special_requests: booking.special_requests,
    p_waiver_version: booking.waiver_version,
    p_price_per_person: booking.price_per_person,
    p_subtotal: booking.subtotal,
    p_discount: booking.discount,
    p_total_price: booking.total_price,
  });

  if (error) {
    const message = error.message;
    const capacity = /CAPACITY:(\d+):(\d+)/.exec(message);
    if (capacity) throw new BookingError("CAPACITY", Number(capacity[1]), Number(capacity[2]));
    if (message.includes("BOOKINGS_CLOSED")) throw new BookingError("BOOKINGS_CLOSED");
    if (message.includes("PRICE_CHANGED")) throw new BookingError("PRICE_CHANGED");
    throwDatabaseError("Could not create booking", error);
  }
  if (!data || typeof data !== "object") throw new Error("Booking creation returned no result.");
  return data as { id: string; order_ref: string; total_price: number };
}

type ReservationRow = Omit<Reservation, "participants"> & {
  participants: (Participant & { position: number })[];
};

const RESERVATION_FIELDS = "id, order_ref, customer_name, customer_phone, customer_email, course_date, course_time, course_name, price_per_person, number_of_people, subtotal, discount, total_price, special_requests, waiver_accepted_at, waiver_version, status, created_at, updated_at, participants(gender, age, weight_kg, swimmer, position)";

function withOrderedParticipants(rows: ReservationRow[] | null): Reservation[] {
  return (rows ?? []).map((row) => ({
    ...row,
    participants: [...(row.participants ?? [])]
      .sort((a, b) => a.position - b.position)
      .map(({ position: _position, ...participant }) => participant),
  }));
}

export async function getReservation(id: string): Promise<Reservation | null> {
  const [row] = await q<Reservation>(`${RESERVATION_SELECT} where r.id = $1`, [id]);
  return row ?? null;
}

export async function listReservations(fromDate: string, toDate: string): Promise<Reservation[]> {
  const { data, error } = await db()
    .from("reservations")
    .select(RESERVATION_FIELDS)
    .gte("course_date", fromDate)
    .lte("course_date", toDate)
    .order("course_date", { ascending: true })
    .order("course_time", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throwDatabaseError("Could not load reservations", error);
  return withOrderedParticipants(data as ReservationRow[] | null);
}

export async function findReservationsByContact(term: string): Promise<Reservation[]> {
  const { data, error } = await db().rpc("find_reservations_by_contact", { p_term: term.trim() });
  if (error) throwDatabaseError("Could not search reservations", error);
  return withOrderedParticipants(data as ReservationRow[] | null);
}

export async function setReservationStatus(id: string, status: ReservationStatus): Promise<boolean> {
  const { data, error } = await db()
    .from("reservations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throwDatabaseError("Could not update reservation", error);
  return Boolean(data);
}

export async function deleteReservation(id: string): Promise<boolean> {
  const { data, error } = await db().from("reservations").delete().eq("id", id).select("id").maybeSingle();
  if (error) throwDatabaseError("Could not delete reservation", error);
  return Boolean(data);
}

export async function purgeExpiredPersonalData(): Promise<number> {
  const { data, error } = await db().rpc("purge_expired_personal_data", { p_older_than: "24 months" });
  if (error) throwDatabaseError("Could not purge expired personal data", error);
  return Number(data ?? 0);
}
