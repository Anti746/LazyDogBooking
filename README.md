# LazyDog Surf — booking system

Booking page for the **1 Day Surf Course** (3,000 Rs per person, lessons at
08:30 or 10:00, 10% off when 3+ people book together). Next.js + Supabase
(PostgreSQL).

- **Customer booking page**: `/`
- **Privacy Policy**: `/privacy`
- **Admin dashboard**: `/admin` — not linked anywhere, password-protected

---

## 1. Set up Supabase (once)

1. **Create a project** at supabase.com. Choose an **EU region**
   (e.g. *Central EU — Frankfurt*) so customers' data stays in the EU.
2. **SQL Editor → New query** → paste and run
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. **Give the app's database role a password.** In the SQL Editor run
   (replace with a long random password — at least 32 characters — and
   **don't save it in any file or in git**):
   ```sql
   alter role lazydog_app with password 'PASTE-A-LONG-RANDOM-PASSWORD';
   ```
4. **Nightly deletion of old data:** Database → Extensions → enable
   **pg_cron**, then run
   [`supabase/migrations/0002_retention_schedule.sql`](supabase/migrations/0002_retention_schedule.sql).
5. **Turn off the public Data API** (the app doesn't use it, so this closes
   a door that doesn't need to be open): Project Settings → Data API →
   disable.
6. **Connection string:** Project Settings → Database → Connection string →
   **Transaction pooler**. Change the user to `lazydog_app.<project-ref>` and
   put in the password from step 3:
   ```
   postgresql://lazydog_app.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```
7. **Sign the Data Processing Agreement** with Supabase (Organization
   settings → Legal Documents) and with your hosting provider.

## 2. Environment variables

Set these on your host (e.g. Vercel → Project → Settings → Environment
Variables). For local development, copy `.env.example` to `.env.local`.
**Never commit real values.**

| Variable | What |
|---|---|
| `DATABASE_URL` | Connection string from step 6 |
| `DATABASE_CA_CERT` | Recommended. Supabase → Database → SSL Configuration → download the certificate and paste its contents (newlines as `\n`). Enables full TLS certificate verification. |
| `ADMIN_PASSWORD` | Admin password. **In production it must be 12+ characters**, otherwise the admin login is switched off. Locally it defaults to `0000`. |
| `SESSION_SECRET` | Optional: any long random string, used to sign admin sessions. |

## 3. Before going live — checklist

- [ ] Fill in the controller's details (name, address, email, phone) in
      [`lib/legal.ts`](lib/legal.ts). Until then `/privacy` shows a red
      "Draft" warning.
- [ ] Strong `ADMIN_PASSWORD` set on the host.
- [ ] Supabase project in an EU region, Data API disabled, DPA signed.
- [ ] Have a lawyer check the liability waiver
      ([`lib/waiver.ts`](lib/waiver.ts)) and the privacy policy
      ([`app/privacy/page.tsx`](app/privacy/page.tsx)) — including India's
      Digital Personal Data Protection Act 2023, since the business is in
      India.

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL
npm run dev                  # http://localhost:3000
```

---

## How customer data is protected (GDPR)

| | |
|---|---|
| **No public database access** | The browser never talks to the database. All reads and writes go through the server, which connects as `lazydog_app` — a role that can only do what the app needs. It can't insert bookings directly (only via `create_booking()`), can't change prices of existing bookings, can't create tables. Row Level Security is on for every table; Supabase's public `anon` / `authenticated` keys have every privilege revoked. |
| **Data minimisation** | Booker: name, phone, optional email. Participants: gender, age, weight, swim ability — no names. Notes field asks people *not* to write medical details. |
| **Storage limitation** | Bookings are deleted automatically 24 months after the lesson date (nightly job + every time the admin calendar loads). Change in `0001_init.sql` and `lib/legal.ts` together. |
| **Data subject rights** | Admin → **Customer data**: search by email, phone or booking reference → **Export (JSON)** for access requests, **Delete all** for erasure requests. Each booking in the calendar also has **Delete data**. |
| **Admin login** | Cookie holds a signed 8-hour session token (never the password); HttpOnly, SameSite=Strict, Secure; constant-time password check; 5 attempts per 15 min per IP. |
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

## Not included yet

- Confirmation emails.
