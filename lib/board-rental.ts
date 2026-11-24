// ─────────────────────────────────────────────────────────────────────────────
// Board rentals: pure pricing/availability functions, ported from the Surf Wala
// project's lib/board-rental.ts. The free-board-with-a-stay perk was dropped
// (Lazy Dog has no accommodation), everything else is unchanged.
// ─────────────────────────────────────────────────────────────────────────────

export interface BoardType {
  key: string;
  name: string;
  hourly_price: number;
  day_price: number;
  /** How many boards of this type exist */
  quantity: number;
  is_active: boolean;
  sort_order: number;
}

export interface RentalSettings {
  /** First pick-up time of the day, "HH:MM" */
  pickup_from: string;
  /** All-day boards (and the last hourly ones) must be back by this time, "HH:MM" */
  back_by: string;
  /** Max students per day (single instructor) */
  max_students_per_day: number;
}

export const DEFAULT_BOARD_TYPES: BoardType[] = [
  { key: "soft_top", name: "Soft top", hourly_price: 600, day_price: 1500, quantity: 5, is_active: true, sort_order: 1 },
  { key: "hard_top", name: "Hard top", hourly_price: 700, day_price: 1500, quantity: 5, is_active: true, sort_order: 2 },
  { key: "boogie", name: "Boogie board", hourly_price: 300, day_price: 1000, quantity: 5, is_active: true, sort_order: 3 },
];

export const DEFAULT_RENTAL_SETTINGS: RentalSettings = { pickup_from: "07:00", back_by: "18:30", max_students_per_day: 8 };

export type RentalPricing = "hourly" | "day";

export const MAX_RENTAL_HOURS = 10;

/**
 * Price of a rental. Hourly is rate × hours but never more than the all-day
 * price, so nobody pays more by the hour than they would for the whole day.
 */
export function rentalCharge(input: { pricing: RentalPricing; quantity: number; hours: number; hourly_price: number; day_price: number }): number {
  const quantity = Math.max(1, input.quantity);
  if (input.pricing === "day") return input.day_price * quantity;
  const hours = Math.max(1, input.hours);
  return Math.min(input.hourly_price * hours, input.day_price) * quantity;
}

function minutesOfDay(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Pick-up times offered online: every 30 minutes from opening until an hour before closing. */
export function pickupTimes(settings: RentalSettings): string[] {
  const start = minutesOfDay(settings.pickup_from);
  const end = minutesOfDay(settings.back_by) - 60;
  const times: string[] = [];
  for (let m = start; m <= end; m += 30) times.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return times;
}

/** Longest hourly booking that still ends by closing time. */
export function maxHoursFrom(startTime: string, settings: RentalSettings): number {
  return Math.max(1, Math.min(MAX_RENTAL_HOURS, Math.floor((minutesOfDay(settings.back_by) - minutesOfDay(startTime)) / 60)));
}

/** Statuses that hold a board for a day. */
export const HOLDING_STATUSES = ["pending", "confirmed"] as const;

/** Boards of each type still free on a date, given that date's rentals. */
export function availabilityFor(types: BoardType[], rentals: { board_type: string; quantity: number; status: string }[]): Record<string, number> {
  const held: Record<string, number> = {};
  rentals.forEach((r) => {
    if ((HOLDING_STATUSES as readonly string[]).includes(r.status)) held[r.board_type] = (held[r.board_type] ?? 0) + r.quantity;
  });
  const free: Record<string, number> = {};
  types.forEach((t) => { free[t.key] = Math.max(0, t.quantity - (held[t.key] ?? 0)); });
  return free;
}
