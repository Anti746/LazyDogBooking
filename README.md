# LazyDog Surf — booking system

Booking page for the **1 Day Surf Course** (3,000 Rs per person, lessons at
08:30 or 10:00). Built on Next.js; data is stored in `data/db.json` (no
database setup needed).

## Running it

```bash
npm install
npm run dev
```

Opens at http://localhost:3000

- **Customer booking page**: `/`
- **Admin dashboard**: `/admin` — not linked anywhere; password `0000`
  (change it with `ADMIN_PASSWORD` in `.env.local`)

## Booking flow

1. **Details** — number of adults and children, then for **each person**:
   gender, age, weight and a Swimmer / Non-swimmer toggle. Date (rolling
   4 weeks from tomorrow, days without enough free spots are disabled) and
   lesson time.
2. **Your details** — name, phone, email, notes, a summary, and the
   **liability waiver**, which must be ticked before the booking can be sent.
   The server rejects bookings without it and stores when it was accepted and
   which waiver version was shown.

## Rules

- One product: the 1 Day Surf Course, flat price per person (edit name,
  price and open/closed in Admin → Settings).
- Max 8 people per booking; max students per day (default 8, single
  instructor) editable in Admin → Settings.
- All rules live in `lib/booking.ts`; the waiver text in `lib/waiver.ts`
  (bump `WAIVER_VERSION` whenever you change the wording).

## Admin dashboard

- **Calendar** (`/admin/calendar`) — monthly view with an `x/8` badge per day;
  click a day to see every booking with each participant's gender, age,
  weight and swim ability (non-swimmers highlighted), plus confirm / cancel.
- **Settings** (`/admin/settings`) — course name and price, bookings on/off,
  daily student cap.

## Not included yet

- No confirmation emails.
- `data/db.json` needs a server with a writable disk. Serverless hosting
  (e.g. Vercel) can't write to it — bookings there need a real database.
