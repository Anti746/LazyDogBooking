begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- LazyDog Surf — database schema (Supabase / PostgreSQL)
--
-- Run once in Supabase → SQL Editor (or `supabase db push`).
--
-- Security model (GDPR Art. 25 & 32 — data protection by design, security):
--   • The browser NEVER talks to the database with a privileged key. All access
--     goes through authenticated Next.js API routes or the public booking flow.
--   • RLS is ON for every table; anon/authenticated have no table grants or
--     policies. Only a server-side Supabase secret key can use the explicit
--     service_role grants. That key must never be sent to a browser.
--   • Booking INSERT is available only through create_booking(), which checks
--     capacity and inserts in one locked transaction, preventing overbooking.
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
-- No policies are granted to public roles. Also remove default schema access,
-- then give the server role only the schema access needed by the API.
revoke create on schema public from public;
grant usage on schema public to anon, authenticated, service_role;
revoke all on public.course, public.settings, public.reservations, public.participants from public, anon, authenticated, service_role;

-- Explicit server-only policies document the intended RLS path. Public roles
-- receive neither policies nor table privileges.
create policy course_server_read on public.course for select to service_role using (true);
create policy course_server_update on public.course for update to service_role using (true) with check (true);
create policy settings_server_read on public.settings for select to service_role using (true);
create policy settings_server_update on public.settings for update to service_role using (true) with check (true);
create policy reservations_server_read on public.reservations for select to service_role using (true);
create policy reservations_server_update on public.reservations for update to service_role using (true) with check (true);
create policy reservations_server_delete on public.reservations for delete to service_role using (true);
create policy participants_server_read on public.participants for select to service_role using (true);

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
  v_people   integer;
  v_discount integer;
  v_id       uuid;
  v_ref      text;
begin
  if jsonb_typeof(p_participants) <> 'array' then
    raise exception 'INVALID_PARTICIPANTS';
  end if;
  v_people := jsonb_array_length(p_participants);
  if v_people < 1 or v_people > 8 then
    raise exception 'INVALID_PARTICIPANTS';
  end if;

  -- Serialise bookings for the same day, so the capacity check can't race.
  perform pg_advisory_xact_lock(hashtextextended('lazydog-booking:' || p_course_date::text, 0));

  select * into v_course from public.course limit 1;
  if v_course is null or not v_course.is_active then
    raise exception 'BOOKINGS_CLOSED';
  end if;
  if v_course.price <> p_price_per_person then
    raise exception 'PRICE_CHANGED';
  end if;
  if p_course_date <= current_date or p_course_time not in ('08:30', '10:00') then
    raise exception 'INVALID_BOOKING_DATE_OR_TIME';
  end if;

  v_discount := case when v_people >= 3 then round((v_people * v_course.price)::numeric * 0.10)::integer else 0 end;
  if p_subtotal <> v_people * v_course.price
     or p_discount <> v_discount
     or p_total_price <> p_subtotal - p_discount then
    raise exception 'INVALID_PRICE';
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

-- Admin-only data-subject lookup (email, phone or booking reference).
-- Returns only matching bookings and their minimal participant fields.
create or replace function public.find_reservations_by_contact(p_term text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      to_jsonb(r) || jsonb_build_object('participants', coalesce(p.people, '[]'::jsonb))
      order by r.course_date desc
    ),
    '[]'::jsonb
  )
  from public.reservations r
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('gender', p.gender, 'age', p.age, 'weight_kg', p.weight_kg, 'swimmer', p.swimmer)
      order by p.position
    ) as people
    from public.participants p
    where p.reservation_id = r.id
  ) p on true
  where lower(coalesce(r.customer_email, '')) = lower(p_term)
     or (
       length(regexp_replace(p_term, '\D', '', 'g')) >= 6
       and regexp_replace(r.customer_phone, '\D', '', 'g') like '%' || regexp_replace(p_term, '\D', '', 'g') || '%'
     )
     or upper(r.order_ref) = upper(p_term);
$$;

-- ── Least-privilege server access ──────────────────────────────────────────
-- Supabase's service_role is used only in server-only code. Revoke its default
-- table grants, then grant only operations used by the API. RLS remains enabled
-- and there are deliberately no policies for anon/authenticated.
grant usage on schema public to service_role;
grant select on public.course, public.settings, public.reservations, public.participants to service_role;
grant update (name, price, is_active, updated_at) on public.course to service_role;
grant update (max_students_per_day, updated_at) on public.settings to service_role;
grant update (status, updated_at) on public.reservations to service_role;
grant delete on public.reservations to service_role;   -- GDPR erasure (participants cascade)

-- Restrict privileged functions to the server key; do not expose to public API keys.
revoke all on function public.create_booking(text, text, text, date, text, jsonb, text, text, integer, integer, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.purge_expired_personal_data(interval) from public, anon, authenticated, service_role;
revoke all on function public.find_reservations_by_contact(text) from public, anon, authenticated, service_role;
grant execute on function public.create_booking(text, text, text, date, text, jsonb, text, text, integer, integer, integer, integer) to service_role;
grant execute on function public.purge_expired_personal_data(interval) to service_role;
grant execute on function public.find_reservations_by_contact(text) to service_role;

commit;
