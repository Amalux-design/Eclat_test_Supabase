-- ============================================================================
-- Éclat by Harsha — Supabase schema
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Safe to re-run: everything uses IF NOT EXISTS / OR REPLACE.
--
-- BEFORE RUNNING: replace the owner email at the very bottom with Harsha's.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Members: who may use the app, and with which role.
--   owner  everything, plus managing the team
--   admin  everything except managing the team
--   team   schedule only: no contacts, money or private notes
-- Removing access = set active = false (or delete the row). Takes effect on
-- the very next request, because every policy below checks this table.
-- ---------------------------------------------------------------------------
create table if not exists public.members (
  email       text primary key check (email = lower(email)),
  name        text not null default '',
  role        text not null check (role in ('owner', 'admin', 'team')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Role of the signed-in user, or null if they aren't an active member.
-- SECURITY DEFINER so policies can read members without recursion.
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.members
  where email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and active
$$;

create or replace function public.is_member() returns boolean
language sql stable as $$ select public.app_role() is not null $$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.app_role() in ('owner', 'admin') $$;

create or replace function public.is_owner() returns boolean
language sql stable as $$ select public.app_role() = 'owner' $$;

-- Lets the sign-in screen check, before someone creates a password, that
-- Harsha has added their email. Only answers yes/no for that exact email.
create or replace function public.is_invited(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members where email = lower(trim(p_email)) and active)
$$;

grant execute on function public.is_invited(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bookings: the details the whole team may see.
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id           uuid primary key,              -- created on the device
  date         date not null,
  client_name  text not null default '',
  work         text not null default '',      -- services, comma-separated
  event_type   text not null default '',
  location     text not null default '',
  bridesmaids  integer not null default 0,
  status       text not null default 'RESERVED' check (status in ('RESERVED', 'WORKED')),
  start_time   text not null default '',      -- "HH:mm"
  end_time     text not null default '',      -- "HH:mm" (ready by)
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists bookings_date_idx on public.bookings (date desc);

-- ---------------------------------------------------------------------------
-- Booking private: contacts, money and private notes. Admins/owner only.
-- A separate table so the database itself withholds these from the team.
-- ---------------------------------------------------------------------------
create table if not exists public.booking_private (
  booking_id      uuid primary key references public.bookings (id) on delete cascade,
  client_phone    text not null default '',   -- text: digits stored exactly as given
  alt_phone       text not null default '',
  qty             integer not null default 1,
  price           numeric not null default 0,
  amount          numeric not null default 0,
  paid_amount     numeric not null default 0,
  payment_status  text not null default 'PENDING' check (payment_status in ('PENDING', 'PAID')),
  own             boolean not null default true,
  referrer_name   text not null default '',
  private_notes   text not null default '',
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reference photos. Files live in the private "reference-photos" bucket;
-- this table records them. work_date drives the automatic clean-up
-- (photos are removed 2 months after the work date).
-- ---------------------------------------------------------------------------
create table if not exists public.booking_photos (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  path        text not null,                  -- full image in storage
  thumb_path  text not null,                  -- small preview in storage
  work_date   date not null,
  created_at  timestamptz not null default now()
);

create index if not exists booking_photos_booking_idx on public.booking_photos (booking_id);
create index if not exists booking_photos_work_date_idx on public.booking_photos (work_date);

-- ---------------------------------------------------------------------------
-- updated_at is always set by the database, so devices can't fake it.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

drop trigger if exists booking_private_touch on public.booking_private;
create trigger booking_private_touch before update on public.booking_private
  for each row execute function public.touch_updated_at();

-- Keep photo work_date in step if a booking's date changes.
create or replace function public.sync_photo_work_date()
returns trigger language plpgsql as $$
begin
  if new.date is distinct from old.date then
    update public.booking_photos set work_date = new.date where booking_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists bookings_photo_date on public.bookings;
create trigger bookings_photo_date after update on public.bookings
  for each row execute function public.sync_photo_work_date();

-- ---------------------------------------------------------------------------
-- Row Level Security: the database enforces who sees what.
-- ---------------------------------------------------------------------------
alter table public.members         enable row level security;
alter table public.bookings        enable row level security;
alter table public.booking_private enable row level security;
alter table public.booking_photos  enable row level security;

-- members: everyone signed in can read their own row; the owner manages all.
drop policy if exists members_self_read on public.members;
create policy members_self_read on public.members for select
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')) or public.is_owner());

drop policy if exists members_owner_write on public.members;
create policy members_owner_write on public.members for all
  using (public.is_owner()) with check (public.is_owner());

-- bookings: any active member reads; admins/owner write.
drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select using (public.is_member());

drop policy if exists bookings_write on public.bookings;
create policy bookings_write on public.bookings for all
  using (public.is_admin()) with check (public.is_admin());

-- booking_private: admins/owner only, for everything.
drop policy if exists booking_private_admin on public.booking_private;
create policy booking_private_admin on public.booking_private for all
  using (public.is_admin()) with check (public.is_admin());

-- booking_photos: any active member reads; admins/owner add and remove.
drop policy if exists booking_photos_read on public.booking_photos;
create policy booking_photos_read on public.booking_photos for select using (public.is_member());

drop policy if exists booking_photos_write on public.booking_photos;
create policy booking_photos_write on public.booking_photos for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for reference photos (max 5 MB per file, images).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reference-photos', 'reference-photos', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists photos_read on storage.objects;
create policy photos_read on storage.objects for select
  using (bucket_id = 'reference-photos' and public.is_member());

drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects for insert
  with check (bucket_id = 'reference-photos' and public.is_admin());

drop policy if exists photos_update on storage.objects;
create policy photos_update on storage.objects for update
  using (bucket_id = 'reference-photos' and public.is_admin());

drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete
  using (bucket_id = 'reference-photos' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Live updates: devices are told the moment anything changes.
-- (Realtime still respects the policies above.)
-- ---------------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.bookings;        exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.booking_private; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.booking_photos;  exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------------------
-- save_booking: one atomic save for a booking and its private details.
--   base = null      → create (or, if the id already exists, update): a
--                      retried create never makes a duplicate.
--   base = timestamp → update only if the booking hasn't changed since the
--                      device loaded it; otherwise raises CONFLICT (or
--                      NOT_FOUND if it was deleted elsewhere).
--   p = null         → leave private details untouched.
-- Runs with the caller's permissions, so the policies above still apply.
-- ---------------------------------------------------------------------------
create or replace function public.save_booking(b jsonb, p jsonb, base timestamptz)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  bid uuid := (b ->> 'id')::uuid;
  result timestamptz;
begin
  if bid is null then
    raise exception 'VALIDATION: missing booking id';
  end if;

  if base is null then
    insert into bookings (id, date, client_name, work, event_type, location, bridesmaids, status, start_time, end_time, notes)
    values (bid, (b ->> 'date')::date, b ->> 'client_name', b ->> 'work', b ->> 'event_type', b ->> 'location',
            coalesce((b ->> 'bridesmaids')::int, 0), b ->> 'status', b ->> 'start_time', b ->> 'end_time', b ->> 'notes')
    on conflict (id) do update set
      date = excluded.date, client_name = excluded.client_name, work = excluded.work,
      event_type = excluded.event_type, location = excluded.location, bridesmaids = excluded.bridesmaids,
      status = excluded.status, start_time = excluded.start_time, end_time = excluded.end_time, notes = excluded.notes
    returning updated_at into result;
  else
    update bookings set
      date = (b ->> 'date')::date, client_name = b ->> 'client_name', work = b ->> 'work',
      event_type = b ->> 'event_type', location = b ->> 'location',
      bridesmaids = coalesce((b ->> 'bridesmaids')::int, 0), status = b ->> 'status',
      start_time = b ->> 'start_time', end_time = b ->> 'end_time', notes = b ->> 'notes'
    where id = bid and updated_at = base
    returning updated_at into result;

    if result is null then
      if exists (select 1 from bookings where id = bid) then
        raise exception 'CONFLICT: booking changed on another device';
      else
        raise exception 'NOT_FOUND: booking was deleted';
      end if;
    end if;
  end if;

  if p is not null then
    insert into booking_private (booking_id, client_phone, alt_phone, qty, price, amount, paid_amount,
                                 payment_status, own, referrer_name, private_notes)
    values (bid, p ->> 'client_phone', p ->> 'alt_phone', coalesce((p ->> 'qty')::int, 1),
            coalesce((p ->> 'price')::numeric, 0), coalesce((p ->> 'amount')::numeric, 0),
            coalesce((p ->> 'paid_amount')::numeric, 0), p ->> 'payment_status',
            coalesce((p ->> 'own')::boolean, true), p ->> 'referrer_name', p ->> 'private_notes')
    on conflict (booking_id) do update set
      client_phone = excluded.client_phone, alt_phone = excluded.alt_phone, qty = excluded.qty,
      price = excluded.price, amount = excluded.amount, paid_amount = excluded.paid_amount,
      payment_status = excluded.payment_status, own = excluded.own,
      referrer_name = excluded.referrer_name, private_notes = excluded.private_notes;
  end if;

  return result;
end $$;

grant execute on function public.save_booking(jsonb, jsonb, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Owner. CHANGE THIS EMAIL to Harsha's before running.
-- Add more people later from the app (Account → Team).
-- ---------------------------------------------------------------------------
insert into public.members (email, name, role)
values (lower('heyamalux@gmail.com.com'), 'Harsha', 'owner')
on conflict (email) do update set role = 'owner', active = true;
