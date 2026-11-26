// ─────────────────────────────────────────────────────────────────────────────
// Core types for the LazyDog Surf booking system.
// One product only: the 1 Day Surf Course, booked per person, with two daily
// time slots. Every participant gives gender, age, weight and swim ability.
// ─────────────────────────────────────────────────────────────────────────────

export interface Course {
  id: string;
  name: string;
  /** Price per person, in Rs */
  price: number;
  is_active: boolean;
}

export type Gender = "male" | "female";

export interface Participant {
  /** "adult" or "child" — as the booker grouped them on the form */
  group: "adult" | "child";
  gender: Gender;
  age: number;
  /** Body weight in kg — used to pick the right board size */
  weight_kg: number;
  swimmer: boolean;
}

export interface Customer {
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
}

export type ReservationStatus = "pending" | "confirmed" | "cancelled";

export interface Reservation {
  id: string;
  order_ref: string;
  customer: Customer;
  course_date: string; // YYYY-MM-DD
  course_time: string; // one of TIME_SLOTS
  course_name: string;
  price_per_person: number;
  participants: Participant[];
  number_of_people: number;
  total_price: number;
  special_requests: string | null;
  /** When the booker ticked the liability waiver, and which version they saw */
  waiver_accepted_at: string;
  waiver_version: string;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  /** Max students per day (single instructor) */
  max_students_per_day: number;
}

export interface CreateBookingRequest {
  customer: Customer;
  course_date: string;
  course_time: string;
  participants: Participant[];
  special_requests?: string;
  waiver_accepted: boolean;
  waiver_version: string;
}
