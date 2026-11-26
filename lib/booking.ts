// ─────────────────────────────────────────────────────────────────────────────
// Booking rules shared by the booking page and the API, so both sides always
// agree: time slots, allowed ranges, participant validation and the price.
// ─────────────────────────────────────────────────────────────────────────────

import type { Participant } from "@/lib/types";

/** The only two lesson start times. */
export const TIME_SLOTS = ["08:30", "10:00"] as const;

export const AGE_MIN = 5;
export const AGE_MAX = 80;
export const WEIGHT_MIN = 15;
export const WEIGHT_MAX = 150;
export const MAX_PEOPLE_PER_BOOKING = 8;

/** Returns an error message for the first invalid participant, or null. */
export function validateParticipants(list: unknown): string | null {
  if (!Array.isArray(list) || list.length === 0) return "Add at least one person.";
  if (list.length > MAX_PEOPLE_PER_BOOKING) return `At most ${MAX_PEOPLE_PER_BOOKING} people per booking.`;
  for (let i = 0; i < list.length; i++) {
    const p = list[i] as Partial<Participant>;
    const n = i + 1;
    if (p.gender !== "male" && p.gender !== "female") return `Person ${n}: please choose a gender.`;
    if (typeof p.age !== "number" || !Number.isInteger(p.age) || p.age < AGE_MIN || p.age > AGE_MAX) return `Person ${n}: age must be ${AGE_MIN}–${AGE_MAX}.`;
    if (typeof p.weight_kg !== "number" || !Number.isInteger(p.weight_kg) || p.weight_kg < WEIGHT_MIN || p.weight_kg > WEIGHT_MAX) return `Person ${n}: weight must be ${WEIGHT_MIN}–${WEIGHT_MAX} kg.`;
    if (typeof p.swimmer !== "boolean") return `Person ${n}: please say whether they can swim.`;
  }
  return null;
}

/** Group discount: 10% off everyone when 3 or more people book together.
 *  Everybody takes the same course, so there's no adult / child split. */
export const GROUP_DISCOUNT_RATE = 0.1;
export const GROUP_DISCOUNT_MIN_PEOPLE = 3;

export interface PriceBreakdown {
  people: number;
  subtotal: number;
  discount: number;
  total: number;
}

export function calcPrice(people: number, pricePerPerson: number): PriceBreakdown {
  const n = Math.max(0, Math.floor(people));
  const subtotal = n * Math.max(0, pricePerPerson);
  const discount = n >= GROUP_DISCOUNT_MIN_PEOPLE ? Math.round(subtotal * GROUP_DISCOUNT_RATE) : 0;
  return { people: n, subtotal, discount, total: subtotal - discount };
}
