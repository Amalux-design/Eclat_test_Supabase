-- Éclat — "Delete" for removed team members (run once, safe to re-run).
-- Supabase → SQL Editor → New query → paste all → Run.
--
-- Deleting a members row would broadcast that email to every signed-in phone
-- (Supabase live updates don't apply access rules to DELETE events). So a
-- delete archives the row instead: hidden from Team access, no access, and the
-- person's login account is removed. Only the owner can do it, never to the owner.

alter table public.members add column if not exists archived boolean not null default false;

create or replace function public.archive_member(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e text := lower(trim(p_email));
begin
  if not public.is_owner() then
    raise exception 'FORBIDDEN: only the owner can delete team members';
  end if;
  if exists (select 1 from public.members where email = e and role = 'owner') then
    raise exception 'FORBIDDEN: the owner cannot be deleted';
  end if;

  update public.members set active = false, archived = true where email = e;
  -- Remove their login too, so the account can't be used or reused.
  delete from auth.users where lower(email) = e;
end;
$$;

revoke all on function public.archive_member(text) from public, anon;
grant execute on function public.archive_member(text) to authenticated;
