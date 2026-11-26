// ─────────────────────────────────────────────────────────────────────────────
// Tiny JSON-file database. Everything lives in data/db.json on disk.
//
// A simple promise-chain mutex serializes writes so two requests landing at
// the same moment can't clobber each other.
// ─────────────────────────────────────────────────────────────────────────────
import { promises as fs } from "fs";
import path from "path";
import type { Course, Reservation, Settings } from "@/lib/types";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

export interface Db {
  course: Course;
  settings: Settings;
  reservations: Reservation[];
}

export const DEFAULT_COURSE: Course = { id: "one-day", name: "1 Day Surf Course", price: 3000, is_active: true };
export const DEFAULT_SETTINGS: Settings = { max_students_per_day: 8 };

const DEFAULT_DB: Db = { course: DEFAULT_COURSE, settings: DEFAULT_SETTINGS, reservations: [] };

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
  const parsed = JSON.parse(raw) as Partial<Db> & Record<string, unknown>;
  // Older files (multi-course + board rental) are migrated on the fly: the old
  // course list and board data are dropped, and only reservations in the
  // current shape are kept.
  return {
    course: parsed.course && typeof parsed.course === "object" ? { ...DEFAULT_COURSE, ...parsed.course } : DEFAULT_COURSE,
    settings: { max_students_per_day: (parsed.settings as Settings | undefined)?.max_students_per_day ?? DEFAULT_SETTINGS.max_students_per_day },
    reservations: (parsed.reservations ?? []).filter((r) => Array.isArray((r as Reservation).participants)),
  };
}

async function writeDbNow(db: Db): Promise<void> {
  await ensureFile();
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

/** Read-modify-write under the mutex: avoids two concurrent requests racing. */
export async function mutateDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = writeChain.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    await writeDbNow(db);
    return result;
  });
  // Keep the chain alive even if this step throws, or every later write would
  // fail with the same error.
  writeChain = run.then(() => undefined, () => undefined);
  return run;
}

export function generateId(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function todayLocal(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
