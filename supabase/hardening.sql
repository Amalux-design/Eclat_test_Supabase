-- Éclat — security hardening for the login system (run once, safe to re-run).
-- Supabase → SQL Editor → New query → paste all → Run.
--
-- Closes two gaps that the app's own screens can't close, because anyone can
-- call Supabase's login API directly with the public (anon) key:
--
-- 1. Uninvited sign-ups. The "only invited emails" check lived in the app.
--    Now the database itself refuses to create a login for any email that
--    isn't an active row in public.members (owner/admin/team).
--
-- 2. Email-change role theft. A signed-in person could change their login
--    email (via the API) to an invited-but-unclaimed admin email and inherit
--    that role. Login emails can now only be changed from the SQL Editor.

create or replace function public.guard_auth_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only requests coming through Supabase's login API (sign-up, magic link,
  -- email change, dashboard user tools) run as supabase_auth_admin. The SQL
  -- Editor runs as postgres and stays unrestricted for the owner/developer.
  if current_user <> 'supabase_auth_admin' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.members
      where email = lower(coalesce(new.email, '')) and active
    ) then
      raise exception 'NOT_INVITED: this email is not on the Éclat team';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.email is distinct from old.email then
      raise exception 'EMAIL_LOCKED: login emails can only be changed by the owner';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_auth_users_insert on auth.users;
create trigger guard_auth_users_insert
  before insert on auth.users
  for each row execute function public.guard_auth_users();

drop trigger if exists guard_auth_users_email on auth.users;
create trigger guard_auth_users_email
  before update of email on auth.users
  for each row execute function public.guard_auth_users();

-- Nobody calls this function directly.
revoke all on function public.guard_auth_users() from public, anon, authenticated;
