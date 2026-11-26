-- ─────────────────────────────────────────────────────────────────────────────
-- LazyDog Surf — database schema (Supabase / PostgreSQL)
--
-- Run once in Supabase → SQL Editor (or `supabase db push`).
--
-- Security model (GDPR Art. 25 & 32 — data protection by design, security):
--   • The browser NEVER talks to the database. All access goes through the
--     Next.js API routes on the server, which connect as `lazydog_app` — a
--     dedicated role with only the privileges the app needs (least privilege).
--     Its password lives only in a server-side environment variable.
--   • Row Level Security is ON for every table. Only `lazydog_app` has
--     policies; the public `anon` / `authenticated` roles (Supabase's public
--     API keys) have every privilege revoked, so they can read or write nothing.
--   • `lazydog_app` cannot INSERT bookings directly — only through
--     create_booking(), which checks capacity and inserts in one locked
--     transaction, so two people booking the same day at the same moment
--     can't overbook it.
--   • purge_expired_personal_data() deletes customer data once the retention
--     period is over (GDPR Art. 5(1)(e) — storage limitation).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tables ──────────────────────────────────────────────────────────────────

create table public.course (
  id          text primary key default 'one-day' check (id = 'one-day'),  -- exactly one row
  name        text    not null check (length(name) between 1 and 60),
  price       integer not null check (price >= 0),                         -- Rs per person
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table public.settings (
  id                    boolean primary key default true check (id),      -- exactly one row
  max_students_per_day  integer not null default 8 check (max_students_per_day between 1 and 100),
  updated_at            timestamptz not null default now()
);

create table public.reservations (
  id                  uuid primary key default gen_random_uuid(),
  order_ref           text not null unique,
  -- Personal data of the person who booked (contact only, nothing more).
  customer_name       text not null check (length(customer_name) between 1 and 120),
  customer_phone      text not null check (length(customer_phone) between 3 and 30),
  customer_email      text          check (customer_email is null or length(customer_email) <= 100),
  course_date         date not null,
  course_time         text not null check (course_time in ('08:30', '10:00')),
  course_name         text not null,
  price_per_person    integer not null check (price_per_person >= 0),
  number_of_people    integer not null check (number_of_people between 1 and 8),
  subtotal            integer not null check (subtotal >= 0),
  discount            integer not null check (discount >= 0),
  total_price         integer not null check (total_price >= 0),
  special_requests    text check (special_requests is null or length(special_requests) <= 500),
  -- Proof the liability waiver was accepted, and which wording was shown.
  waiver_accepted_at  timestamptz not null,
  waiver_version      text not null,
  status              text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index reservations_course_date_idx on public.reservations (course_date);

-- One row per person taking the lesson. No names — only what the instructor
-- needs for safety and board sizing (data minimisation, GDPR Art. 5(1)(c)).
create table public.participants (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references public.reservations (id) on delete cascade,
  position        smallint not null check (position between 1 and 8),
  gender          text     not null check (gender in ('male', 'female')),
  age             smallint not null check (age between 5 and 80),
  weight_kg       smallint not null check (weight_kg between 15 and 150),
  swimmer         boolean  not null,
  unique (reservation_id, position)
);

-- ── Lock everything down ────────────────────────────────────────────────────

alter table public.course       enable row level security;
alter table public.settings     enable row level security;
alter table public.reservations enable row level security;
alter table public.participants enable row level security;
-- (No policies on purpose: anon / authenticated get nothing. service_role
--  bypasses RLS and is only ever used on the server.)

revoke all on public.course, public.settings, public.reservations, public.participants from anon, authenticated;

-- ── Seed ────────────────────────────────────────────────────────────────────

insert into public.course (name, price) values ('1 Day Surf Course', 3000);
insert into public.settings default values;

-- ── create_booking: capacity check + insert in one locked transaction ───────

create or replace function public.create_booking(
  p_customer_name     text,
  p_customer_phone    text,
  p_customer_email    text,
  p_course_date       date,
  p_course_time       text,
  p_participants      jsonb,     -- [{gender, age, weight_kg, swimmer}, …]
  p_special_requests  text,
  p_waiver_version    text,
  p_price_per_person  integer,   -- what the server priced with; must still match
  p_subtotal          integer,
  p_discount          integer,
  p_total_price       integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course   public.course;
  v_cap      integer;
  v_booked   integer;
  v_people   integer := jsonb_array_length(p_participants);
  v_id       uuid;
  v_ref      text;
begin
  -- Serialise bookings for the same day, so the capacity check can't race.
  perform pg_advisory_xact_lock(hashtextextended('lazydog-booking:' || p_course_date::text, 0));

  select * into v_course from public.course limit 1;
  if v_course is null or not v_course.is_active then
    raise exception 'BOOKINGS_CLOSED';
  end if;
  if v_course.price <> p_price_per_person then
    raise exception 'PRICE_CHANGED';
  end if;

  select max_students_per_day into v_cap from public.settings limit 1;
  select coalesce(sum(number_of_people), 0) into v_booked
    from public.reservations
   where course_date = p_course_date and status <> 'cancelled';
  if v_booked + v_people > v_cap then
    raise exception 'CAPACITY:%:%', greatest(v_cap - v_booked, 0), v_cap;
  end if;

  v_ref := 'LD-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 8));

  insert into public.reservations (
    order_ref, customer_name, customer_phone, customer_email,
    course_date, course_time, course_name, price_per_person, number_of_people,
    subtotal, discount, total_price, special_requests,
    waiver_accepted_at, waiver_version
  ) values (
    v_ref, p_customer_name, p_customer_phone, nullif(p_customer_email, ''),
    p_course_date, p_course_time, v_course.name, v_course.price, v_people,
    p_subtotal, p_discount, p_total_price, nullif(p_special_requests, ''),
    now(), p_waiver_version
  ) returning id into v_id;

  insert into public.participants (reservation_id, position, gender, age, weight_kg, swimmer)
  select v_id, ord::smallint, p->>'gender', (p->>'age')::smallint, (p->>'weight_kg')::smallint, (p->>'swimmer')::boolean
    from jsonb_array_elements(p_participants) with ordinality as t(p, ord);

  return jsonb_build_object('id', v_id, 'order_ref', v_ref, 'total_price', p_total_price);
end;
$$;

-- ── Retention: delete personal data once it's no longer needed ──────────────
-- Default: 24 months after the lesson date (long enough to answer a claim
-- covered by the waiver). Change the interval if your lawyer advises otherwise.

create or replace function public.purge_expired_personal_data(p_older_than interval default interval '24 months')
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.reservations
     where course_date < (current_date - p_older_than)
    returning 1
  )
  select count(*)::integer from deleted;
$$;

-- ── The app's own database role (least privilege) ──────────────────────────
-- LOGIN without a password: it can't sign in until you set one (see README —
-- never put the password in this file or in git).

create role lazydog_app login noinherit;

grant usage on schema public to lazydog_app;
grant select on public.course, public.settings, public.reservations, public.participants to lazydog_app;
grant update (name, price, is_active, updated_at) on public.course to lazydog_app;
grant update (max_students_per_day, updated_at) on public.settings to lazydog_app;
grant update (status, updated_at) on public.reservations to lazydog_app;
grant delete on public.reservations to lazydog_app;   -- GDPR erasure (participants cascade)

create policy lazydog_app_all on public.course       for all to lazydog_app using (true) with check (true);
create policy lazydog_app_all on public.settings     for all to lazydog_app using (true) with check (true);
create policy lazydog_app_all on public.reservations for all to lazydog_app using (true) with check (true);
create policy lazydog_app_all on public.participants for all to lazydog_app using (true) with check (true);

-- Functions: only lazydog_app may call them (they run as their owner, so the
-- app role itself never needs INSERT rights).
revoke all on function public.create_booking(text, text, text, date, text, jsonb, text, text, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.purge_expired_personal_data(interval) from public, anon, authenticated;
grant execute on function public.create_booking(text, text, text, date, text, jsonb, text, text, integer, integer, integer, integer) to lazydog_app;
grant execute on function public.purge_expired_personal_data(interval) to lazydog_app;
