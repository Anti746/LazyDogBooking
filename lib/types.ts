// ─────────────────────────────────────────────────────────────────────────────
// Core types for the Lazy Dog mini booking system (surf lessons + board rental
// only — no accommodation, no multi-instructor assignment).
// ─────────────────────────────────────────────────────────────────────────────

export type CourseType = "teaser" | "plunge" | "immerse" | "week" | "kids" | "private";

export interface Course {
  id: string;
  name: string;
  type: CourseType;
  duration: string;
  /** Price per person (or per lesson, for kids) */
  price: number;
  /** How many calendar days this course spans (1 for single lessons) */
  days: number;
  is_active: boolean;
  sort_order: number;
}

export interface Customer {
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
}

export type ReservationStatus = "pending" | "confirmed" | "cancelled";

/** One course-group within a booking — everyone in it does the same course. */
export interface ReservationGroup {
  course_type: CourseType;
  course_name: string;
  number_of_people: number;
  number_of_non_swimmers: number;
  total_price: number;
}

export interface Reservation {
  id: string;
  order_ref: string;
  customer: Customer;
  course_date: string; // YYYY-MM-DD
  course_time: string; // "08:00" | "10:00" | ...
  groups: ReservationGroup[];
  number_of_people: number;
  subtotal: number;
  discount: number;
  total_price: number;
  special_requests: string | null;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
}

export type RentalPricing = "hourly" | "day";
export type RentalStatus = "pending" | "confirmed" | "cancelled";

export interface BoardRental {
  id: string;
  order_ref: string;
  guest_name: string;
  guest_phone: string | null;
  board_type: string;
  quantity: number;
  pricing: RentalPricing;
  rental_date: string;
  planned_start: string | null;
  planned_hours: number | null;
  amount: number;
  status: RentalStatus;
  created_at: string;
}

export interface CreateBookingRequest {
  customer: Customer;
  course_date: string;
  course_time: string;
  number_of_people: number;
  number_of_kids: number;
  number_of_non_swimmers: number;
  /** One per swimmer when "different course per person" is used; otherwise one shared type */
  swimmer_course_types: CourseType[];
  kids_lesson_counts?: number[];
  special_requests?: string;
  board_rental?: {
    board_type: string;
    quantity: number;
    pricing: RentalPricing;
    planned_start?: string;
    planned_hours?: number;
  } | null;
}
