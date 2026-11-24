// ─────────────────────────────────────────────────────────────────────────────
// Tiny JSON-file database. No external service to set up — everything lives in
// data/db.json on disk. Good enough for one small surf school running on one
// server; swap for a real database later if Lazy Dog outgrows it.
//
// A simple promise-chain mutex serializes writes so two requests landing at
// the same moment can't clobber each other.
// ─────────────────────────────────────────────────────────────────────────────
import { promises as fs } from "fs";
import path from "path";
import type { BoardRental, Course, Reservation } from "@/lib/types";
import type { BoardType, RentalSettings } from "@/lib/board-rental";
import { DEFAULT_BOARD_TYPES, DEFAULT_RENTAL_SETTINGS } from "@/lib/board-rental";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

export interface Db {
  courses: Course[];
  board_types: BoardType[];
  settings: RentalSettings;
  reservations: Reservation[];
  board_rentals: BoardRental[];
}

const DEFAULT_COURSES: Course[] = [
  { id: "teaser", name: "1 Day", type: "teaser", duration: "1.5h", price: 1500, days: 1, is_active: true, sort_order: 1 },
  { id: "plunge", name: "3 Day", type: "plunge", duration: "3 lessons × 1.5h", price: 4000, days: 3, is_active: true, sort_order: 2 },
  { id: "immerse", name: "5 Day", type: "immerse", duration: "5 lessons × 1.5h", price: 6000, days: 5, is_active: true, sort_order: 3 },
  { id: "week", name: "7 Day", type: "week", duration: "7 lessons × 1.5h", price: 8000, days: 7, is_active: true, sort_order: 4 },
  { id: "kids", name: "Kids Lesson", type: "kids", duration: "1.5h", price: 1200, days: 1, is_active: true, sort_order: 5 },
  { id: "private", name: "Private Lesson", type: "private", duration: "1.5h", price: 2500, days: 1, is_active: true, sort_order: 6 },
];

const DEFAULT_DB: Db = {
  courses: DEFAULT_COURSES,
  board_types: DEFAULT_BOARD_TYPES,
  settings: DEFAULT_RENTAL_SETTINGS,
  reservations: [],
  board_rentals: [],
};

let writeChain: Promise<void> = Promise.resolve();

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf-8");
  }
}

export async function readDb(): Promise<Db> {
  await ensureFile();
  const raw = await fs.readFile(DB_PATH, "utf-8");
  const parsed = JSON.parse(raw) as Partial<Db>;
  // Fill in anything missing (e.g. a brand new field added later).
  return {
    courses: parsed.courses?.length ? parsed.courses : DEFAULT_COURSES,
    board_types: parsed.board_types?.length ? parsed.board_types : DEFAULT_BOARD_TYPES,
    settings: { ...DEFAULT_RENTAL_SETTINGS, ...parsed.settings },
    reservations: parsed.reservations ?? [],
    board_rentals: parsed.board_rentals ?? [],
  };
}

async function writeDbNow(db: Db): Promise<void> {
  await ensureFile();
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

/** Read-modify-write under the mutex: avoids two concurrent requests racing. */
export async function mutateDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  let result!: T;
  writeChain = writeChain.then(async () => {
    const db = await readDb();
    result = await fn(db);
    await writeDbNow(db);
  });
  await writeChain;
  return result;
}

export function generateId(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function todayLocal(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
