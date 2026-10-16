-- Daily Google Sheets backup: a locked-down export function.
-- Run once in Supabase → SQL Editor. First replace CHANGE-ME-LONG-RANDOM with
-- your own long random password (e.g. 40 letters/digits) and keep it safe.

create table if not exists public.backup_secret (
  id     int primary key default 1 check (id = 1),
  secret text not null
);
alter table public.backup_secret enable row level security;  -- no policies: nobody can read it
insert into public.backup_secret (id, secret) values (1, 'CHANGE-ME-LONG-RANDOM')
  on conflict (id) do update set secret = excluded.secret;

-- Returns every booking with its private details, but only with the right secret.
create or replace function public.backup_export(p_secret text)
returns setof json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.backup_secret where secret = p_secret and length(p_secret) >= 24) then
    raise exception 'FORBIDDEN';
  end if;
  return query
    select json_build_object(
      'id', b.id, 'date', b.date, 'client_name', b.client_name,
      'client_phone', p.client_phone, 'alt_phone', p.alt_phone,
      'services', b.work, 'event', b.event_type, 'venue', b.location,
      'bridesmaids', b.bridesmaids, 'start_time', b.start_time, 'ready_by', b.end_time,
      'status', b.status, 'amount', p.amount, 'paid_amount', p.paid_amount,
      'payment_status', p.payment_status, 'own', p.own, 'referrer', p.referrer_name,
      'team_notes', b.notes, 'private_notes', p.private_notes,
      'created_at', b.created_at, 'updated_at', b.updated_at
    )
    from public.bookings b
    left join public.booking_private p on p.booking_id = b.id
    order by b.date desc;
end;
$$;

revoke all on function public.backup_export(text) from public;
grant execute on function public.backup_export(text) to anon, authenticated;
