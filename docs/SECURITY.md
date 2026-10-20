# Security checklist (backend & accounts)

What protects the data, and what the owner/developer must do once.

## What's already in place
- Row-level security on every table; team devices never receive phones, money or private notes.
- Only the owner can change `members` (add, remove, roles). No admin can remove the owner.
- Photos in a private bucket, opened only through short-lived signed links.
- `save_booking` runs with the caller's own permissions (no privilege bypass).
- Backup export works only with a secret (≥24 chars) stored in a table nobody can read.
- The anon key in the app is public by design; RLS decides access. No service_role key anywhere.

## Do once (in order)
1. **Harden logins** — Supabase → SQL Editor → paste `supabase/hardening.sql` → Run.
   - Blocks sign-ups for emails not in `members` (even via the API).
   - Blocks changing a login email through the API (prevents taking over an invited admin's role).
   - Test: in the app, "First time? Create password" with an un-added email → "This email isn't on the Éclat team yet".
1b. **Delete for removed members** — paste `supabase/archive-members.sql` → Run (adds `members.archived` + owner-only `archive_member`). Required by the app's Team access list.
2. **Live revoke** — SQL Editor: `alter publication supabase_realtime add table public.members;` (an "already member" error is fine).
3. **Make the GitHub repo private** — github.com/Amalux-design/Eclat_test_Supabase → Settings → General → Danger Zone → Change visibility → Private. Vercel keeps deploying (it's connected through the GitHub app).
4. **Supabase Auth settings** — Authentication → Sign In / Providers → Email: keep "Confirm email" OFF. Authentication → URL Configuration → Site URL = `https://eclatsupabasetest.vercel.app`.
5. **Accounts** — 2-Step Verification on the Google account(s) used for Supabase, Vercel, GitHub and the owner's login email. Strong unique passwords.

## Why "Delete" archives instead of deleting rows
Supabase live updates don't apply row-level security to DELETE events, so hard-deleting a `members` row would broadcast that email to every signed-in device. `archive_member` hides the row, removes access and deletes the person's login instead.

## Login emails
- Use real emails the person controls (best), or a reserved non-existent domain such as `name@eclat.invalid`.
- Never a domain you don't own (`@eclat.com`): Supabase's public API can send reset/magic links to it.

## Ongoing
- Remove access the day someone leaves (Account → Team access → Remove).
- If the backup secret leaks: `update public.backup_secret set secret = 'NEW-LONG-RANDOM';` and update the Apps Script.
- If the anon key is ever rotated in Supabase: update both Vercel env vars → Redeploy.
- Never paste the service_role key into the app, Vercel, docs, chat or memory.

## Useful checks (SQL Editor)
```sql
-- who has access
select email, name, role, active from public.members order by role, name;
-- login accounts that are not (or no longer) on the team
select u.email, u.created_at from auth.users u
left join public.members m on m.email = lower(u.email) and m.active
where m.email is null;
```
Delete stray logins from Authentication → Users.
