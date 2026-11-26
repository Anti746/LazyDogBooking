# LazyDog Surf — booking system

Booking page for the **1 Day Surf Course** (3,000 Rs per person, lessons at
08:30 or 10:00, 10% off when 3+ people book together). Next.js + Supabase
(PostgreSQL).

- **Customer booking page**: `/`
- **Privacy Policy**: `/privacy`
- **Admin dashboard**: `/admin` — not linked anywhere, password-protected

---

## 1. Supabase setup

The connected Supabase integration provisions the project and injects its
credentials into the app. The schema is defined in
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql); the
nightly retention schedule is in
[`supabase/migrations/0002_retention_schedule.sql`](supabase/migrations/0002_retention_schedule.sql).

The current Supabase project is in `us-east-1` (United States). If your legal
or customer requirements mandate EU data residency, move to an EU-region
project before production; database encryption does not change the hosting
region. Review and sign the applicable Data Processing Agreements with
Supabase and the hosting provider.

## 2. Environment variables

v0 injects Supabase connection variables. The application uses the secret key
only in server-only code; never prefix it with `NEXT_PUBLIC_`, expose it to a
browser, or commit it. For other deployments, set these as server environment
variables. For local development, copy `.env.example` to `.env.local` and use
private values; **never commit real values**.

| Variable | What |
|---|---|
| `SUPABASE_URL` | Supabase project URL (the app can also use `NEXT_PUBLIC_SUPABASE_URL`) |
| `SUPABASE_SECRET_KEY` | Server-only key for database operations; legacy `SUPABASE_SERVICE_ROLE_KEY` is accepted as a fallback |
| `ADMIN_PASSWORD` | Unique admin password of at least 16 characters. Login stays disabled in every environment if missing or too short; there is no default password. |
| `SESSION_SECRET` | Independent random secret of at least 32 characters. Login stays disabled in every environment if missing or too short. |
| `GMAIL_USER` | Gmail address the booking emails are sent from — the same one as in the Surf Wala project. New-booking notifications also go to this address. |
| `GMAIL_APP_PASSWORD` | Google **App password** for that account (same as Surf Wala). |

## 3. Before going live — checklist

- [ ] Fill in the controller's details (name, address, email, phone) in
      [`lib/legal.ts`](lib/legal.ts). Until then `/privacy` shows a red
      "Draft" warning.
- [ ] Strong `ADMIN_PASSWORD` set on the host.
- [ ] `GMAIL_USER` and `GMAIL_APP_PASSWORD` set on the host (same as Surf Wala).
- [ ] Confirm the Supabase region meets your residency requirements (currently `us-east-1`); DPA signed.
- [ ] Verify production `ADMIN_PASSWORD` (16+ characters) and independent `SESSION_SECRET` (32+ characters) are set.
- [ ] Have a lawyer check the liability waiver
      ([`lib/waiver.ts`](lib/waiver.ts)) and the privacy policy
      ([`app/privacy/page.tsx`](app/privacy/page.tsx)) — including India's
      Digital Personal Data Protection Act 2023, since the business is in
      India.

## Running locally

```bash
npm install
cp .env.example .env.local   # configure Supabase and admin secrets
npm run dev                  # http://localhost:3000
```

---

## How customer data is protected (GDPR)

| | |
|---|---|
| **No public database access** | The browser never receives the secret key. Every table has RLS enabled and no policies for public roles; `anon` and `authenticated` have no table access. A server-only Supabase secret key has explicit grants limited to the API's required reads, course/settings updates, reservation status updates and erasure. Booking creation is only through `create_booking()`, which checks the live price, validates totals, serializes capacity checks and writes atomically. |
| **Data minimisation** | Booker: name, phone, optional email. Participants: gender, age, weight, swim ability — no names. Notes field asks people *not* to write medical details. |
| **Storage limitation** | Bookings are deleted automatically 24 months after the lesson date (nightly job + every time the admin calendar loads). Change in `0001_init.sql` and `lib/legal.ts` together. |
| **Data subject rights** | Admin → **Customer data**: search by email, phone or booking reference → **Export (JSON)** for access requests, **Delete all** for erasure requests. Each booking in the calendar also has **Delete data**. |
| **Admin login** | Cookie holds a signed 8-hour session token (never the password); HttpOnly, SameSite=Strict, Secure; constant-time password check; 5 attempts per 15 min per IP. Production login fails closed unless a 16+ character admin password and independent 32+ character session secret are configured. |
| **No third parties in the browser** | Fonts are bundled (no Google Fonts), no analytics, no tracking cookies — so no cookie banner is needed. A strict Content-Security-Policy blocks anything loaded from other domains. |
| **Encryption** | HTTPS (HSTS) to the site, TLS to the database, Supabase encrypts data at rest. |
| **Waiver proof** | Each booking stores when the waiver was accepted and which version of the text was shown (`WAIVER_VERSION` in `lib/waiver.ts` — bump it whenever the wording changes). |
| **Overbooking** | `create_booking()` locks the day, checks the daily cap and inserts in one transaction, so simultaneous bookings can't exceed it. |

## Code map

- `lib/booking.ts` — time slots, allowed ranges, validation, price & discount
- `lib/db.ts` — every database query (server-only)
- `lib/waiver.ts` — waiver text and version
- `lib/legal.ts` — controller details, retention period
- `lib/auth.ts` — admin sessions
- `supabase/migrations/` — schema, permissions, functions, retention job

## Emails

Sent from `GMAIL_USER`, labelled "LazyDog Surf" (`lib/email.ts`):

1. **Booking request → customer**: summary, 50% deposit, bank details and
   the UPI QR code (`lib/payment.ts`). Subject: *LazyDog reservation —
   request received*.
2. **Booking request → you** (`GMAIL_USER`): new booking waiting for
   confirmation.
3. **Admin clicks Confirm → customer**: *LazyDog reservation confirmed*.

If sending fails the booking is still saved; the customer's screen and the
admin calendar say so.
