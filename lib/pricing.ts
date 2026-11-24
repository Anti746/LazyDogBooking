// ─────────────────────────────────────────────────────────────────────────────
// Surf lesson pricing — ported from the Surf Wala project's lib/surf-pricing.ts.
// Same rules: each swimmer can pick their own course, non-swimmers are always
// billed as a Private Lesson, kids are billed per lesson, and a 10% group
// discount applies when 3+ adults book together. The Peak-Holiday-Season
// proration was dropped along with accommodation — Lazy Dog has none, so the
// discount is a flat 10% with no blackout dates.
// ─────────────────────────────────────────────────────────────────────────────

import type { Course, CourseType, ReservationGroup } from "@/lib/types";

export const GROUP_DISCOUNT_RATE = 0.1;
export const GROUP_DISCOUNT_MIN_ADULTS = 3;

export interface PriceInput {
  numberOfPeople: number;
  numberOfKids: number;
  numberOfNonSwimmers: number;
  /** One entry per swimmer (numberOfPeople - kids - nonSwimmers). */
  swimmerCourseTypes: (CourseType | undefined)[];
  kidsLessonCounts?: number[];
}

export interface PriceLine {
  kind: "course" | "non_swimmer" | "kids";
  courseType: CourseType;
  courseName: string;
  people: number;
  amount: number;
  discount: number;
}

export interface PriceResult {
  lines: PriceLine[];
  subtotal: number;
  discount: number;
  total: number;
  groups: ReservationGroup[];
}

export function calcSurfLessonsPrice(input: PriceInput, courses: Course[]): PriceResult {
  const find = (type?: string) => courses.find((c) => c.type === type && c.is_active);
  const lines: PriceLine[] = [];

  const kids = Math.max(0, input.numberOfKids);
  const nonSwimmers = Math.max(0, input.numberOfNonSwimmers);
  const total = Math.max(1, input.numberOfPeople);
  const nonKids = total - kids;
  const swimmers = Math.max(0, nonKids - nonSwimmers);

  // Kids: priced per lesson, each child can take a different number of lessons
  const kidsCourse = find("kids");
  if (kids > 0 && kidsCourse) {
    const lessons = input.kidsLessonCounts?.length ? input.kidsLessonCounts.reduce((a, b) => a + b, 0) : kids;
    lines.push({ kind: "kids", courseType: "kids", courseName: kidsCourse.name, people: kids, amount: kidsCourse.price * lessons, discount: 0 });
  }

  // Adults who can't swim: Private Lesson only
  const privateCourse = find("private");
  if (nonSwimmers > 0 && privateCourse) {
    lines.push({ kind: "non_swimmer", courseType: "private", courseName: privateCourse.name, people: nonSwimmers, amount: privateCourse.price * nonSwimmers, discount: 0 });
  }

  // Swimmers: each person's own course, grouped together when they match
  const byCourse = new Map<string, number>();
  input.swimmerCourseTypes.slice(0, swimmers).forEach((type) => {
    if (type && find(type)) byCourse.set(type, (byCourse.get(type) ?? 0) + 1);
  });
  [...byCourse.entries()].forEach(([type, people]) => {
    const course = find(type)!;
    lines.push({ kind: "course", courseType: type as CourseType, courseName: course.name, people, amount: course.price * people, discount: 0 });
  });

  // Group discount: 10% off lesson lines (not kids) when 3+ adults book together.
  const qualifies = nonKids >= GROUP_DISCOUNT_MIN_ADULTS;
  if (qualifies) {
    lines.filter((l) => l.kind !== "kids").forEach((l) => { l.discount = Math.round(l.amount * GROUP_DISCOUNT_RATE); });
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const discount = lines.reduce((s, l) => s + l.discount, 0);

  // Rows to save: one per distinct swimmer course; kids & non-swimmers ride
  // along with the first course row (or get their own row if nobody swims).
  const courseLines = lines.filter((l) => l.kind === "course");
  const extras = lines.filter((l) => l.kind !== "course");
  const net = (l: PriceLine) => l.amount - l.discount;
  let groups: ReservationGroup[];
  if (courseLines.length === 0) {
    const type: CourseType = nonKids > 0 ? "private" : "kids";
    const course = find(type);
    groups = extras.length
      ? [{ course_type: type, course_name: course?.name ?? type, number_of_people: total, number_of_non_swimmers: nonSwimmers, total_price: extras.reduce((s, l) => s + net(l), 0) }]
      : [];
  } else {
    groups = courseLines.map((l, i) => ({
      course_type: l.courseType,
      course_name: l.courseName,
      number_of_people: l.people + (i === 0 ? kids + nonSwimmers : 0),
      number_of_non_swimmers: i === 0 ? nonSwimmers : 0,
      total_price: net(l) + (i === 0 ? extras.reduce((s, e) => s + net(e), 0) : 0),
    }));
  }

  return { lines, subtotal, discount, total: subtotal - discount, groups };
}
