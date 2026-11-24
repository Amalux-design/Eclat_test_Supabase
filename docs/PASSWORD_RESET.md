# Forgot password — how Harsha resets one

The app sends no emails, so there is no "reset link". Harsha (the owner) gives
the person a temporary password from the Supabase dashboard; they sign in with
it and choose their own straight away. About 3 minutes.

Supabase has no "change this user's password" button, so the reset is:
**delete the old login, then add it again with a temporary password.**
Only the login is deleted. Bookings, payments, photos and the person's place on
the team (Account → Team access) are not touched: those are stored separately.

## Steps (Harsha, on a laptop)

1. Sign in to **supabase.com** with the account that owns the Éclat project and
   open the project.
2. Left menu → **Authentication** → **Users**.
3. Find the person's email. Click the row → **Delete user** (or ⋯ → Delete
   user) → confirm.
4. Straight away (don't leave a gap): top right → **Add user** → **Create new user**.
   - **Email:** exactly the same email, all lower case.
   - **Password:** a temporary one, at least 8 characters, e.g. `Eclat-temp-4827`.
   - **Auto Confirm User:** ticked.
   - **Create user**.
5. Tell the person the temporary password (call or WhatsApp; don't post it in a group).
6. They open the app → **Sign in** with their email and the temporary password →
   **Account** (top right) → **Change password** → their own new password.

That's it. Their phone is signed out of the old login; they just sign in again.

## If it goes wrong

| What you see | What it means | Do this |
| --- | --- | --- |
| "Add user" fails with *Database error saving new user* | That email isn't an active member of the team | In the app: Account → Team access → check the email is listed, spelt the same, and not removed. Fix, then Add user again. |
| "Delete user" fails with *Database error deleting user* | Something in the database still points at that login (see the one-time check below) | Don't retry. Ask the developer. |
| The person sees "Email or password is wrong" | Typo in the email or temporary password | Repeat steps 3–4 with care; emails must match letter for letter. |
| The person sees "This email already has a password" | They tapped "First time? Create password" | Tell them to tap "Already have a password? Sign in" instead. |

## Harsha forgot her own password

Same steps, on her own email. The Supabase dashboard has its own separate login
(her Google account), so she can always get in there. After step 4 she signs in
to the app with the temporary password and changes it.

## One-time check (developer, on each new Supabase project)

Before relying on this, make sure no table refuses a deleted login. SQL Editor → Run:

```sql
select conrelid::regclass as table_name, conname
from pg_constraint
where confrelid = 'auth.users'::regclass
  and connamespace <> 'auth'::regnamespace;
```

- **No rows:** deleting a login is safe. Then rehearse the reset once on a
  test team account (add `test@eclat.invalid` in Team access, create its
  password, reset it with the steps above, sign in, remove it again).
- **Any row** (for example `storage.objects`): stop. Deleting the login of
  someone who uploaded photos could fail or remove their photo records. Ask the
  developer before using this procedure.

## Why not "Send password recovery" in Supabase?

That button emails a reset link. Éclat has no email set up (by design: no email
costs or limits), so the link never arrives. Don't use it.
