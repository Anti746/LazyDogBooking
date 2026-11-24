# LazyDog Surf — mini booking system

A simplified version of the Surf Wala project — surf lessons + board rental
only, no accommodation. Built on Next.js, data is stored in `data/db.json`
(no database setup needed).

## Running it

```bash
npm install
npm run dev
```

Opens at http://localhost:3000

- **Customer booking page**: `/`
- **Admin dashboard**: `/admin` (password `lazydog`, changeable via `ADMIN_PASSWORD` in `.env.local`)

## What's kept from the original project

- **Lesson pricing logic** (`lib/pricing.ts`) — the exact same logic as Surf
  Wala (`lib/surf-pricing.ts`): each swimmer can pick a different course,
  non-swimmers automatically go to a Private Lesson, kids are priced per
  lesson, 10% group discount for 3+ adults. (The seasonal "Peak Holiday"
  accommodation pricing was dropped, since LazyDog Surf has no accommodation.)
- **Board rental logic** (`lib/board-rental.ts`) — ported 1:1: hourly vs. day
  pricing (never more than the day price), availability by quantity, pickup
  time windows.

## What's simplified compared to the original project

- No accommodation, housekeeping, or rooms.
- No assigning multiple instructors — just one instructor, so a simple daily
  cap (default **8 students/day**, editable in Settings).
- One simple admin password instead of a role system.
- No emails / Google Calendar sync.
- Data in a JSON file instead of Supabase (easy to run; can be swapped for a
  real database later if it grows).

## Admin dashboard

- **Calendar** (`/admin/calendar`) — monthly view, each day shows an `x/8`
  badge; clicking a day shows that day's bookings and board rentals with
  confirm/cancel actions.
- **Settings** (`/admin/settings`) — edit lesson prices, board prices and
  quantities, the daily student cap, and rental pickup times.
