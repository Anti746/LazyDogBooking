// ─────────────────────────────────────────────────────────────────────────────
// Booking rules shared by the booking page and the API, so both sides always
// agree: time slots, allowed ranges, participant validation and the price.
// ─────────────────────────────────────────────────────────────────────────────

import type { Participant } from "@/lib/types";

/** The only two lesson start times. */
export const TIME_SLOTS = ["08:30", "10:00"] as const;

export const ADULT_AGE_MIN = 18;
export const ADULT_AGE_MAX = 80;
export const CHILD_AGE_MIN = 5;
export const CHILD_AGE_MAX = 17;
export const WEIGHT_MIN = 15;
export const WEIGHT_MAX = 150;
export const MAX_PEOPLE_PER_BOOKING = 8;

export function ageRange(group: Participant["group"]): [number, number] {
  return group === "adult" ? [ADULT_AGE_MIN, ADULT_AGE_MAX] : [CHILD_AGE_MIN, CHILD_AGE_MAX];
}

/** Returns an error message for the first invalid participant, or null. */
export function validateParticipants(list: unknown): string | null {
  if (!Array.isArray(list) || list.length === 0) return "Add at least one person.";
  if (list.length > MAX_PEOPLE_PER_BOOKING) return `At most ${MAX_PEOPLE_PER_BOOKING} people per booking.`;
  for (let i = 0; i < list.length; i++) {
    const p = list[i] as Partial<Participant>;
    const n = i + 1;
    if (p.group !== "adult" && p.group !== "child") return `Person ${n}: invalid group.`;
    if (p.gender !== "male" && p.gender !== "female") return `Person ${n}: please choose a gender.`;
    const [min, max] = ageRange(p.group);
    if (typeof p.age !== "number" || !Number.isInteger(p.age) || p.age < min || p.age > max) return `Person ${n}: age must be ${min}–${max}.`;
    if (typeof p.weight_kg !== "number" || !Number.isInteger(p.weight_kg) || p.weight_kg < WEIGHT_MIN || p.weight_kg > WEIGHT_MAX) return `Person ${n}: weight must be ${WEIGHT_MIN}–${WEIGHT_MAX} kg.`;
    if (typeof p.swimmer !== "boolean") return `Person ${n}: please say whether they can swim.`;
  }
  return null;
}

/** Group discount, same rule as the original Surf Wala pricing: 10% off the
 *  adults' price when 3 or more adults book together. Children pay full price
 *  and don't count toward the 3. */
export const GROUP_DISCOUNT_RATE = 0.1;
export const GROUP_DISCOUNT_MIN_ADULTS = 3;

export interface PriceBreakdown {
  adults: number;
  children: number;
  subtotal: number;
  discount: number;
  total: number;
}

export function calcPrice(groups: Participant["group"][], pricePerPerson: number): PriceBreakdown {
  const price = Math.max(0, pricePerPerson);
  const adults = groups.filter((g) => g === "adult").length;
  const children = groups.length - adults;
  const subtotal = (adults + children) * price;
  const discount = adults >= GROUP_DISCOUNT_MIN_ADULTS ? Math.round(adults * price * GROUP_DISCOUNT_RATE) : 0;
  return { adults, children, subtotal, discount, total: subtotal - discount };
}
